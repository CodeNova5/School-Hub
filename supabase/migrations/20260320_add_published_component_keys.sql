-- Add dynamic publication support for result components
ALTER TABLE results_publication
ADD COLUMN IF NOT EXISTS published_component_keys text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_results_publication_component_keys
ON results_publication USING gin (published_component_keys);

-- Backfill from legacy booleans for existing rows
UPDATE results_publication
SET published_component_keys = (
  CASE WHEN welcome_test_published THEN ARRAY['welcome_test'] ELSE ARRAY[]::text[] END
  || CASE WHEN mid_term_test_published THEN ARRAY['mid_term_test'] ELSE ARRAY[]::text[] END
  || CASE WHEN vetting_published THEN ARRAY['vetting'] ELSE ARRAY[]::text[] END
  || CASE WHEN exam_published THEN ARRAY['exam'] ELSE ARRAY[]::text[] END
)
WHERE published_component_keys IS NULL
   OR array_length(published_component_keys, 1) IS NULL;
