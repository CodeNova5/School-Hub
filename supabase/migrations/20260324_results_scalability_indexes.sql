-- ============================================================================
-- RESULTS + COMPONENT SCORE SCALABILITY INDEXES
-- ============================================================================

-- Confirm fast point lookups and upsert conflict path on results for multi-tenant queries.
CREATE INDEX IF NOT EXISTS idx_results_school_student_session_term_subject
  ON results(school_id, student_id, session_id, term_id, subject_class_id);

-- Support common report-card read path with IN(subject_class_id) and school filter.
CREATE INDEX IF NOT EXISTS idx_results_school_session_term_student
  ON results(school_id, session_id, term_id, student_id);

-- Speed component score reads/deletes scoped by school and result id.
CREATE INDEX IF NOT EXISTS idx_result_component_scores_school_result
  ON result_component_scores(school_id, result_id);

-- Subject loading path in report-card page.
CREATE INDEX IF NOT EXISTS idx_subject_classes_school_class
  ON subject_classes(school_id, class_id);

-- Optional subject lookup path.
CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_school_student
  ON student_optional_subjects(school_id, student_id);
