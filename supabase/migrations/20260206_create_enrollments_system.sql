-- ============================================================================
-- ENROLLMENT SYSTEM MIGRATION
-- ============================================================================
-- Purpose: Replace students.class_id direct updates with append-only 
--          enrollment history to preserve academic timeline and prevent data loss
-- Date: 2026-02-06
-- ============================================================================

-- ============================================================================
-- PART 1: ENROLLMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  term_id uuid REFERENCES terms(id) ON DELETE CASCADE NOT NULL,
  
  -- Status tracking
  status text DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'completed', 'dropped', 'graduated')),
  enrollment_type text DEFAULT 'promoted' CHECK (enrollment_type IN ('new', 'promoted', 'transferred', 'repeated', 'returned')),
  
  -- Timeline
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  
  -- Reference to previous enrollment (for audit trail and promotion chain)
  previous_enrollment_id uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Business constraints
  UNIQUE(student_id, session_id, term_id),  -- One enrollment per student per term
  CONSTRAINT valid_completion CHECK (completed_at IS NULL OR completed_at >= enrolled_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_class ON enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_session ON enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_term ON enrollments(term_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_session_term ON enrollments(session_id, term_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_active ON enrollments(student_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_enrollments_class_session_term ON enrollments(class_id, session_id, term_id);

-- Enable RLS
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollments
CREATE POLICY "Authenticated users can read enrollments"
  ON enrollments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage enrollments"
  ON enrollments FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- PART 2: HELPER VIEWS
-- ============================================================================

-- View: Get CURRENT enrollments (most common query)
CREATE OR REPLACE VIEW current_enrollments AS
SELECT 
  e.id as enrollment_id,
  e.student_id,
  e.class_id,
  e.session_id,
  e.term_id,
  e.status,
  e.enrollment_type,
  e.enrolled_at,
  s.student_id as student_number,
  s.first_name,
  s.last_name,
  s.email,
  s.phone,
  s.gender,
  s.date_of_birth,
  s.parent_name,
  s.parent_email,
  s.parent_phone,
  s.status as student_status,
  s.religion,
  s.department,
  c.name as class_name,
  c.level as class_level,
  c.education_level,
  sess.name as session_name,
  t.name as term_name
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN classes c ON c.id = e.class_id
JOIN sessions sess ON sess.id = e.session_id
JOIN terms t ON t.id = e.term_id
WHERE sess.is_current = true 
  AND t.is_current = true
  AND e.status = 'active';

-- View: All enrollments with details (for historical queries)
CREATE OR REPLACE VIEW enrollment_details AS
SELECT 
  e.id as enrollment_id,
  e.student_id,
  e.class_id,
  e.session_id,
  e.term_id,
  e.status,
  e.enrollment_type,
  e.enrolled_at,
  e.completed_at,
  e.previous_enrollment_id,
  s.student_id as student_number,
  s.first_name,
  s.last_name,
  s.email,
  c.name as class_name,
  c.level as class_level,
  c.education_level,
  sess.name as session_name,
  sess.start_date as session_start,
  sess.end_date as session_end,
  t.name as term_name,
  t.start_date as term_start,
  t.end_date as term_end
FROM enrollments e
JOIN students s ON s.id = e.student_id
JOIN classes c ON c.id = e.class_id
JOIN sessions sess ON sess.id = e.session_id
JOIN terms t ON t.id = e.term_id;

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get student's class for specific session/term
CREATE OR REPLACE FUNCTION get_student_class(
  p_student_id uuid,
  p_session_id uuid,
  p_term_id uuid
) RETURNS uuid AS $$
  SELECT class_id 
  FROM enrollments 
  WHERE student_id = p_student_id
    AND session_id = p_session_id
    AND term_id = p_term_id
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function: Get student's current class (uses current session/term)
CREATE OR REPLACE FUNCTION get_student_current_class(p_student_id uuid)
RETURNS uuid AS $$
  SELECT class_id 
  FROM enrollments e
  JOIN sessions s ON s.id = e.session_id
  JOIN terms t ON t.id = e.term_id
  WHERE e.student_id = p_student_id
    AND s.is_current = true
    AND t.is_current = true
    AND e.status = 'active'
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function: Get enrollment history
CREATE OR REPLACE FUNCTION get_enrollment_history(p_student_id uuid)
RETURNS TABLE(
  enrollment_id uuid,
  class_name text,
  session_name text,
  term_name text,
  status text,
  enrollment_type text,
  enrolled_at timestamptz,
  completed_at timestamptz
) AS $$
  SELECT 
    e.id,
    c.name,
    s.name,
    t.name,
    e.status,
    e.enrollment_type,
    e.enrolled_at,
    e.completed_at
  FROM enrollments e
  JOIN classes c ON c.id = e.class_id
  JOIN sessions s ON s.id = e.session_id
  JOIN terms t ON t.id = e.term_id
  WHERE e.student_id = p_student_id
  ORDER BY s.start_date DESC, t.start_date DESC, e.enrolled_at DESC;
$$ LANGUAGE sql STABLE;

-- Function: Get all students enrolled in a class for a specific session/term
CREATE OR REPLACE FUNCTION get_class_students(
  p_class_id uuid,
  p_session_id uuid,
  p_term_id uuid
) RETURNS TABLE(
  student_id uuid,
  student_number text,
  first_name text,
  last_name text,
  email text,
  status text
) AS $$
  SELECT 
    s.id,
    s.student_id,
    s.first_name,
    s.last_name,
    s.email,
    s.status
  FROM enrollments e
  JOIN students s ON s.id = e.student_id
  WHERE e.class_id = p_class_id
    AND e.session_id = p_session_id
    AND e.term_id = p_term_id
  ORDER BY s.last_name, s.first_name;
$$ LANGUAGE sql STABLE;

-- Function: Check if student is currently enrolled
CREATE OR REPLACE FUNCTION is_student_enrolled(p_student_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM enrollments e
    JOIN sessions s ON s.id = e.session_id
    JOIN terms t ON t.id = e.term_id
    WHERE e.student_id = p_student_id
      AND s.is_current = true
      AND t.is_current = true
      AND e.status = 'active'
  );
$$ LANGUAGE sql STABLE;

-- ============================================================================
-- PART 4: DATA MIGRATION - BACKFILL ENROLLMENTS
-- ============================================================================

-- Backfill enrollments from current student-class assignments
-- This creates enrollment records for all students currently assigned to classes
INSERT INTO enrollments (student_id, class_id, session_id, term_id, status, enrollment_type, notes)
SELECT 
  s.id as student_id,
  s.class_id,
  COALESCE(
    (SELECT id FROM sessions WHERE is_current = true LIMIT 1),
    (SELECT id FROM sessions ORDER BY start_date DESC LIMIT 1)
  ) as session_id,
  COALESCE(
    (SELECT id FROM terms WHERE is_current = true LIMIT 1),
    (SELECT id FROM terms ORDER BY start_date DESC LIMIT 1)
  ) as term_id,
  CASE 
    WHEN s.status = 'active' THEN 'active'
    ELSE 'completed'
  END as status,
  'new' as enrollment_type,
  'Migrated from students.class_id on 2026-02-06' as notes
FROM students s
WHERE s.class_id IS NOT NULL
ON CONFLICT (student_id, session_id, term_id) DO NOTHING;

-- Optional: Backfill from results table (reconstruct historical enrollments)
-- This finds past class memberships from results.subject_class_id
INSERT INTO enrollments (student_id, class_id, session_id, term_id, status, enrollment_type, notes)
SELECT DISTINCT
  r.student_id,
  sc.class_id,
  r.session_id,
  r.term_id,
  'completed' as status,
  'new' as enrollment_type,
  'Reconstructed from results history on 2026-02-06' as notes
FROM results r
JOIN subject_classes sc ON sc.id = r.subject_class_id
WHERE NOT EXISTS (
  SELECT 1 FROM enrollments e 
  WHERE e.student_id = r.student_id 
    AND e.session_id = r.session_id 
    AND e.term_id = r.term_id
)
ON CONFLICT (student_id, session_id, term_id) DO NOTHING;

-- ============================================================================
-- PART 5: UPDATE ATTENDANCE TABLE
-- ============================================================================

-- Add enrollment_id reference to attendance
ALTER TABLE attendance 
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES enrollments(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment ON attendance(enrollment_id);

-- Backfill enrollment_id from existing data
UPDATE attendance a
SET enrollment_id = (
  SELECT e.id FROM enrollments e
  WHERE e.student_id = a.student_id
    AND e.session_id = a.session_id
    AND e.term_id = a.term_id
  LIMIT 1
)
WHERE a.enrollment_id IS NULL;

-- Note: We'll keep class_id temporarily for backward compatibility
-- It will be removed in Phase 4 after all queries are migrated

-- ============================================================================
-- PART 6: TRIGGER - AUTO-SYNC students.class_id (Backward Compatibility)
-- ============================================================================

-- Automatically update students.class_id when enrollment changes
-- This maintains backward compatibility during migration
CREATE OR REPLACE FUNCTION sync_student_class_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if this is an active enrollment in current session/term
  IF NEW.status = 'active' AND EXISTS (
    SELECT 1 FROM sessions WHERE id = NEW.session_id AND is_current = true
  ) AND EXISTS (
    SELECT 1 FROM terms WHERE id = NEW.term_id AND is_current = true
  ) THEN
    UPDATE students 
    SET class_id = NEW.class_id 
    WHERE id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_student_class_id ON enrollments;
CREATE TRIGGER trigger_sync_student_class_id
  AFTER INSERT OR UPDATE OF status, class_id ON enrollments
  FOR EACH ROW
  EXECUTE FUNCTION sync_student_class_id();

-- ============================================================================
-- PART 7: UPDATE get_student_position FUNCTION
-- ============================================================================

-- Update position calculation to use enrollment history (not current class_id)
CREATE OR REPLACE FUNCTION get_student_position(
  p_student_id uuid,
  p_term_id uuid
)
RETURNS TABLE(
  class_position integer,
  total_marks numeric,
  student_count integer,
  average_percentage numeric
) AS $$
DECLARE
  student_total numeric;
  student_class_id uuid;
  student_session_id uuid;
  student_position integer;
  student_count integer;
  student_avg numeric;
BEGIN
  -- Get session from term
  SELECT session_id INTO student_session_id
  FROM terms 
  WHERE id = p_term_id;
  
  -- Get student's HISTORICAL class (not current class_id!)
  -- This ensures we rank against peers from THAT time period
  SELECT class_id INTO student_class_id
  FROM enrollments
  WHERE student_id = p_student_id
    AND session_id = student_session_id
    AND term_id = p_term_id
  LIMIT 1;
  
  -- If no enrollment found, return NULL
  IF student_class_id IS NULL THEN
    RETURN QUERY SELECT NULL::integer, NULL::numeric, NULL::integer, NULL::numeric;
    RETURN;
  END IF;
  
  -- Calculate student's total marks
  SELECT COALESCE(SUM(r.total), 0)
  INTO student_total
  FROM results r
  WHERE r.student_id = p_student_id
    AND r.term_id = p_term_id;
  
  -- Get all students who were in the SAME CLASS during THAT term
  WITH class_totals AS (
    SELECT 
      e.student_id,
      COALESCE(SUM(r.total), 0) as total
    FROM enrollments e
    LEFT JOIN results r ON r.student_id = e.student_id AND r.term_id = p_term_id
    WHERE e.class_id = student_class_id
      AND e.session_id = student_session_id
      AND e.term_id = p_term_id
    GROUP BY e.student_id
  )
  SELECT 
    COUNT(*) FILTER (WHERE total > student_total) + 1,
    COUNT(*)::integer,
    CASE 
      WHEN COUNT(*) > 0 THEN ROUND((student_total / NULLIF(SUM(r.total) / COUNT(*), 0)) * 100, 2)
      ELSE 0
    END
  INTO student_position, student_count, student_avg
  FROM class_totals, results r
  WHERE r.student_id = p_student_id AND r.term_id = p_term_id;
  
  RETURN QUERY SELECT student_position, student_total, student_count, student_avg;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 8: UPDATE get_student_subjects FUNCTION
-- ============================================================================

-- Update to optionally use enrollment-based class lookup
CREATE OR REPLACE FUNCTION get_student_subjects(
  student_uuid uuid,
  p_session_id uuid DEFAULT NULL,
  p_term_id uuid DEFAULT NULL
)
RETURNS TABLE(
  subject_class_id uuid,
  subject_id uuid,
  subject_name text
) AS $$
DECLARE
  v_class_id uuid;
  v_department text;
  v_religion text;
BEGIN
  -- Get student's class based on session/term if provided
  IF p_session_id IS NOT NULL AND p_term_id IS NOT NULL THEN
    SELECT e.class_id, s.department, s.religion
    INTO v_class_id, v_department, v_religion
    FROM enrollments e
    JOIN students s ON s.id = e.student_id
    WHERE e.student_id = student_uuid
      AND e.session_id = p_session_id
      AND e.term_id = p_term_id
    LIMIT 1;
  ELSE
    -- Fall back to current class
    SELECT s.class_id, s.department, s.religion
    INTO v_class_id, v_department, v_religion
    FROM students s
    WHERE s.id = student_uuid;
  END IF;
  
  -- Return subjects based on class and student attributes
  RETURN QUERY
  SELECT 
    sc.id,
    sc.subject_id,
    s.name
  FROM subject_classes sc
  JOIN subjects s ON s.id = sc.subject_id
  WHERE sc.class_id = v_class_id
    AND (s.is_compulsory = true OR s.id IN (
      SELECT subject_id FROM student_optional_subjects WHERE student_id = student_uuid
    ))
    AND (s.department IS NULL OR s.department = v_department)
    AND (s.religion IS NULL OR s.religion = v_religion)
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Update API endpoints to use enrollments (transfer, promotion, add/remove)
-- 2. Update React components to query current_enrollments view
-- 3. Refactor historical queries to use enrollment-based class lookup
-- 4. Test thoroughly before removing students.class_id
-- ============================================================================
