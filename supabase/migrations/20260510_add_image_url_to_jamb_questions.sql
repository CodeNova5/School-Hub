-- Add image_url column to jamb_questions table to support diagram/image questions
-- This allows storing images extracted from JAMB questions

BEGIN;

ALTER TABLE jamb_questions
ADD COLUMN IF NOT EXISTS image_url text;

-- Create index for queries filtering by image presence
CREATE INDEX IF NOT EXISTS idx_jamb_questions_has_image
  ON jamb_questions (school_id, subject_slug, exam_year)
  WHERE image_url IS NOT NULL;

COMMIT;
