-- =============================================================================
-- Migration: Add school motto and domain ratings support
-- =============================================================================

-- 1. Add motto column to schools table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schools'
      AND column_name = 'motto'
  ) THEN
    ALTER TABLE schools ADD COLUMN motto text DEFAULT '';
  END IF;
END
$$;

-- 2. Add domain_ratings JSONB column to results table for storing
--    affective domain and psychomotor domain ratings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'results'
      AND column_name = 'domain_ratings'
  ) THEN
    ALTER TABLE results ADD COLUMN domain_ratings jsonb DEFAULT '{}'::jsonb;
  END IF;
END
$$;
