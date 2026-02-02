-- Create results_publication table to control which result components are visible to students
CREATE TABLE IF NOT EXISTS results_publication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  
  -- Component visibility flags
  welcome_test_published BOOLEAN DEFAULT FALSE,
  mid_term_test_published BOOLEAN DEFAULT FALSE,
  vetting_published BOOLEAN DEFAULT FALSE,
  exam_published BOOLEAN DEFAULT FALSE,
  
  -- Publication metadata
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT FALSE, -- Master switch to show results to students
  
  -- Track which calculation mode to use for grades/positions when published
  calculation_mode TEXT DEFAULT 'all' CHECK (calculation_mode IN ('welcome_only', 'welcome_midterm', 'welcome_midterm_vetting', 'all')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one publication record per class/session/term
  UNIQUE(class_id, session_id, term_id)
);

-- Enable RLS
ALTER TABLE results_publication ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage results publication"
  ON results_publication
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Teachers can manage publication for their classes
CREATE POLICY "Teachers can manage publication for their classes"
  ON results_publication
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN teachers t ON t.user_id = ur.user_id
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'teacher'
      AND (
        -- Class teacher
        t.id IN (
          SELECT class_teacher_id FROM classes WHERE id = results_publication.class_id
        )
        -- Or teaches any subject in this class
        OR EXISTS (
          SELECT 1 FROM subject_classes sc
          WHERE sc.class_id = results_publication.class_id
          AND sc.teacher_id = t.id
        )
      )
    )
  );

-- Students can only view publication settings for their class
CREATE POLICY "Students can view publication for their class"
  ON results_publication
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN students s ON s.user_id = ur.user_id
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'student'
      AND s.class_id = results_publication.class_id
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_results_publication_class_session_term 
  ON results_publication(class_id, session_id, term_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_results_publication_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_results_publication_timestamp
  BEFORE UPDATE ON results_publication
  FOR EACH ROW
  EXECUTE FUNCTION update_results_publication_timestamp();
