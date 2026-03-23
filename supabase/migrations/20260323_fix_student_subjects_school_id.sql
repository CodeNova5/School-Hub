-- Fix student_subjects RLS by ensuring school_id is always populated
-- This resolves PGRST200 errors when joining student_subjects with subject_classes

-- 1. Update existing null school_id values from student records
UPDATE student_subjects ss
SET school_id = s.school_id
FROM students s
WHERE ss.school_id IS NULL
AND s.id = ss.student_id;

-- 2. Make school_id NOT NULL and add constraint
ALTER TABLE student_subjects 
  ALTER COLUMN school_id SET NOT NULL;

-- 3. Create trigger to auto-populate school_id on insert
CREATE OR REPLACE FUNCTION populate_student_subjects_school_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Get school_id from the student record
  SELECT school_id INTO NEW.school_id
  FROM students
  WHERE id = NEW.student_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_populate_student_subjects_school_id ON student_subjects;

CREATE TRIGGER trigger_populate_student_subjects_school_id
  BEFORE INSERT ON student_subjects
  FOR EACH ROW
  EXECUTE FUNCTION populate_student_subjects_school_id();

-- 4. Grant necessary permissions to the trigger function
GRANT EXECUTE ON FUNCTION populate_student_subjects_school_id() TO authenticated;
