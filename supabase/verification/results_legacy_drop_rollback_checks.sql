-- ============================================================================
-- LEGACY COLUMN DROP ROLLBACK CHECKS
-- Use this before and after dropping legacy columns from results.
-- ============================================================================

-- PRE-CUTOVER GATE
-- Proceed only if mismatch_rows = 0 and missing_rows = 0 from parity script.

-- 1) Snapshot critical counts before drop.
SELECT
  COUNT(*) AS results_rows,
  COUNT(DISTINCT student_id) AS distinct_students,
  COUNT(DISTINCT subject_class_id) AS distinct_subject_classes,
  COUNT(DISTINCT session_id) AS distinct_sessions,
  COUNT(DISTINCT term_id) AS distinct_terms
FROM results;

SELECT
  COUNT(*) AS component_rows,
  COUNT(DISTINCT result_id) AS results_covered,
  COUNT(*) FILTER (WHERE component_key IN ('welcome_test','mid_term_test','vetting','exam')) AS legacy_key_rows
FROM result_component_scores;

-- 2) Ensure uniqueness integrity in dynamic store.
SELECT
  result_id,
  component_key,
  COUNT(*) AS duplicate_count
FROM result_component_scores
GROUP BY result_id, component_key
HAVING COUNT(*) > 1;

-- 3) Ensure every result has all four legacy keys represented dynamically.
WITH result_key_counts AS (
  SELECT
    r.id AS result_id,
    COUNT(DISTINCT rcs.component_key) AS present_legacy_keys
  FROM results r
  LEFT JOIN result_component_scores rcs
    ON rcs.result_id = r.id
   AND rcs.component_key IN ('welcome_test','mid_term_test','vetting','exam')
  GROUP BY r.id
)
SELECT *
FROM result_key_counts
WHERE present_legacy_keys < 4
ORDER BY present_legacy_keys, result_id;

-- 4) Dry-run rollback projection from dynamic to legacy shape.
-- This query emulates what would be written back into legacy columns if rollback is needed.
WITH projected_legacy AS (
  SELECT
    r.id AS result_id,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'welcome_test' THEN rcs.score END), 0)::numeric AS welcome_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'mid_term_test' THEN rcs.score END), 0)::numeric AS mid_term_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'vetting' THEN rcs.score END), 0)::numeric AS vetting,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'exam' THEN rcs.score END), 0)::numeric AS exam
  FROM results r
  LEFT JOIN result_component_scores rcs
    ON rcs.result_id = r.id
   AND rcs.component_key IN ('welcome_test','mid_term_test','vetting','exam')
  GROUP BY r.id
)
SELECT *
FROM projected_legacy
ORDER BY result_id
LIMIT 200;

-- 5) Rollback helper (DO NOT RUN unless rollback is approved).
-- Uncomment intentionally if needed after legacy columns are re-added.
/*
UPDATE results r
SET
  welcome_test = p.welcome_test,
  mid_term_test = p.mid_term_test,
  vetting = p.vetting,
  exam = p.exam
FROM (
  SELECT
    r2.id AS result_id,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'welcome_test' THEN rcs.score END), 0)::numeric AS welcome_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'mid_term_test' THEN rcs.score END), 0)::numeric AS mid_term_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'vetting' THEN rcs.score END), 0)::numeric AS vetting,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'exam' THEN rcs.score END), 0)::numeric AS exam
  FROM results r2
  LEFT JOIN result_component_scores rcs
    ON rcs.result_id = r2.id
   AND rcs.component_key IN ('welcome_test','mid_term_test','vetting','exam')
  GROUP BY r2.id
) p
WHERE r.id = p.result_id;
*/

-- 6) Post-cutover smoke checks (run after app deploy with dynamic-only reads).
-- Expect 0 rows if app no longer reads/writes removed columns.
SELECT COUNT(*) AS null_component_rows
FROM result_component_scores
WHERE component_key IS NULL;

SELECT COUNT(*) AS negative_scores
FROM result_component_scores
WHERE score < 0;
