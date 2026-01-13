ALTER TABLE students
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS activation_token_hash text,
ADD COLUMN IF NOT EXISTS activation_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS activation_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

ALTER TABLE assignments
ADD COLUMN submission_type text DEFAULT 'text',
ADD COLUMN total_marks integer DEFAULT 100,
ADD COLUMN allow_late_submission boolean DEFAULT false;


ADD COLUMN religion text CHECK (
  religion IS NULL OR religion = ANY (ARRAY['Christian', 'Muslim'])
);

CREATE TABLE IF NOT EXISTS student_optional_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_id)
);
CREATE OR REPLACE FUNCTION link_class_to_subjects()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove old links (safe for updates)
  DELETE FROM subject_classes WHERE class_id = NEW.id;

  -- Link subjects by education level only
  INSERT INTO subject_classes (subject_id, class_id)
  SELECT s.id, NEW.id
  FROM subjects s
  WHERE s.education_level = NEW.education_level
    AND s.religion IS NULL; -- exclude CRS / IRS

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE results
ADD CONSTRAINT results_unique_row
UNIQUE (student_id, subject_class_id, session_id, term_id);

CREATE OR REPLACE FUNCTION get_student_subjects(student_uuid uuid)
RETURNS TABLE(
  subject_class_id uuid,
  subject_id uuid,
  subject_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    sc.id AS subject_class_id,
    s.id AS subject_id,
    s.name AS subject_name
  FROM students st
  JOIN classes c ON c.id = st.class_id
  JOIN subject_classes sc ON sc.class_id = c.id
  JOIN subjects s ON s.id = sc.subject_id
  WHERE st.id = student_uuid
    AND (
      s.is_optional = false
      OR (s.is_optional = true AND EXISTS (
        SELECT 1
        FROM student_optional_subjects sos
        WHERE sos.student_id = student_uuid
          AND sos.subject_id = s.id
      ))
      OR (s.religion IS NOT NULL AND s.religion = st.religion)
    )
  ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_link_class_to_subjects ON classes;

CREATE TRIGGER trg_link_class_to_subjects
AFTER INSERT OR UPDATE OF education_level, department
ON classes
FOR EACH ROW
EXECUTE FUNCTION link_class_to_subjects();



ALTER TABLE results ADD COLUMN IF NOT EXISTS subject_name text;


ALTER TABLE subjects
DROP CONSTRAINT subjects_department_check



CREATE TABLE IF NOT EXISTS timetable_entries ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), day_of_week text NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday')), period_number smallint NOT NULL CHECK (period_number BETWEEN 1 AND 10), class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE, subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE SET NULL, start_time time NOT NULL, end_time time NOT NULL, created_at timestamptz DEFAULT now() ); -- prevent duplicate assignment for the same class & period CREATE UNIQUE INDEX IF NOT EXISTS uq_timetable_class_period ON timetable_entries (day_of_week, period_number, class_id); -- prevent double-booking teachers CREATE UNIQUE INDEX IF NOT EXISTS uq_timetable_teacher_period ON timetable_entries (day_of_week, period_number, teacher_id); -- RLS (match style of your existing tables) ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY; DROP POLICY IF EXISTS "Anyone can read timetable" ON timetable_entries; CREATE POLICY "Anyone can read timetable" ON timetable_entries FOR SELECT TO authenticated USING (true); DROP POLICY IF EXISTS "Admins can manage timetable" ON timetable_entries; CREATE POLICY "Admins can manage timetable" ON timetable_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE timetable_entries
ADD COLUMN department_subjects text;  -- stores 'PHY/GOV/ACC'

-- drop teacher unique index (prevents double-booking teachers)
DROP INDEX IF EXISTS uq_timetable_teacher_period;

-- drop teacher column from timetable_entries
ALTER TABLE timetable_entries DROP COLUMN IF EXISTS teacher_id;

DROP INDEX IF EXISTS uq_timetable_class_period;
ALTER TABLE timetable_entries
ADD COLUMN department text
CHECK (
  department IS NULL OR department = ANY (ARRAY['Science','Arts','Commercial'])
);
CREATE UNIQUE INDEX uq_timetable_class_period_department
ON timetable_entries (day_of_week, period_number, class_id, COALESCE(department, 'NONE'));

DROP POLICY IF EXISTS "Teachers can grade submissions"
ON assignment_submissions;

CREATE POLICY "Teachers can grade submissions"
ON assignment_submissions
FOR UPDATE
USING (
  auth.uid() = teacher_id
)
WITH CHECK (
  auth.uid() IS NOT NULL
);

ALTER TABLE assignment_submissions
DROP CONSTRAINT assignment_submissions_graded_by_fkey;

