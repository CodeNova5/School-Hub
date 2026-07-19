-- =============================================================================
-- Migration: add-subject-completion-tracking
--
-- Adds per-subject completion tracking to the `results` table so we can
-- determine which subjects still need scores and mark a student's term as
-- "Incomplete" when any subject lacks completed results.
--
-- Safe to run multiple times — uses IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ── 1) Add is_subject_complete column to results ──────────────────────────

ALTER TABLE results
  ADD COLUMN IF NOT EXISTS is_subject_complete boolean NOT NULL DEFAULT false;

-- Index for quick lookup of incomplete subjects per student/term
CREATE INDEX IF NOT EXISTS idx_results_subject_complete
  ON results (student_id, session_id, term_id, is_subject_complete)
  WHERE is_subject_complete = false;

-- ── 2) Add per-subject completion tracking to student_term_summaries ───────
--    (existing columns are already populated from ResultEntry saves)

-- ── Done ──────────────────────────────────────────────────────────────────
