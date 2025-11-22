/*
  # Update Subjects for Level-Based Assignment

  ## Changes
  1. Subjects are now assigned to education levels, not individual classes
  2. Each subject-education_level-department combination is unique
  3. Drop subject_classes table (no longer needed)
  4. Add unique constraint to prevent duplicates
  
  ## Important Notes
  - Subjects automatically apply to ALL classes under their education level
  - For SSS, subjects are also department-specific
  - No duplicate subjects allowed per level/department
  
  ## Security
  - Maintain existing RLS policies
*/

-- Drop the subject_classes junction table (no longer needed)
DROP TABLE IF EXISTS subject_classes CASCADE;

-- Add unique constraint to prevent duplicate subjects per level/department
-- Drop existing constraint if it exists
DO $$
BEGIN
  ALTER TABLE subjects DROP CONSTRAINT IF EXISTS unique_subject_per_level_department;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create unique constraint
-- For non-SSS subjects: unique by (name, education_level)
-- For SSS subjects: unique by (name, education_level, department)
CREATE UNIQUE INDEX IF NOT EXISTS unique_subject_per_level_department 
ON subjects (name, education_level, COALESCE(department, ''));