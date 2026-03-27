-- Fix infinite recursion in subject_classes RLS policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Students can read subject classes for their class" ON subject_classes;

-- Replace with simpler policy that doesn't cause recursion
-- Students can read subject_classes for their school
-- The timetable_entries policy will handle filtering by class
CREATE POLICY "Students can read subject classes"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (
    school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

COMMIT;
