-- Create jamb_exam_sessions table for server-side session tracking
CREATE TABLE IF NOT EXISTS jamb_exam_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_slug TEXT NOT NULL,
  exam_year INTEGER NOT NULL,
  
  -- Session timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER NOT NULL DEFAULT 40,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'expired', 'cancelled')),
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Security
  session_token TEXT NOT NULL UNIQUE, -- Random token for this session
  client_clock_offset_ms INTEGER DEFAULT 0, -- Track client vs server time drift
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(student_id, school_id, subject_slug, exam_year, status) -- Only 1 active session per student/subject/year
);

CREATE OR REPLACE FUNCTION set_jamb_exam_session_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NEW.started_at + (NEW.duration_minutes * INTERVAL '1 minute');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_jamb_exam_session_expires_at
BEFORE INSERT OR UPDATE OF started_at, duration_minutes
ON jamb_exam_sessions
FOR EACH ROW
EXECUTE FUNCTION set_jamb_exam_session_expires_at();

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_student_active ON jamb_exam_sessions(student_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_school_subject_year ON jamb_exam_sessions(school_id, subject_slug, exam_year, status);
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_token ON jamb_exam_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_jamb_sessions_expires ON jamb_exam_sessions(expires_at) WHERE status = 'active';

-- Add RLS policies
ALTER TABLE jamb_exam_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_can_view_own_sessions" ON jamb_exam_sessions
  FOR SELECT USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "students_can_create_sessions" ON jamb_exam_sessions
  FOR INSERT WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1)
  );

CREATE POLICY "students_can_update_own_sessions" ON jamb_exam_sessions
  FOR UPDATE USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1)
  ) WITH CHECK (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid() LIMIT 1)
  );