ALTER TABLE assignment_submissions
ADD CONSTRAINT assignment_submissions_graded_by_fkey
FOREIGN KEY (graded_by) REFERENCES auth.users(id)
ON DELETE SET NULL;
--- file_url column inserted to store teacher uploaded files
ALTER TABLE assignments
ADD COLUMN file_url text;
ALTER TABLE assignments
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES terms(id) ON DELETE SET NULL;
ALTER TABLE assignments
ADD CONSTRAINT assignments_session_not_empty
CHECK (session_id IS NULL OR session_id::text <> '');

ALTER TABLE assignments
ADD CONSTRAINT assignments_term_not_empty
CHECK (term_id IS NULL OR term_id::text <> '');

ALTER TABLE subject_classes
ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL;
ADD COLUMN IF NOT EXISTS subject_code text NOT NULL;

DROP INDEX IF EXISTS unique_class_per_level;

CREATE UNIQUE INDEX unique_class_per_level_stream
ON classes (education_level, level, COALESCE(stream, ''));

ALTER TABLE classes
ADD COLUMN IF NOT EXISTS stream text;

ALTER TABLE public.subject_classes
ADD COLUMN teacher_id uuid;
ADD COLUMN subject_code text NOT NULL;

ALTER TABLE public.subject_classes
ADD CONSTRAINT subject_classes_teacher_id_fkey
FOREIGN KEY (teacher_id)
REFERENCES public.teachers(id)
ON DELETE SET NULL;
ALTER TABLE subject_classes
ALTER COLUMN subject_code DROP NOT NULL;

ALTER TABLE timetable_entries
DROP COLUMN subject_id,

ALTER TABLE timetable_entries
ADD COLUMN subject_class_id uuid REFERENCES subject_classes(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX timetable_unique_slot
ON timetable_entries (day_of_week, period_number, subject_class_id);

ALTER TABLE timetable_entries
DROP COLUMN IF EXISTS department_subjects,
DROP COLUMN IF EXISTS department;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_no_duplicate_class_slot
ON timetable_entries (day_of_week, period_number, subject_class_id);

ALTER TABLE timetable_entries
ADD COLUMN class_id uuid;
UPDATE timetable_entries te
SET class_id = sc.class_id
FROM subject_classes sc
WHERE sc.id = te.subject_class_id;

ALTER TABLE timetable_entries
ADD CONSTRAINT fk_timetable_class
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;


CREATE UNIQUE INDEX IF NOT EXISTS timetable_no_double_class_slot
ON timetable_entries (day_of_week, period_number, class_id);
ALTER TABLE timetable_entries
ADD COLUMN teacher_id uuid;

UPDATE timetable_entries te
SET teacher_id = sc.teacher_id
FROM subject_classes sc
WHERE sc.id = te.subject_class_id;

ALTER TABLE timetable_entries
ADD CONSTRAINT fk_timetable_teacher
FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS timetable_no_double_teacher_slot
ON timetable_entries (day_of_week, period_number, teacher_id);

CREATE OR REPLACE FUNCTION sync_timetable_from_subject_class()
RETURNS TRIGGER AS $$
BEGIN
  SELECT class_id, teacher_id
  INTO NEW.class_id, NEW.teacher_id
  FROM subject_classes
  WHERE id = NEW.subject_class_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_timetable_subject_class ON timetable_entries;

CREATE TRIGGER trg_sync_timetable_subject_class
BEFORE INSERT OR UPDATE OF subject_class_id
ON timetable_entries
FOR EACH ROW
EXECUTE FUNCTION sync_timetable_from_subject_class();



-- =====================================================
-- SUPABASE SQL MIGRATION: Flexible Timetable System
-- =====================================================
-- This script creates a timetable system where each day 
-- can have different numbers of periods with varying durations
-- =====================================================

-- Step 1: Drop existing timetable tables if they exist
-- (Use with caution in production - backup data first!)
DROP TABLE IF EXISTS timetable_entries CASCADE;
DROP TABLE IF EXISTS period_slots CASCADE;

-- =====================================================
-- Step 2: Create the period_slots table
-- =====================================================
-- This table defines all available period slots across the week
-- Each day can have different numbers of periods with different times

CREATE TABLE period_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
    period_number INTEGER NOT NULL CHECK (period_number > 0),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_break BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure no duplicate period numbers per day
    CONSTRAINT unique_day_period UNIQUE (day_of_week, period_number),
    
    -- Ensure end time is after start time
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Add index for faster queries
CREATE INDEX idx_period_slots_day ON period_slots(day_of_week);
CREATE INDEX idx_period_slots_day_period ON period_slots(day_of_week, period_number);

-- Add comment
COMMENT ON TABLE period_slots IS 'Defines all period time slots for each day of the week. Each day can have different numbers of periods with varying durations.';

-- =====================================================
-- Step 3: Create the timetable_entries table
-- =====================================================
-- Links classes to subjects for specific period slots

CREATE TABLE timetable_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    period_slot_id UUID NOT NULL REFERENCES period_slots(id) ON DELETE CASCADE,
    subject_class_id UUID REFERENCES subject_classes(id) ON DELETE SET NULL,
    department TEXT CHECK (department IN ('Science', 'Arts', 'Commercial', NULL)),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate entries for the same class and period slot
    -- Unless it's departmental mode (different departments can share same slot)
    CONSTRAINT unique_class_period_dept UNIQUE (class_id, period_slot_id, department)
);

