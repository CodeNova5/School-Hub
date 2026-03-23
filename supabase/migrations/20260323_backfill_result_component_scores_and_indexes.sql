-- ============================================================================
-- BACKFILL LEGACY RESULT COLUMNS INTO DYNAMIC COMPONENT SCORES + INDEX HARDENING
-- ============================================================================

-- Hot path indexes for dynamic component lookups.
CREATE INDEX IF NOT EXISTS idx_result_component_scores_result_component
  ON result_component_scores(result_id, component_key);

CREATE INDEX IF NOT EXISTS idx_result_component_templates_school_key
  ON result_component_templates(school_id, component_key);

-- Backfill legacy score columns into result_component_scores.
-- Idempotent: reruns safely and keeps dynamic rows in sync with legacy values.
WITH legacy_rows AS (
  SELECT
    r.id AS result_id,
    COALESCE(r.school_id, sc.school_id) AS school_id,
    'welcome_test'::text AS component_key,
    COALESCE(r.welcome_test, 0)::numeric AS score
  FROM results r
  LEFT JOIN subject_classes sc ON sc.id = r.subject_class_id

  UNION ALL

  SELECT
    r.id AS result_id,
    COALESCE(r.school_id, sc.school_id) AS school_id,
    'mid_term_test'::text AS component_key,
    COALESCE(r.mid_term_test, 0)::numeric AS score
  FROM results r
  LEFT JOIN subject_classes sc ON sc.id = r.subject_class_id

  UNION ALL

  SELECT
    r.id AS result_id,
    COALESCE(r.school_id, sc.school_id) AS school_id,
    'vetting'::text AS component_key,
    COALESCE(r.vetting, 0)::numeric AS score
  FROM results r
  LEFT JOIN subject_classes sc ON sc.id = r.subject_class_id

  UNION ALL

  SELECT
    r.id AS result_id,
    COALESCE(r.school_id, sc.school_id) AS school_id,
    'exam'::text AS component_key,
    COALESCE(r.exam, 0)::numeric AS score
  FROM results r
  LEFT JOIN subject_classes sc ON sc.id = r.subject_class_id
)
INSERT INTO result_component_scores (
  school_id,
  result_id,
  component_key,
  score
)
SELECT
  legacy_rows.school_id,
  legacy_rows.result_id,
  legacy_rows.component_key,
  legacy_rows.score
FROM legacy_rows
WHERE legacy_rows.school_id IS NOT NULL
ON CONFLICT (result_id, component_key)
DO UPDATE
SET
  score = EXCLUDED.score,
  school_id = EXCLUDED.school_id,
  updated_at = now();
