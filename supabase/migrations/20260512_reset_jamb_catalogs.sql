-- Full reset for JAMB catalog tables.
-- Removes trigger/backfill maintenance and recreates clean catalog-only tables.

BEGIN;

DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_catalog ON jamb_questions;
DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_year_catalog ON jamb_questions;

DROP FUNCTION IF EXISTS upsert_jamb_subject_from_question();
DROP FUNCTION IF EXISTS upsert_jamb_subject_year_from_question();

DROP TABLE IF EXISTS jamb_questions;
DROP TABLE IF EXISTS jamb_subject_years;
DROP TABLE IF EXISTS jamb_subjects;

CREATE TABLE jamb_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_type text NOT NULL DEFAULT 'jamb' CHECK (exam_type = 'jamb'),
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_year int NOT NULL,
  topic text,
  image_url text,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_option text NOT NULL,
  explanation text,
  source_url text,
  external_question_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jamb_questions_subject ON jamb_questions (subject_slug, exam_year);
CREATE INDEX idx_jamb_questions_topic ON jamb_questions (subject_slug, exam_year, topic);

CREATE TABLE jamb_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jamb_subjects_name ON jamb_subjects (name);

CREATE TABLE jamb_subject_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_year int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_slug, exam_year)
);

CREATE INDEX idx_jamb_subject_years_subject_year
  ON jamb_subject_years (subject_slug, exam_year);

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
ALTER TABLE jamb_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_subject_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage JAMB questions" ON jamb_questions;
DROP POLICY IF EXISTS "Students can read accessible JAMB questions" ON jamb_questions;

CREATE POLICY "Admins can manage JAMB questions"
  ON jamb_questions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can read accessible JAMB questions"
  ON jamb_questions FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

CREATE POLICY "Admins can manage JAMB subjects"
  ON jamb_subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can read JAMB subjects"
  ON jamb_subjects FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

CREATE POLICY "Admins can manage JAMB subject years"
  ON jamb_subject_years FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can read JAMB subject years"
  ON jamb_subject_years FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

COMMENT ON TABLE jamb_questions IS 'Imported JAMB question bank used by the CBT practice feature';
COMMENT ON TABLE jamb_subjects IS 'Imported JAMB subject catalog used by the CBT practice feature';
COMMENT ON TABLE jamb_subject_years IS 'Imported JAMB subject-year catalog used by the CBT practice feature';

COMMIT;
