-- =============================================================================
-- Migration: add-student-term-summaries
--
-- Creates a `student_term_summaries` table that stores per-student aggregate
-- values for each session/term. This table is the **source of truth** for
-- averages, completion percentages, and cumulative data — computed at save
-- time rather than calculated on-the-fly in frontend code.
--
-- How to run:
--   1. Open your Supabase Dashboard → SQL Editor
--   2. Paste this entire script
--   3. Click "Run"
--
-- Safe to run multiple times — uses IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- ── 1) Create the table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_term_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,

  -- Subject counts
  total_subjects          integer NOT NULL DEFAULT 0,   -- total subjects (per-student filtered count)
  subjects_with_results   integer NOT NULL DEFAULT 0,   -- subjects that have a result row
  subjects_complete       integer NOT NULL DEFAULT 0,   -- subjects with all component scores filled

  -- Scores
  total_score             numeric NOT NULL DEFAULT 0,    -- sum of all subject totals
  average_score           numeric NOT NULL DEFAULT 0,    -- total_score / total_subjects

  -- Completion
  completion_percentage   integer NOT NULL DEFAULT 0,    -- subjects_complete / total_subjects * 100
  is_complete             boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(student_id, session_id, term_id)
);

-- ── 2) Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_student_term_summaries_school
  ON student_term_summaries (school_id);

CREATE INDEX IF NOT EXISTS idx_student_term_summaries_student
  ON student_term_summaries (student_id);

CREATE INDEX IF NOT EXISTS idx_student_term_summaries_session
  ON student_term_summaries (session_id);

CREATE INDEX IF NOT EXISTS idx_student_term_summaries_term
  ON student_term_summaries (term_id);

CREATE INDEX IF NOT EXISTS idx_student_term_summaries_lookup
  ON student_term_summaries (school_id, session_id, term_id, student_id);

-- ── 3) Updated-at trigger ────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_student_term_summaries_updated_at ON student_term_summaries;
CREATE TRIGGER set_student_term_summaries_updated_at
  BEFORE UPDATE ON student_term_summaries
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_timestamp();

-- ── 4) RLS ───────────────────────────────────────────────────────────────

ALTER TABLE student_term_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Student term summaries school read" ON student_term_summaries;
CREATE POLICY "Student term summaries school read"
  ON student_term_summaries FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

DROP POLICY IF EXISTS "Student term summaries admin manage" ON student_term_summaries;
CREATE POLICY "Student term summaries admin manage"
  ON student_term_summaries FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

-- ── 5) Verify ────────────────────────────────────────────────────────────

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'student_term_summaries'
ORDER BY ordinal_position;

-- ── Done ──────────────────────────────────────────────────────────────────
