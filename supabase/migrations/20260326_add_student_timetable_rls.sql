-- Add RLS policies for students to view their timetable

-- ==================== TIMETABLE_ENTRIES ====================
DROP POLICY IF EXISTS "Students can read timetable for their class" ON timetable_entries;
DROP POLICY IF EXISTS "Teachers can manage timetable entries" ON timetable_entries;

CREATE POLICY "Students can read timetable for their class"
  ON timetable_entries FOR SELECT
  TO authenticated
  USING (
    -- User is a student in this class
    class_id IN (
      SELECT class_id FROM students 
      WHERE user_id = auth.uid() AND school_id = timetable_entries.school_id
    )
    AND school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage timetable entries"
  ON timetable_entries FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (is_teacher() AND school_id = get_my_school_id())
    OR (is_admin() AND school_id = get_my_school_id())
  )
  WITH CHECK (
    is_super_admin()
    OR (is_teacher() AND school_id = get_my_school_id())
    OR (is_admin() AND school_id = get_my_school_id())
  );

-- ==================== PERIOD_SLOTS ====================
DROP POLICY IF EXISTS "Students can read period slots for their school" ON period_slots;
DROP POLICY IF EXISTS "Admins can manage period slots" ON period_slots;

CREATE POLICY "Students can read period slots for their school"
  ON period_slots FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage period slots"
  ON period_slots FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
  )
  WITH CHECK (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
  );

-- ==================== SUBJECT_CLASSES ====================
DROP POLICY IF EXISTS "Students can read subject classes for their class" ON subject_classes;
DROP POLICY IF EXISTS "Teachers and admins can manage subject classes" ON subject_classes;

CREATE POLICY "Students can read subject classes for their class"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
    AND id IN (
      -- Subject classes that are assigned to the student's class
      SELECT sc.id FROM subject_classes sc
      JOIN timetable_entries te ON te.subject_class_id = sc.id
      WHERE te.class_id IN (
        SELECT class_id FROM students WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Teachers and admins can manage subject classes"
  ON subject_classes FOR ALL
  TO authenticated
  USING (
    is_super_admin()
    OR (is_teacher() AND school_id = get_my_school_id())
    OR (is_admin() AND school_id = get_my_school_id())
  )
  WITH CHECK (
    is_super_admin()
    OR (is_teacher() AND school_id = get_my_school_id())
    OR (is_admin() AND school_id = get_my_school_id())
  );

-- ==================== STUDENT_SUBJECTS ====================
-- Students should already be able to read their own subject enrollments
-- Verify this policy exists
DROP POLICY IF EXISTS "Students can read their own subject enrollments" ON student_subjects;

CREATE POLICY "Students can read their own subject enrollments"
  ON student_subjects FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

COMMIT;
