-- Add RLS policy to allow students to submit assignments
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing incomplete policies if any
DROP POLICY IF EXISTS "Students can submit assignments" ON assignment_submissions;

-- New policy: Students can insert their own submissions
CREATE POLICY "Students can submit assignments"
  ON assignment_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be a student
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
    -- Submission must be for the same school as the student
    AND school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

-- Students can also update their own submissions (for re-submissions)
CREATE POLICY "Students can update their own submissions"
  ON assignment_submissions FOR UPDATE
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
    AND school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
    AND school_id IN (
      SELECT school_id FROM students WHERE user_id = auth.uid()
    )
  );

COMMIT;
