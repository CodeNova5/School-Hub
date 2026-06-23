-- =============================================================================
-- Add weekly scheme-of-work support to teacher_question_topic_sets
--
-- The `topics` column (flat JSONB array) is replaced in spirit by `weeks`,
-- a JSONB array of week entries with the shape:
--   [
--     { "week_number": 1, "topics": ["Topic A"], "is_break": false },
--     { "week_number": 6, "topics": [], "is_break": true },
--     ...
--   ]
--
-- Old data is cleared because the user decided to start fresh with the
-- week-based scheme.
-- =============================================================================

BEGIN;

-- Add the weeks column (JSONB array of week objects)
ALTER TABLE teacher_question_topic_sets
  ADD COLUMN IF NOT EXISTS weeks jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Clear existing topic sets data since we're starting fresh with weeks
DELETE FROM teacher_question_topic_sets;

COMMENT ON COLUMN teacher_question_topic_sets.weeks IS
  'Weekly scheme-of-work: array of { week_number, topics[], is_break } objects';

COMMIT;
