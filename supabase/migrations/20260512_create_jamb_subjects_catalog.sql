-- Dedicated subject catalog for JAMB CBT.
-- Avoids scanning jamb_questions just to populate subject dropdowns.

BEGIN;

CREATE TABLE IF NOT EXISTS jamb_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  years integer[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jamb_subjects_name ON jamb_subjects (name);
CREATE INDEX IF NOT EXISTS idx_jamb_subjects_years ON jamb_subjects USING GIN (years);

INSERT INTO jamb_subjects (slug, name, years)
SELECT 
  jq.subject_slug,
  jq.subject_name,
  ARRAY(SELECT DISTINCT jq2.exam_year 
        FROM jamb_questions jq2 
        WHERE jq2.subject_slug = jq.subject_slug 
        AND jq2.exam_year IS NOT NULL
        ORDER BY 1 DESC)
FROM jamb_questions jq
WHERE jq.subject_slug IS NOT NULL
  AND jq.subject_slug <> ''
  AND jq.subject_name IS NOT NULL
  AND jq.subject_name <> ''
GROUP BY jq.subject_slug, jq.subject_name
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  years = EXCLUDED.years,
  updated_at = now();

CREATE OR REPLACE FUNCTION upsert_jamb_subject_from_question()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  subject_years integer[];
BEGIN
  IF NEW.subject_slug IS NOT NULL
    AND NEW.subject_slug <> ''
    AND NEW.subject_name IS NOT NULL
    AND NEW.subject_name <> '' THEN
    
    -- Collect all distinct years for this subject
    SELECT ARRAY(
      SELECT DISTINCT exam_year 
      FROM jamb_questions 
      WHERE subject_slug = NEW.subject_slug 
      AND exam_year IS NOT NULL
      ORDER BY 1 DESC
    ) INTO subject_years;
    
    INSERT INTO jamb_subjects (slug, name, years)
    VALUES (NEW.subject_slug, NEW.subject_name, COALESCE(subject_years, '{}'))
    ON CONFLICT (slug) DO UPDATE
    SET
      name = EXCLUDED.name,
      years = COALESCE(subject_years, '{}'),
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jamb_questions_upsert_subject_catalog ON jamb_questions;

CREATE TRIGGER trg_jamb_questions_upsert_subject_catalog
AFTER INSERT OR UPDATE OF subject_slug, subject_name, exam_year ON jamb_questions
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
