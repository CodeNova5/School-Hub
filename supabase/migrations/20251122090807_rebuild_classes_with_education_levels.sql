/*
  # Rebuild Classes Schema with Education Levels

  ## Changes
  1. Updates to classes table
    - Ensure level column exists with proper constraints
    - Add capacity field for class size
    - Add room_number field
    - Add class_teacher_id field (link to teachers)
    - Add academic_year field
    - Add department field (for SSS classes)
    - Add stream field (for multiple streams of same class)
  
  ## Important Notes
  - Education levels: Pre-Primary, Primary, JSS, SSS
  - Pre-Primary: Nursery 1, Nursery 2, KG 1, KG 2
  - Primary: Primary 1-6
  - JSS: JSS 1-3
  - SSS: SSS 1-3 (with departments: Science, Arts, Commercial)
  
  ## Security
  - Maintain existing RLS policies
*/

-- Ensure classes table exists with proper structure
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text NOT NULL,
  capacity integer DEFAULT 30,
  room_number text,
  class_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  academic_year text,
  department text CHECK (department IN ('Science', 'Arts', 'Commercial')),
  stream text,
  created_at timestamptz DEFAULT now(),
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL
);

-- Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'capacity') THEN
    ALTER TABLE classes ADD COLUMN capacity integer DEFAULT 30;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'room_number') THEN
    ALTER TABLE classes ADD COLUMN room_number text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'class_teacher_id') THEN
    ALTER TABLE classes ADD COLUMN class_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'academic_year') THEN
    ALTER TABLE classes ADD COLUMN academic_year text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'department') THEN
    ALTER TABLE classes ADD COLUMN department text CHECK (department IN ('Science', 'Arts', 'Commercial'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'stream') THEN
    ALTER TABLE classes ADD COLUMN stream text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'session_id') THEN
    ALTER TABLE classes ADD COLUMN session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update level column to have proper constraint
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_level_check;
  
  -- Add new constraint with all education levels
  ALTER TABLE classes ADD CONSTRAINT classes_level_check 
    CHECK (level IN (
      'Pre-Primary', 'Primary', 'JSS', 'SSS',
      'Nursery 1', 'Nursery 2', 'KG 1', 'KG 2',
      'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
      'JSS 1', 'JSS 2', 'JSS 3',
      'SSS 1', 'SSS 2', 'SSS 3'
    ));
END $$;

-- Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view classes" ON classes;
DROP POLICY IF EXISTS "Authenticated users can manage classes" ON classes;
DROP POLICY IF EXISTS "Everyone can view classes" ON classes;
DROP POLICY IF EXISTS "Admins can manage classes" ON classes;

-- Create RLS policies
CREATE POLICY "Everyone can view classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage classes"
  ON classes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_level ON classes(level);
CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department);
CREATE INDEX IF NOT EXISTS idx_classes_class_teacher ON classes(class_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classes_session ON classes(session_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year);

-- Create a view for class statistics
CREATE OR REPLACE VIEW class_statistics AS
SELECT 
  c.id,
  c.name,
  c.level,
  c.department,
  c.capacity,
  COUNT(DISTINCT s.id) as student_count,
  COUNT(DISTINCT tc.teacher_id) as teacher_count,
  COUNT(DISTINCT sc.subject_id) as subject_count
FROM classes c
LEFT JOIN students s ON s.class_id = c.id AND s.status = 'active'
LEFT JOIN teacher_classes tc ON tc.class_id = c.id
LEFT JOIN subject_classes sc ON sc.class_id = c.id
GROUP BY c.id, c.name, c.level, c.department, c.capacity;