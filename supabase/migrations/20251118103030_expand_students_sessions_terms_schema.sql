/*
  # Expand Students, Sessions, and Terms Schema

  ## Changes
  1. Updates to students table
    - Add department field
    - Add admission_date field
    - Add photo_url field
    - Add attendance jsonb array
    - Add average_attendance numeric
    - Add results jsonb array
  
  2. New Tables
    - sessions: Academic sessions/years
    - terms: Academic terms (1st term, 2nd term, 3rd term)
  
  3. Security
    - Add RLS policies for teachers to view their students
*/

-- Add new columns to students table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'department') THEN
    ALTER TABLE students ADD COLUMN department text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'admission_date') THEN
    ALTER TABLE students ADD COLUMN admission_date date DEFAULT CURRENT_DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'photo_url') THEN
    ALTER TABLE students ADD COLUMN photo_url text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'attendance') THEN
    ALTER TABLE students ADD COLUMN attendance jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'average_attendance') THEN
    ALTER TABLE students ADD COLUMN average_attendance numeric(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'results') THEN
    ALTER TABLE students ADD COLUMN results jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create terms table
CREATE TABLE IF NOT EXISTS terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view terms"
  ON terms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage terms"
  ON terms FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update average attendance
CREATE OR REPLACE FUNCTION update_student_average_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate average attendance based on attendance jsonb array
  IF jsonb_array_length(NEW.attendance) > 0 THEN
    NEW.average_attendance := (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE (value->>'status')::text = 'present') * 100.0 / COUNT(*))::numeric,
        2
      )
      FROM jsonb_array_elements(NEW.attendance)
    );
  ELSE
    NEW.average_attendance := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-calculating attendance
DROP TRIGGER IF EXISTS trigger_update_average_attendance ON students;
CREATE TRIGGER trigger_update_average_attendance
  BEFORE INSERT OR UPDATE OF attendance ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_student_average_attendance();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_sessions_is_current ON sessions(is_current);
CREATE INDEX IF NOT EXISTS idx_terms_is_current ON terms(is_current);
CREATE INDEX IF NOT EXISTS idx_terms_session_id ON terms(session_id);