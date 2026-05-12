-- Dedicated subject-year catalog for JAMB CBT.
-- Avoids scanning jamb_questions just to populate year dropdowns.

BEGIN;

CREATE TABLE IF NOT EXISTS jamb_subject_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_slug text NOT NULL,
  subject_name text NOT NULL,
  exam_year int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_slug, exam_year)
);

CREATE INDEX IF NOT EXISTS idx_jamb_subject_years_subject_year
  ON jamb_subject_years (subject_slug, exam_year);

INSERT INTO jamb_subject_years (subject_slug, subject_name, exam_year)
SELECT DISTINCT jq.subject_slug, jq.subject_name, jq.exam_year
FROM jamb_questions jq
WHERE jq.subject_slug IS NOT NULL
  AND jq.subject_slug <> ''
  AND jq.subject_name IS NOT NULL
  AND jq.subject_name <> ''
  AND jq.exam_year IS NOT NULL
ON CONFLICT (subject_slug, exam_year) DO UPDATE
SET
  subject_name = EXCLUDED.subject_name,
  updated_at = now();

CREATE OR REPLACE FUNCTION upsert_jamb_subject_year_from_question()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subject_slug IS NOT NULL
    AND NEW.subject_slug <> ''
    AND NEW.subject_name IS NOT NULL
    AND NEW.subject_name <> ''
    AND NEW.exam_year IS NOT NULL THEN
    INSERT INTO jamb_subject_years (subject_slug, subject_name, exam_year)
    VALUES (NEW.subject_slug, NEW.subject_name, NEW.exam_year)
    ON CONFLICT (subject_slug, exam_year) DO UPDATE
    SET
      subject_name = EXCLUDED.subject_name,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_year_catalog ON jamb_questions;

CREATE TRIGGER trg_jamb_questions_upsert_subject_year_catalog
AFTER INSERT OR UPDATE OF subject_slug, subject_name, exam_year ON jamb_questions
FOR EACH ROW
EXECUTE FUNCTION upsert_jamb_subject_year_from_question();

ALTER TABLE jamb_subject_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage JAMB subject years" ON jamb_subject_years;
DROP POLICY IF EXISTS "Students can read JAMB subject years" ON jamb_subject_years;

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
