-- Remove school-scoped tenancy from jamb_questions so all schools share the same question bank.

BEGIN;

ALTER TABLE jamb_questions
  DROP CONSTRAINT IF EXISTS jamb_questions_school_id_fkey;

DROP INDEX IF EXISTS idx_jamb_questions_school;
DROP INDEX IF EXISTS idx_jamb_questions_subject;
DROP INDEX IF EXISTS idx_jamb_questions_topic;
DROP INDEX IF EXISTS idx_jamb_questions_has_image;

DROP POLICY IF EXISTS "Admins can manage JAMB questions" ON jamb_questions;
DROP POLICY IF EXISTS "Students can read accessible JAMB questions" ON jamb_questions;

ALTER TABLE jamb_questions
  DROP COLUMN IF EXISTS school_id;

CREATE INDEX IF NOT EXISTS idx_jamb_questions_subject
  ON jamb_questions (subject_slug, exam_year);

CREATE INDEX IF NOT EXISTS idx_jamb_questions_topic
  ON jamb_questions (subject_slug, exam_year, topic);

CREATE INDEX IF NOT EXISTS idx_jamb_questions_has_image
  ON jamb_questions (subject_slug, exam_year)
  WHERE image_url IS NOT NULL;

CREATE POLICY "Admins can manage JAMB questions"
  ON jamb_questions FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Students can read accessible JAMB questions"
  ON jamb_questions FOR SELECT
  TO authenticated
  USING (can_access_jamb_cbt());

COMMENT ON TABLE jamb_questions IS 'Imported JAMB question bank used by the CBT practice feature';

COMMIT;