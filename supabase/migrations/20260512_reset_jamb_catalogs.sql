-- Full reset for JAMB catalog tables.
-- Removes trigger/backfill maintenance and recreates clean catalog-only tables.

BEGIN;

DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_catalog ON jamb_questions;
DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_year_catalog ON jamb_questions;

DROP FUNCTION IF EXISTS upsert_jamb_subject_from_question();
DROP FUNCTION IF EXISTS upsert_jamb_subject_year_from_question();

DROP TABLE IF EXISTS jamb_subject_years;
DROP TABLE IF EXISTS jamb_subjects;

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

ALTER TABLE jamb_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamb_subject_years ENABLE ROW LEVEL SECURITY;

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

COMMIT;
