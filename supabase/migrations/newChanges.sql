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

ALTER TABLE timetable_entries
DROP COLUMN IF EXISTS start_time,
DROP COLUMN IF EXISTS end_time;

ALTER TABLE timetable_entries
ADD COLUMN IF NOT EXISTS day_of_week text NOT NULL,
ADD COLUMN IF NOT EXISTS period_number smallint NOT NULL;

ALTER TABLE timetable_entries
ADD CONSTRAINT fk_timetable_slot
FOREIGN KEY (day_of_week, period_number)
REFERENCES period_slots(day_of_week, period_number)
ON DELETE RESTRICT;

ALTER TABLE timetable_entries
ADD CONSTRAINT timetable_must_use_real_slot
FOREIGN KEY (day_of_week, period_number)
REFERENCES period_slots(day_of_week, period_number);

CREATE TABLE period_slots (
  id serial PRIMARY KEY,
  day_of_week text NOT NULL,
  period_number smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  UNIQUE(day_of_week, period_number)
);
INSERT INTO period_slots (day_of_week, period_number, start_time, end_time) VALUES
('Monday', 1, '08:00', '08:40'),
('Monday', 2, '08:40', '09:20'),
('Monday', 3, '09:20', '10:00'),
('Monday', 4, '10:00', '10:40'),
('Monday', 5, '10:40', '11:20'),
('Monday', 6, '12:00', '12:40'),
('Monday', 7, '12:40', '13:20'),
('Monday', 8, '13:20', '14:00'),
('Monday', 9, '14:15', '14:50'),
('Monday', 10, '14:50', '15:25'),
('Monday', 11, '15:25', '16:00'),
('Tuesday', 1, '08:00', '08:40'),
('Tuesday', 2, '08:40', '09:20'),
('Tuesday', 3, '09:20', '10:00'),
('Tuesday', 4, '10:00', '10:40'),
('Tuesday', 5, '10:40', '11:20'),
('Tuesday', 6, '12:00', '12:40'),
('Tuesday', 7, '12:40', '13:20'),
('Tuesday', 8, '13:20', '14:00'),
('Tuesday', 9, '14:15', '14:50'),
('Tuesday', 10, '14:50', '15:25'),
('Tuesday', 11, '15:25', '16:00'),
('Wednesday', 1, '08:00', '08:40'),
('Wednesday', 2, '08:40', '09:20'),
('Wednesday', 3, '09:20', '10:00'),
('Wednesday', 4, '10:00', '10:40'),
('Wednesday', 5, '10:40', '11:20'),
('Wednesday', 6, '12:00', '12:40'),
('Wednesday', 7, '12:40', '13:20'),
('Wednesday', 8, '13:20', '14:00'),
('Wednesday', 9, '14:15', '14:50'),
('Wednesday', 10, '14:50', '15:25'),
('Wednesday', 11, '15:25', '16:00'),
('Thursday', 1, '08:00', '08:40'),
('Thursday', 2, '08:40', '09:20'),
('Thursday', 3, '09:20', '10:00'),
('Thursday', 4, '10:00', '10:40'),
('Thursday', 5, '10:40', '11:20'),
('Thursday', 6, '12:00', '12:40'),
('Thursday', 7, '12:40', '13:20'),
('Thursday', 8, '13:20', '14:00'),
('Thursday', 9, '14:15', '14:50'),
('Thursday', 10, '14:50', '15:25'),
('Thursday', 11, '15:25', '16:00'),
('Friday', 1, '08:00', '08:40'),
('Friday', 2, '08:40', '09:20'),
('Friday', 3, '09:20', '10:00'),
('Friday', 4, '10:00', '10:40'),
('Friday', 5, '10:40', '11:20'),
('Friday', 6, '12:00', '12:40'),
('Friday', 7, '12:40', '13:20'),
('Friday', 8, '13:20', '14:00'),
('Friday', 9, '14:15', '14:50'),
('Friday', 10, '14:50', '15:25'),
('Friday', 11, '15:25', '16:00');