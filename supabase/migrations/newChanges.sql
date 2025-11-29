ALTER TABLE students
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