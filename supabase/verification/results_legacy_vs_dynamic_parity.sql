-- ============================================================================
-- RESULTS LEGACY VS DYNAMIC PARITY VERIFICATION
-- Run before dropping legacy score columns from results.
-- ============================================================================

-- 1) Row-level parity for legacy component keys.
WITH per_result AS (
  SELECT
    r.id AS result_id,
    r.student_id,
    r.subject_class_id,
    r.session_id,
    r.term_id,
    COALESCE(r.welcome_test, 0)::numeric AS legacy_welcome_test,
    COALESCE(r.mid_term_test, 0)::numeric AS legacy_mid_term_test,
    COALESCE(r.vetting, 0)::numeric AS legacy_vetting,
    COALESCE(r.exam, 0)::numeric AS legacy_exam,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'welcome_test' THEN rcs.score END), 0)::numeric AS dynamic_welcome_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'mid_term_test' THEN rcs.score END), 0)::numeric AS dynamic_mid_term_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'vetting' THEN rcs.score END), 0)::numeric AS dynamic_vetting,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'exam' THEN rcs.score END), 0)::numeric AS dynamic_exam
  FROM results r
  LEFT JOIN result_component_scores rcs
    ON rcs.result_id = r.id
   AND rcs.component_key IN ('welcome_test', 'mid_term_test', 'vetting', 'exam')
  GROUP BY
    r.id,
    r.student_id,
    r.subject_class_id,
    r.session_id,
    r.term_id,
    r.welcome_test,
    r.mid_term_test,
    r.vetting,
    r.exam
), mismatches AS (
  SELECT
    *,
    (legacy_welcome_test - dynamic_welcome_test) AS diff_welcome_test,
    (legacy_mid_term_test - dynamic_mid_term_test) AS diff_mid_term_test,
    (legacy_vetting - dynamic_vetting) AS diff_vetting,
    (legacy_exam - dynamic_exam) AS diff_exam
  FROM per_result
  WHERE legacy_welcome_test <> dynamic_welcome_test
     OR legacy_mid_term_test <> dynamic_mid_term_test
     OR legacy_vetting <> dynamic_vetting
     OR legacy_exam <> dynamic_exam
)
SELECT *
FROM mismatches
ORDER BY term_id, session_id, student_id, subject_class_id;

-- 2) Summary counts for quick go/no-go.
WITH per_result AS (
  SELECT
    r.id AS result_id,
    COALESCE(r.welcome_test, 0)::numeric AS legacy_welcome_test,
    COALESCE(r.mid_term_test, 0)::numeric AS legacy_mid_term_test,
    COALESCE(r.vetting, 0)::numeric AS legacy_vetting,
    COALESCE(r.exam, 0)::numeric AS legacy_exam,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'welcome_test' THEN rcs.score END), 0)::numeric AS dynamic_welcome_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'mid_term_test' THEN rcs.score END), 0)::numeric AS dynamic_mid_term_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'vetting' THEN rcs.score END), 0)::numeric AS dynamic_vetting,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'exam' THEN rcs.score END), 0)::numeric AS dynamic_exam
  FROM results r
  LEFT JOIN result_component_scores rcs
    ON rcs.result_id = r.id
   AND rcs.component_key IN ('welcome_test', 'mid_term_test', 'vetting', 'exam')
  GROUP BY r.id, r.welcome_test, r.mid_term_test, r.vetting, r.exam
)
SELECT
  COUNT(*) AS total_results,
  COUNT(*) FILTER (
    WHERE legacy_welcome_test = dynamic_welcome_test
      AND legacy_mid_term_test = dynamic_mid_term_test
      AND legacy_vetting = dynamic_vetting
      AND legacy_exam = dynamic_exam
  ) AS parity_rows,
  COUNT(*) FILTER (
    WHERE legacy_welcome_test <> dynamic_welcome_test
       OR legacy_mid_term_test <> dynamic_mid_term_test
       OR legacy_vetting <> dynamic_vetting
       OR legacy_exam <> dynamic_exam
  ) AS mismatch_rows
FROM per_result;

-- 3) Coverage check: dynamic legacy-key rows should exist for each result.
WITH expected AS (
  SELECT COUNT(*) * 4 AS expected_rows
  FROM results
), actual AS (
  SELECT COUNT(*) AS actual_rows
  FROM result_component_scores
  WHERE component_key IN ('welcome_test', 'mid_term_test', 'vetting', 'exam')
)
SELECT
  expected.expected_rows,
  actual.actual_rows,
  (expected.expected_rows - actual.actual_rows) AS missing_rows
FROM expected, actual;

-- 4) Optional school-level breakdown.
WITH per_result AS (
  SELECT
    COALESCE(r.school_id, sc.school_id) AS school_id,
    r.id AS result_id,
    COALESCE(r.welcome_test, 0)::numeric AS legacy_welcome_test,
    COALESCE(r.mid_term_test, 0)::numeric AS legacy_mid_term_test,
    COALESCE(r.vetting, 0)::numeric AS legacy_vetting,
    COALESCE(r.exam, 0)::numeric AS legacy_exam,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'welcome_test' THEN rcs.score END), 0)::numeric AS dynamic_welcome_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'mid_term_test' THEN rcs.score END), 0)::numeric AS dynamic_mid_term_test,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'vetting' THEN rcs.score END), 0)::numeric AS dynamic_vetting,
    COALESCE(MAX(CASE WHEN rcs.component_key = 'exam' THEN rcs.score END), 0)::numeric AS dynamic_exam
  FROM results r
  LEFT JOIN subject_classes sc ON sc.id = r.subject_class_id
  LEFT JOIN result_component_scores rcs
    ON rcs.result_id = r.id
   AND rcs.component_key IN ('welcome_test', 'mid_term_test', 'vetting', 'exam')
  GROUP BY
    COALESCE(r.school_id, sc.school_id),
    r.id,
    r.welcome_test,
    r.mid_term_test,
    r.vetting,
    r.exam
)
SELECT
  school_id,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (
    WHERE legacy_welcome_test = dynamic_welcome_test
      AND legacy_mid_term_test = dynamic_mid_term_test
      AND legacy_vetting = dynamic_vetting
      AND legacy_exam = dynamic_exam
  ) AS parity_rows,
  COUNT(*) FILTER (
    WHERE legacy_welcome_test <> dynamic_welcome_test
       OR legacy_mid_term_test <> dynamic_mid_term_test
       OR legacy_vetting <> dynamic_vetting
       OR legacy_exam <> dynamic_exam
  ) AS mismatch_rows
FROM per_result
GROUP BY school_id
ORDER BY school_id;
