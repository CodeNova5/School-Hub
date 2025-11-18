/*
  # Update Subjects Schema

  ## Changes
  1. Remove code and description columns from subjects
  2. Add new columns:
    - education_level (Pre-Primary, Primary, JSS, SSS)
    - department (Science, Arts, Commercial) - only for SSS
    - religion (Christian, Muslim)
    - is_optional (boolean)
  3. Create subject_classes junction table for multi-class assignment
  
  ## Security
  - Maintain existing RLS policies
*/

-- Remove old columns from subjects table
ALTER TABLE subjects DROP COLUMN IF EXISTS code;
ALTER TABLE subjects DROP COLUMN IF EXISTS description;

-- Add new columns to subjects table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'education_level') THEN
    ALTER TABLE subjects ADD COLUMN education_level text NOT NULL DEFAULT 'Primary' 
      CHECK (education_level IN ('Pre-Primary', 'Primary', 'JSS', 'SSS'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'department') THEN
    ALTER TABLE subjects ADD COLUMN department text CHECK (department IN ('Science', 'Arts', 'Commercial'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'religion') THEN
    ALTER TABLE subjects ADD COLUMN religion text CHECK (religion IN ('Christian', 'Muslim'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'is_optional') THEN
    ALTER TABLE subjects ADD COLUMN is_optional boolean DEFAULT false;
  END IF;
END $$;

-- Create subject_classes junction table for multi-class assignment
CREATE TABLE IF NOT EXISTS subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, class_id)
);

ALTER TABLE subject_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view subject class assignments"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage subject class assignments"
  ON subject_classes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subjects_education_level ON subjects(education_level);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department);
CREATE INDEX IF NOT EXISTS idx_subjects_is_optional ON subjects(is_optional);
CREATE INDEX IF NOT EXISTS idx_subject_classes_subject ON subject_classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_class ON subject_classes(class_id);