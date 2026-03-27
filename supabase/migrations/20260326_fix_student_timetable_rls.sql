-- Fix RLS policies for student timetable access by simplifying nested relation queries

-- ==================== FIX: SUBJECT_CLASSES ====================
-- The previous policy had a complex join that doesn't work well with RLS composition.
-- New approach: Trust the timetable_entries RLS policy and allow subject_classes if in the student's school

DROP POLICY IF EXISTS "Students can read subject classes for their class" ON subject_classes;

CREATE POLICY "Students can read subject classes for their school"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

-- ==================== FIX: SUBJECTS ====================
-- Students should be able to read subjects from their school
DROP POLICY IF EXISTS "Students can read subjects" ON subjects;

CREATE POLICY "Students can read subjects for their school"
  ON subjects FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

-- ==================== FIX: TEACHERS ====================
-- Students should be able to read teachers from their school
DROP POLICY IF EXISTS "Students can read teachers" ON teachers;

CREATE POLICY "Students can read teachers for their school"
  ON teachers FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

COMMIT;
