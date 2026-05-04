-- JAMB CBT practice feature
-- Adds question storage, per-student access grants, and practice attempts.

BEGIN;

CREATE TABLE IF NOT EXISTS jamb_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  exam_type text NOT NULL DEFAULT 'jamb' CHECK (exam_type = 'jamb'),
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_year int NOT NULL,
  topic text,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option text NOT NULL,
  explanation text,
  source_url text,
  external_question_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jamb_questions_school ON jamb_questions (school_id);
CREATE INDEX IF NOT EXISTS idx_jamb_questions_subject ON jamb_questions (school_id, subject_slug, exam_year);
CREATE INDEX IF NOT EXISTS idx_jamb_questions_topic ON jamb_questions (school_id, subject_slug, exam_year, topic);

CREATE TABLE IF NOT EXISTS jamb_student_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  granted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_jamb_student_access_school ON jamb_student_access (school_id);
CREATE INDEX IF NOT EXISTS idx_jamb_student_access_student ON jamb_student_access (student_id);
CREATE INDEX IF NOT EXISTS idx_jamb_student_access_active ON jamb_student_access (school_id, is_active);

CREATE TABLE IF NOT EXISTS jamb_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_type text NOT NULL DEFAULT 'jamb' CHECK (exam_type = 'jamb'),
  exam_year int NOT NULL,
  topic text,
  total_questions int NOT NULL DEFAULT 0,
  correct_count int NOT NULL DEFAULT 0,
  score numeric(5, 2) NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jamb_attempts_school ON jamb_attempts (school_id);
CREATE INDEX IF NOT EXISTS idx_jamb_attempts_student ON jamb_attempts (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jamb_attempts_subject ON jamb_attempts (school_id, subject_slug, exam_year);

CREATE OR REPLACE FUNCTION can_access_jamb_cbt()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jamb_student_access jsa
    JOIN students s ON s.id = jsa.student_id
    WHERE s.user_id = auth.uid()
      AND s.school_id = get_my_school_id()
      AND jsa.school_id = s.school_id
      AND jsa.is_active = true
  );
$$;

ALTER TABLE jamb_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_student_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage JAMB questions" ON jamb_questions;
DROP POLICY IF EXISTS "Students can read accessible JAMB questions" ON jamb_questions;

CREATE POLICY "Admins can manage JAMB questions"
  ON jamb_questions FOR ALL
  TO authenticated
  USING (is_admin() AND school_id = get_my_school_id())
  WITH CHECK (is_admin() AND school_id = get_my_school_id());

CREATE POLICY "Students can read accessible JAMB questions"
  ON jamb_questions FOR SELECT
  TO authenticated
  USING (school_id = get_my_school_id() AND can_access_jamb_cbt());

DROP POLICY IF EXISTS "Admins can manage JAMB student access" ON jamb_student_access;
DROP POLICY IF EXISTS "Students can read own JAMB access" ON jamb_student_access;

CREATE POLICY "Admins can manage JAMB student access"
  ON jamb_student_access FOR ALL
  TO authenticated
  USING (is_admin() AND school_id = get_my_school_id())
  WITH CHECK (is_admin() AND school_id = get_my_school_id());

CREATE POLICY "Students can read own JAMB access"
  ON jamb_student_access FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND student_id IN (
      SELECT id
      FROM students
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage JAMB attempts" ON jamb_attempts;
DROP POLICY IF EXISTS "Students can read own JAMB attempts" ON jamb_attempts;
DROP POLICY IF EXISTS "Students can create their JAMB attempts" ON jamb_attempts;

CREATE POLICY "Admins can manage JAMB attempts"
  ON jamb_attempts FOR ALL
  TO authenticated
  USING (is_admin() AND school_id = get_my_school_id())
  WITH CHECK (is_admin() AND school_id = get_my_school_id());

CREATE POLICY "Students can read own JAMB attempts"
  ON jamb_attempts FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND student_id IN (
      SELECT id
      FROM students
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Students can create their JAMB attempts"
  ON jamb_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
    AND student_id IN (
      SELECT id
      FROM students
      WHERE user_id = auth.uid()
    )
    AND can_access_jamb_cbt()
  );

COMMENT ON TABLE jamb_questions IS 'Imported JAMB question bank used by the CBT practice feature';
COMMENT ON TABLE jamb_student_access IS 'Per-student access control for the JAMB CBT practice feature';
COMMENT ON TABLE jamb_attempts IS 'Stored JAMB CBT practice attempts and scores';

COMMIT;