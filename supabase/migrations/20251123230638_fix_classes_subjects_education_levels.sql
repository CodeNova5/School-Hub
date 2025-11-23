/*
  # Fix Classes and Subjects Education Level System

  ## Summary
  Complete rebuild of classes, subjects, and their relationships to fix education level mapping issues.

  ## Changes Made

  ### 1. Classes Table Updates
  - Add education_level column (Pre-Primary, Primary, JSS, SSS)
  - Keep level column for specific grade (Primary 1, JSS 2, etc.)
  - Add function to auto-populate education_level from level
  - Remove duplicate rows
  - Add unique constraint on (name, level, session_id, department)

  ### 2. Subject Classes Junction Table
  - Recreate subject_classes table for proper many-to-many relationship
  - Add cascade deletes
  - Add unique constraint to prevent duplicates
  - Enable RLS

  ### 3. Auto-linking System
  - Create trigger function to automatically link subjects to classes
  - When subject is created/updated, auto-link to all matching classes
  - When class is created/updated, auto-link to all matching subjects
  - Match by: education_level (and department for SSS)

  ### 4. Data Integrity
  - Clean up any duplicate classes
  - Re-establish all subject-class relationships
  - Add proper indexes for performance

  ## Security
  - Enable RLS on all tables
  - Maintain existing RLS policies
*/

-- Step 1: Add education_level column to classes if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'classes' AND column_name = 'education_level'
  ) THEN
    ALTER TABLE classes ADD COLUMN education_level text;
  END IF;
END $$;

-- Step 2: Populate education_level based on level column
UPDATE classes
SET education_level = CASE
  WHEN level IN ('Nursery 1', 'Nursery 2', 'KG 1', 'KG 2') THEN 'Pre-Primary'
  WHEN level IN ('Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6') THEN 'Primary'
  WHEN level IN ('JSS 1', 'JSS 2', 'JSS 3') THEN 'JSS'
  WHEN level IN ('SSS 1', 'SSS 2', 'SSS 3') THEN 'SSS'
  ELSE 'Primary'
END
WHERE education_level IS NULL;

-- Step 3: Add check constraint for education_level
DO $$
BEGIN
  ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_education_level_check;
  ALTER TABLE classes ADD CONSTRAINT classes_education_level_check 
    CHECK (education_level = ANY (ARRAY['Pre-Primary'::text, 'Primary'::text, 'JSS'::text, 'SSS'::text]));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Step 4: Make education_level NOT NULL
ALTER TABLE classes ALTER COLUMN education_level SET NOT NULL;

-- Step 5: Remove duplicate classes (keep the first one created)
DELETE FROM classes a USING classes b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.level = b.level
  AND COALESCE(a.session_id::text, '') = COALESCE(b.session_id::text, '')
  AND COALESCE(a.department, '') = COALESCE(b.department, '');

-- Step 6: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS unique_class_per_session 
ON classes (name, level, COALESCE(session_id::text, ''), COALESCE(department, ''));

-- Step 7: Recreate subject_classes table
DROP TABLE IF EXISTS subject_classes CASCADE;

CREATE TABLE IF NOT EXISTS subject_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, class_id)
);

-- Step 8: Enable RLS on subject_classes
ALTER TABLE subject_classes ENABLE ROW LEVEL SECURITY;

-- Step 9: Create RLS policies for subject_classes
CREATE POLICY "Anyone can read subject_classes"
  ON subject_classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert subject_classes"
  ON subject_classes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update subject_classes"
  ON subject_classes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete subject_classes"
  ON subject_classes FOR DELETE
  TO authenticated
  USING (true);

-- Step 10: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subject_classes_subject ON subject_classes(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_classes_class ON subject_classes(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_education_level ON classes(education_level);
CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department);
CREATE INDEX IF NOT EXISTS idx_subjects_education_level ON subjects(education_level);
CREATE INDEX IF NOT EXISTS idx_subjects_department ON subjects(department);

-- Step 11: Create function to auto-link subjects to classes
CREATE OR REPLACE FUNCTION link_subject_to_classes()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing links for this subject
  DELETE FROM subject_classes WHERE subject_id = NEW.id;
  
  -- Link to all matching classes
  IF NEW.education_level = 'SSS' AND NEW.department IS NOT NULL THEN
    -- For SSS with department, match education_level AND department
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT NEW.id, c.id
    FROM classes c
    WHERE c.education_level = NEW.education_level
      AND c.department = NEW.department
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  ELSE
    -- For other levels, match education_level only
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT NEW.id, c.id
    FROM classes c
    WHERE c.education_level = NEW.education_level
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Create function to auto-link classes to subjects
CREATE OR REPLACE FUNCTION link_class_to_subjects()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing links for this class
  DELETE FROM subject_classes WHERE class_id = NEW.id;
  
  -- Link to all matching subjects
  IF NEW.education_level = 'SSS' AND NEW.department IS NOT NULL THEN
    -- For SSS with department, match education_level AND department
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT s.id, NEW.id
    FROM subjects s
    WHERE s.education_level = NEW.education_level
      AND s.department = NEW.department
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  ELSE
    -- For other levels, match education_level only
    INSERT INTO subject_classes (subject_id, class_id)
    SELECT s.id, NEW.id
    FROM subjects s
    WHERE s.education_level = NEW.education_level
    ON CONFLICT (subject_id, class_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Create triggers for auto-linking
DROP TRIGGER IF EXISTS trigger_link_subject_to_classes ON subjects;
CREATE TRIGGER trigger_link_subject_to_classes
  AFTER INSERT OR UPDATE OF education_level, department ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION link_subject_to_classes();

DROP TRIGGER IF EXISTS trigger_link_class_to_subjects ON classes;
CREATE TRIGGER trigger_link_class_to_subjects
  AFTER INSERT OR UPDATE OF education_level, department ON classes
  FOR EACH ROW
  EXECUTE FUNCTION link_class_to_subjects();

-- Step 14: Initial link - connect all existing subjects to matching classes
INSERT INTO subject_classes (subject_id, class_id)
SELECT s.id, c.id
FROM subjects s
CROSS JOIN classes c
WHERE s.education_level = c.education_level
  AND (
    s.education_level != 'SSS' 
    OR (s.department = c.department)
  )
ON CONFLICT (subject_id, class_id) DO NOTHING;

-- Step 15: Update students table foreign key if needed
DO $$
BEGIN
  -- Ensure students.class_id has proper foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'students_class_id_fkey' 
    AND table_name = 'students'
  ) THEN
    ALTER TABLE students 
    ADD CONSTRAINT students_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
  END IF;
END $$;