-- Add indexes for performance
CREATE INDEX idx_timetable_class ON timetable_entries(class_id);
CREATE INDEX idx_timetable_period_slot ON timetable_entries(period_slot_id);
CREATE INDEX idx_timetable_subject_class ON timetable_entries(subject_class_id);

-- Add comment
COMMENT ON TABLE timetable_entries IS 'Maps classes to subjects for specific period slots. Supports departmental mode for senior classes.';

-- =====================================================
-- Step 4: Create trigger for updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_period_slots_updated_at
    BEFORE UPDATE ON period_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timetable_entries_updated_at
    BEFORE UPDATE ON timetable_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Step 5: Seed default period slots
-- =====================================================
-- Example: Monday-Thursday (11 periods × 40 min), Friday (8 periods × 30 min)

-- MONDAY: 11 periods × 40 minutes (8:00 AM - 3:20 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Monday', 1, '08:00', '08:40', false),
('Monday', 2, '08:40', '09:20', false),
('Monday', 3, '09:20', '10:00', false),
('Monday', 4, '10:00', '10:40', false),
('Monday', 5, '10:40', '11:20', false),
('Monday', 6, '11:20', '12:00', true),  -- break
('Monday', 7, '12:00', '12:40', false),
('Monday', 8, '12:40', '13:20', false),
('Monday', 9, '13:20', '14:00', false),
('Monday', 10, '14:00', '14:15', true), -- short break
('Monday', 11, '14:15', '14:50', false), -- 35 minutes each till 4:00 PM
('Monday', 12, '14:50', '15:25', false),
('Monday', 13, '15:25', '16:00', false);

-- TUESDAY: 11 periods × 40 minutes (8:00 AM - 3:20 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Tuesday', 1, '08:00', '08:40', false),
('Tuesday', 2, '08:40', '09:20', false),
('Tuesday', 3, '09:20', '10:00', false),
('Tuesday', 4, '10:00', '10:40', false),
('Tuesday', 5, '10:40', '11:20', false),
('Tuesday', 6, '11:20', '12:00', true),  -- break
('Tuesday', 7, '12:00', '12:40', false),
('Tuesday', 8, '12:40', '13:20', false),
('Tuesday', 9, '13:20', '14:00', false),
('Tuesday', 10, '14:00', '14:15', true), -- short break
('Tuesday', 11, '14:15', '14:50', false), -- 35 minutes each till 4:00 PM
('Tuesday', 12, '14:50', '15:25', false),
('Tuesday', 13, '15:25', '16:00', false);
-- WEDNESDAY: 11 periods × 40 minutes (8:00 AM - 3:20 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Wednesday', 1, '08:00', '08:40', false),
('Wednesday', 2, '08:40', '09:20', false),
('Wednesday', 3, '09:20', '10:00', false),
('Wednesday', 4, '10:00', '10:40', false),
('Wednesday', 5, '10:40', '11:20', false),
('Wednesday', 6, '11:20', '12:00', true),  -- break
('Wednesday', 7, '12:00', '12:40', false),
('Wednesday', 8, '12:40', '13:20', false),
('Wednesday', 9, '13:20', '14:00', false),
('Wednesday', 10, '14:00', '14:15', true), -- short break
('Wednesday', 11, '14:15', '14:50', false), -- 35 minutes each till 4:00 PM
('Wednesday', 12, '14:50', '15:25', false),
('Wednesday', 13, '15:25', '16:00', false);
-- THURSDAY: 11 periods × 40 minutes (8:00 AM - 3:20 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Thursday', 1, '08:00', '08:40', false),
('Thursday', 2, '08:40', '09:20', false),
('Thursday', 3, '09:20', '10:00', false),
('Thursday', 4, '10:00', '10:40', false),
('Thursday', 5, '10:40', '11:20', false),
('Thursday', 6, '11:20', '12:00', true),  -- break
('Thursday', 7, '12:00', '12:40', false),
('Thursday', 8, '12:40', '13:20', false),
('Thursday', 9, '13:20', '14:00', false),
('Thursday', 10, '14:00', '14:15', true), -- short break
('Thursday', 11, '14:15', '14:50', false), -- 35 minutes each till 4:00 PM
('Thursday', 12, '14:50', '15:25', false),
('Thursday', 13, '15:25', '16:00', false);
-- FRIDAY: 8 periods × 30 minutes (8:00 AM - 12:30 PM)
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time, is_break) VALUES
('Friday', 1, '08:00', '08:30', false),
('Friday', 2, '08:30', '09:00', false),
('Friday', 3, '09:00', '09:30', false),
('Friday', 4, '09:30', '10:00', false),
('Friday', 5, '10:00', '10:30', false),
('Friday', 6, '10:30', '11:00', true),  -- break
('Friday', 7, '11:00', '11:30', false),
('Friday', 8, '11:30', '12:00', false),
('Friday', 9, '12:00', '12:30', false);




ALTER TABLE period_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Step 7: Create RLS Policies
-- =====================================================

-- Period Slots Policies
-- Allow all authenticated users to read period slots
CREATE POLICY "Anyone can view period slots"
    ON period_slots FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can insert/update/delete period slots
CREATE POLICY "Admins can insert period slots"
    ON period_slots FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can update period slots"
    ON period_slots FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can delete period slots"
    ON period_slots FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Timetable Entries Policies
-- Allow all authenticated users to read timetable entries
CREATE POLICY "Anyone can view timetable entries"
    ON timetable_entries FOR SELECT
    TO authenticated
    USING (true);

-- Only admins can insert/update/delete timetable entries
CREATE POLICY "Admins can insert timetable entries"
    ON timetable_entries FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can update timetable entries"
    ON timetable_entries FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can delete timetable entries"
    ON timetable_entries FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- =====================================================
-- Step 8: Create helpful views (optional)
-- =====================================================

-- View to see complete timetable with all relations
CREATE OR REPLACE VIEW v_complete_timetable AS
SELECT 
    te.id,
    te.class_id,
    c.name AS class_name,
    c.level AS class_level,
    ps.day_of_week,
    ps.period_number,
    ps.start_time,
    ps.end_time,
    ps.is_break,
    ps.duration_minutes,
    te.subject_class_id,
    te.department,
    sc.subject_code,
    s.name AS subject_name,
    s.department AS subject_department,
    t.first_name AS teacher_first_name,
    t.last_name AS teacher_last_name,
    t.first_name || ' ' || t.last_name AS teacher_full_name
FROM timetable_entries te
JOIN period_slots ps ON te.period_slot_id = ps.id
JOIN classes c ON te.class_id = c.id
LEFT JOIN subject_classes sc ON te.subject_class_id = sc.id
LEFT JOIN subjects s ON sc.subject_id = s.id
LEFT JOIN teachers t ON sc.teacher_id = t.id
ORDER BY c.name, ps.day_of_week, ps.period_number;

-- Grant access to the view
GRANT SELECT ON v_complete_timetable TO authenticated;

-- =====================================================
-- Step 9: Create helper functions (optional)
-- =====================================================

-- Function to check for teacher conflicts
CREATE OR REPLACE FUNCTION check_teacher_conflict(
    p_period_slot_id UUID,
    p_subject_class_id UUID,
    p_exclude_entry_id UUID DEFAULT NULL
)
RETURNS TABLE (
    conflict_exists BOOLEAN,
    conflict_teacher_name TEXT,
    conflict_class_name TEXT,
    conflict_subject_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        TRUE AS conflict_exists,
        t.first_name || ' ' || t.last_name AS conflict_teacher_name,
        c.name AS conflict_class_name,
        s.name AS conflict_subject_name
    FROM timetable_entries te
    JOIN subject_classes sc1 ON te.subject_class_id = sc1.id
    JOIN subject_classes sc2 ON sc2.id = p_subject_class_id
    JOIN classes c ON te.class_id = c.id
    JOIN subjects s ON sc1.subject_id = s.id
    JOIN teachers t ON sc1.teacher_id = t.id
    WHERE te.period_slot_id = p_period_slot_id
        AND sc1.teacher_id = sc2.teacher_id
        AND (p_exclude_entry_id IS NULL OR te.id != p_exclude_entry_id)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

UPDATE subject_classes sc
SET subject_code = 'CHEM-' || c.name
FROM subjects s, classes c
WHERE sc.subject_id = s.id
  AND sc.class_id = c.id
  AND s.name ILIKE 'chemistry';


-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- To verify the setup, run these queries:
-- SELECT * FROM period_slots ORDER BY day_of_week, period_number;
-- SELECT * FROM v_complete_timetable;
-- SELECT day_of_week, COUNT(*) as period_count FROM period_slots GROUP BY day_of_week;