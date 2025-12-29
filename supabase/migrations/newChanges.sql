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
  -- Clear previous links
  DELETE FROM subject_classes WHERE class_id = NEW.id;

  -- SSS classes link by department
  IF NEW.education_level = 'SSS' AND NEW.department IS NOT NULL THEN
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT s.id, NEW.id
    FROM subjects s
    WHERE s.education_level = NEW.education_level
      AND (s.department = NEW.department OR s.department IS NULL)
      AND s.religion IS NULL;  -- CRS/IRS excluded
  ELSE
    -- Lower levels link by education level only (religion excluded)
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT s.id, NEW.id
    FROM subjects s
    WHERE s.education_level = NEW.education_level
      AND s.religion IS NULL;  -- CRS/IRS excluded
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_student_subjects(student_uuid uuid)
RETURNS TABLE(
  subject_id uuid,
  name text
) AS $$
BEGIN
  RETURN QUERY

  -- 1. Class subjects (Math, English, etc.)
  SELECT s.id, s.name
  FROM students st
  JOIN classes c ON c.id = st.class_id
  JOIN subject_classes sc ON sc.class_id = c.id
  JOIN subjects s ON s.id = sc.subject_id
  WHERE st.id = student_uuid

  UNION

  -- 2. Religion subjects (CRS / IRS)
  SELECT s.id, s.name
  FROM students st
  JOIN subjects s ON s.religion = st.religion
  WHERE st.id = student_uuid

  UNION

  -- 3. Optional subjects selected by student
  SELECT s.id, s.name
  FROM student_optional_subjects sos
  JOIN subjects s ON s.id = sos.subject_id
  WHERE sos.student_id = student_uuid;

END;
$$ LANGUAGE plpgsql;

ALTER TABLE results ADD COLUMN IF NOT EXISTS subject_name text;


ALTER TABLE subjects
DROP CONSTRAINT subjects_department_check


CREATE OR REPLACE FUNCTION set_timetable_times()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  p integer := NEW.period_number;
BEGIN
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    CASE p
      WHEN 1 THEN NEW.start_time := '08:00'::time; NEW.end_time := '08:40'::time;
      WHEN 2 THEN NEW.start_time := '08:40'::time; NEW.end_time := '09:20'::time;
      WHEN 3 THEN NEW.start_time := '09:20'::time; NEW.end_time := '10:00'::time;
      WHEN 4 THEN NEW.start_time := '10:00'::time; NEW.end_time := '10:40'::time;
      WHEN 5 THEN NEW.start_time := '10:40'::time; NEW.end_time := '11:20'::time;
      WHEN 6 THEN NEW.start_time := '12:00'::time; NEW.end_time := '12:40'::time;
      WHEN 7 THEN NEW.start_time := '12:40'::time; NEW.end_time := '13:20'::time;
      WHEN 8 THEN NEW.start_time := '13:20'::time; NEW.end_time := '14:00'::time;
      WHEN 9 THEN NEW.start_time := '14:15'::time; NEW.end_time := '14:50'::time;
      WHEN 10 THEN NEW.start_time := '14:50'::time; NEW.end_time := '15:25'::time;
      WHEN 11 THEN NEW.start_time := '15:25'::time; NEW.end_time := '16:00'::time;
      ELSE RAISE EXCEPTION 'Invalid period number %', p;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-create the trigger to use the new function
DROP TRIGGER IF EXISTS trg_set_timetable_times ON timetable_entries;
CREATE TRIGGER trg_set_timetable_times
BEFORE INSERT OR UPDATE ON timetable_entries
FOR EACH ROW
EXECUTE FUNCTION set_timetable_times();



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
