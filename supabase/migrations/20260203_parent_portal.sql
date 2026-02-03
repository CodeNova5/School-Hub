-- Create parents table
CREATE TABLE IF NOT EXISTS parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  activation_token_hash TEXT,
  activation_expires_at TIMESTAMPTZ,
  activation_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);
CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_activation_token ON parents(activation_token_hash);

-- Enable RLS
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parents table
-- Parents can read their own data
CREATE POLICY "Parents can read own data"
  ON parents
  FOR SELECT
  USING (auth.uid() = user_id);

-- Parents can update their own data
CREATE POLICY "Parents can update own data"
  ON parents
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can do everything
CREATE POLICY "Admins can manage parents"
  ON parents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Service role can insert (for registration)
CREATE POLICY "Service role can insert parents"
  ON parents
  FOR INSERT
  WITH CHECK (true);

-- Update students table RLS to allow parents to view their children
CREATE POLICY "Parents can view their children"
  ON students
  FOR SELECT
  USING (
    parent_email IN (
      SELECT email FROM parents WHERE user_id = auth.uid()
    )
  );

-- Allow parents to view attendance for their children
CREATE POLICY "Parents can view children attendance"
  ON attendance
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

-- Allow parents to view results for their children
CREATE POLICY "Parents can view children results"
  ON results
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

-- Allow parents to view assignments for their children
CREATE POLICY "Parents can view children assignments"
  ON assignments
  FOR SELECT
  USING (
    subject_id IN (
      SELECT sc.subject_id
      FROM student_subjects ss
      JOIN subject_classes sc ON sc.id = ss.subject_class_id
      WHERE ss.student_id IN (
        SELECT id FROM students
        WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Allow parents to view assignment submissions for their children
CREATE POLICY "Parents can view children submissions"
  ON assignment_submissions
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );
-- Create/Replace policy: Parents can view children timetable (using timetable_entries)
CREATE POLICY "Parents can view children timetable"
  ON public.timetable_entries
  FOR SELECT
  USING (
    class_id IN (
      SELECT class_id FROM public.students
      WHERE parent_email IN (
        SELECT email FROM public.parents WHERE user_id = auth.uid()
      )
    )
  );

-- Create/Replace policy: Parents can view children teachers (via subject_classes)
CREATE POLICY "Parents can view children teachers"
  ON public.teachers
  FOR SELECT
  USING (
    id IN (
      SELECT sc.teacher_id
      FROM public.timetable_entries te
      JOIN public.subject_classes sc ON sc.id = te.subject_class_id
      WHERE te.class_id IN (
        SELECT class_id FROM public.students
        WHERE parent_email IN (
          SELECT email FROM public.parents WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Allow parents to view subjects their children are enrolled in
CREATE POLICY "Parents can view children subjects"
  ON student_subjects
  FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

-- Allow parents to view classes their children are in
CREATE POLICY "Parents can view children classes"
  ON classes
  FOR SELECT
  USING (
    id IN (
      SELECT class_id FROM students
      WHERE parent_email IN (
        SELECT email FROM parents WHERE user_id = auth.uid()
      )
    )
  );

-- Allow parents to view subjects metadata
CREATE POLICY "Parents can view subjects"
  ON subjects
  FOR SELECT
  USING (
    id IN (
      SELECT sc.subject_id
      FROM student_subjects ss
      JOIN subject_classes sc ON sc.id = ss.subject_class_id
      WHERE ss.student_id IN (
        SELECT id FROM students
        WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Allow parents to view teachers teaching their children
CREATE POLICY "Parents can view children teachers"
  ON teachers
  FOR SELECT
  USING (
    id IN (
      SELECT sc.teacher_id
      FROM timetable_entries te
      JOIN subject_classes sc ON sc.id = te.subject_class_id
      WHERE te.class_id IN (
        SELECT class_id FROM students
        WHERE parent_email IN (
          SELECT email FROM parents WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Add parent role to user_roles if not exists
INSERT INTO user_roles (user_id, role)
SELECT user_id, 'parent'
FROM parents
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = parents.user_id
  AND user_roles.role = 'parent'
);

COMMENT ON TABLE parents IS 'Stores parent/guardian information with activation tokens';
COMMENT ON COLUMN parents.activation_token_hash IS 'SHA-256 hash of activation token';
COMMENT ON COLUMN parents.activation_expires_at IS 'Expiration time for activation token';
COMMENT ON COLUMN parents.activation_used IS 'Whether activation token has been used';

-- Add a column to the `results` table to indicate visibility to parents
ALTER TABLE results
ADD COLUMN is_visible_to_parents BOOLEAN DEFAULT FALSE;

-- Update existing results to make them invisible to parents by default
UPDATE results
SET is_visible_to_parents = FALSE;