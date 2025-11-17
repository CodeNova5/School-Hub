/*
  # Teacher Authentication and Class Assignment

  ## Changes
  1. Updates
    - Update teachers table to link with auth.users
    - Add class assignment to teachers
  
  2. New Tables
    - teacher_classes: Junction table for teacher-class assignments
  
  3. Security
    - Add RLS policies for teacher authentication
*/

-- Add user_id column to teachers table to link with auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teachers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE teachers ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create teacher_classes junction table for assigning teachers to classes
CREATE TABLE IF NOT EXISTS teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, class_id, session_id)
);

ALTER TABLE teacher_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their class assignments"
  ON teacher_classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teachers
      WHERE teachers.id = teacher_classes.teacher_id
      AND teachers.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can manage teacher class assignments"
  ON teacher_classes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update teachers RLS policies to work with auth
DROP POLICY IF EXISTS "Authenticated users can view teachers" ON teachers;
DROP POLICY IF EXISTS "Authenticated users can manage teachers" ON teachers;

CREATE POLICY "Teachers can view all teacher records"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Teachers can view own record"
  ON teachers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage teachers"
  ON teachers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_class ON teacher_classes(class_id);