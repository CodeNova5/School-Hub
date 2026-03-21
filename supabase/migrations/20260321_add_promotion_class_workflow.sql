-- ============================================================================
-- PROMOTION CLASS-BY-CLASS WORKFLOW
-- ============================================================================
-- Adds tables and functions to support class-by-class promotion workflow:
-- 1. promotion_class_mappings - Track class destination mappings per session
-- 2. promotion_class_progress - Track progress of promotion processing per class
-- ============================================================================

-- ============================================================================
-- Table: promotion_class_mappings
-- Purpose: Store the mapping of source class -> destination class per session
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotion_class_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  destination_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
  mapped_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one mapping per source class per session
  UNIQUE(session_id, source_class_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_class_mappings_session_id
ON promotion_class_mappings(session_id);

CREATE INDEX IF NOT EXISTS idx_promotion_class_mappings_source_class_id
ON promotion_class_mappings(source_class_id);

CREATE INDEX IF NOT EXISTS idx_promotion_class_mappings_school_id
ON promotion_class_mappings(school_id);

-- ============================================================================
-- Table: promotion_class_progress
-- Purpose: Track which classes have been processed and how many students
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotion_class_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
  total_students int DEFAULT 0,
  processed_students int DEFAULT 0,
  promoted_students int DEFAULT 0,
  graduated_students int DEFAULT 0,
  repeated_students int DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one progress record per class per session
  UNIQUE(session_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_session_id
ON promotion_class_progress(session_id);

CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_class_id
ON promotion_class_progress(class_id);

CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_status
ON promotion_class_progress(status)
WHERE status != 'completed';

CREATE INDEX IF NOT EXISTS idx_promotion_class_progress_school_id
ON promotion_class_progress(school_id);

-- ============================================================================
-- Function: get_next_class_options
-- Purpose: Get available destination classes for a source class
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_class_options(
  p_source_class_id uuid,
  p_school_id uuid
)
RETURNS TABLE(
  class_id uuid,
  class_name text,
  class_level text,
  stream_name text,
  is_stream boolean
) 
LANGUAGE sql STABLE
AS $$
  -- Get the source class's education level
  WITH source_class_info AS (
    SELECT 
      c.school_id,
      sol.order_sequence as source_order,
      sol.id as source_level_id
    FROM classes c
    JOIN school_class_levels scl ON c.class_level_id = scl.id
    JOIN school_education_levels sol ON scl.education_level_id = sol.id
    WHERE c.id = p_source_class_id
  ),
  -- Get next education level
  next_level AS (
    SELECT 
      sol.id,
      sol.name,
      sol.order_sequence
    FROM school_education_levels sol
    WHERE sol.school_id = p_school_id
      AND sol.order_sequence > (SELECT source_order FROM source_class_info)
    ORDER BY sol.order_sequence ASC
    LIMIT 1
  )
  -- Get classes in the next level
  SELECT
    c.id,
    c.name,
    sol.name,
    STRING_AGG(ss.name, ', ') FILTER(WHERE ss.name IS NOT NULL),
    (ss.id IS NOT NULL)::boolean
  FROM classes c
  JOIN school_class_levels scl ON c.class_level_id = scl.id
  JOIN school_education_levels sol ON scl.education_level_id = sol.id
  LEFT JOIN school_streams ss ON c.stream_id = ss.id
  WHERE sol.id = (SELECT id FROM next_level)
    AND c.school_id = p_school_id
  GROUP BY c.id, c.name, sol.name, ss.id
  ORDER BY (ss.id IS NOT NULL) ASC, c.name ASC;
$$;

-- ============================================================================
-- Function: is_student_already_processed
-- Purpose: Check if a student has already been promoted for this session
-- ============================================================================

CREATE OR REPLACE FUNCTION is_student_already_processed(
  p_student_id uuid,
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM class_history
    WHERE student_id = p_student_id
      AND session_id = p_session_id
      AND promotion_status IS NOT NULL
  );
$$;

-- ============================================================================
-- Function: get_unprocessed_students_for_class
-- Purpose: Get all students in a class who haven't been promoted yet this session
-- ============================================================================

CREATE OR REPLACE FUNCTION get_unprocessed_students_for_class(
  p_class_id uuid,
  p_session_id uuid,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE(
  student_id uuid,
  student_id_number text,
  student_name text,
  class_id uuid,
  class_name text
)
LANGUAGE sql STABLE
AS $$
  SELECT 
    s.id,
    s.student_id,
    CONCAT(s.first_name, ' ', s.last_name),
    c.id,
    c.name
  FROM students s
  JOIN classes c ON s.class_id = c.id
  WHERE c.id = p_class_id
    AND NOT is_student_already_processed(s.id, p_session_id)
  ORDER BY s.first_name, s.last_name
  LIMIT p_limit OFFSET p_offset;
$$;

-- Set RLS policies if needed (depends on your RLS setup)
ALTER TABLE promotion_class_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_class_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage mappings and progress for their school
CREATE POLICY "admin_manage_promotion_class_mappings" ON promotion_class_mappings
FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM admins WHERE school_id = promotion_class_mappings.school_id
  )
);

CREATE POLICY "admin_manage_promotion_class_progress" ON promotion_class_progress
FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM admins WHERE school_id = promotion_class_progress.school_id
  )
);
