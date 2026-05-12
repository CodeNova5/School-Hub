-- Dedicated subject catalog for JAMB CBT.
-- Avoids scanning jamb_questions just to populate subject dropdowns.

BEGIN;

CREATE TABLE IF NOT EXISTS jamb_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jamb_subjects_name ON jamb_subjects (name);

INSERT INTO jamb_subjects (slug, name)
SELECT DISTINCT jq.subject_slug, jq.subject_name
FROM jamb_questions jq
WHERE jq.subject_slug IS NOT NULL
  AND jq.subject_slug <> ''
  AND jq.subject_name IS NOT NULL
  AND jq.subject_name <> ''
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  updated_at = now();

CREATE OR REPLACE FUNCTION upsert_jamb_subject_from_question()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subject_slug IS NOT NULL
    AND NEW.subject_slug <> ''
    AND NEW.subject_name IS NOT NULL
    AND NEW.subject_name <> '' THEN
    INSERT INTO jamb_subjects (slug, name)
    VALUES (NEW.subject_slug, NEW.subject_name)
    ON CONFLICT (slug) DO UPDATE
    SET
      name = EXCLUDED.name,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_catalog ON jamb_questions;

CREATE TRIGGER trg_jamb_questions_upsert_subject_catalog
AFTER INSERT OR UPDATE OF subject_slug, subject_name ON jamb_questions
FOR EACH ROW
EXECUTE FUNCTION upsert_jamb_subject_from_question();

ALTER TABLE jamb_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage JAMB subjects" ON jamb_subjects;
DROP POLICY IF EXISTS "Students can read JAMB subjects" ON jamb_subjects;

CREATE POLICY "Admins can manage JAMB subjects"
  ON jamb_subjects FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can read JAMB subjects"
  ON jamb_subjects FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

COMMIT;
