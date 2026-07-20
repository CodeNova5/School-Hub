-- =============================================================================
-- Add session_id and term_id to student_optional_subjects
-- Allows tracking which optional subjects a student took in each session/term
-- =============================================================================

-- Add new columns (nullable for backward compatibility with existing records)
ALTER TABLE student_optional_subjects
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE student_optional_subjects
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES terms(id) ON DELETE SET NULL;

-- Drop the old UNIQUE constraint (auto-generated name from CREATE TABLE)
-- In PostgreSQL, inline UNIQUE creates a constraint named: student_optional_subjects_student_id_subject_id_key
ALTER TABLE student_optional_subjects
  DROP CONSTRAINT IF EXISTS student_optional_subjects_student_id_subject_id_key;

-- Enforce uniqueness for legacy records (NULL session_id) — one enrollment per student+subject
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_optional_subjects_unique_nosession
  ON student_optional_subjects(student_id, subject_id)
  WHERE session_id IS NULL;

-- Enforce uniqueness for session+term-tracked records — one enrollment per student+subject+session+term
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_optional_subjects_unique_session
  ON student_optional_subjects(student_id, subject_id, session_id, term_id)
  WHERE session_id IS NOT NULL AND term_id IS NOT NULL;

-- Add indexes for efficient session/term-scoped lookups
CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_session
  ON student_optional_subjects(session_id);

CREATE INDEX IF NOT EXISTS idx_student_optional_subjects_term
  ON student_optional_subjects(term_id);

-- =============================================================================
-- Also add session_id and term_id to student_subjects for termly enrollment tracking
-- =============================================================================

ALTER TABLE student_subjects
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;

ALTER TABLE student_subjects
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES terms(id) ON DELETE SET NULL;

-- Drop the old UNIQUE constraint (auto-generated name)
ALTER TABLE student_subjects
  DROP CONSTRAINT IF EXISTS student_subjects_student_id_subject_class_id_key;

-- Enforce uniqueness for legacy records (NULL session_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_subjects_unique_nosession
  ON student_subjects(student_id, subject_class_id)
  WHERE session_id IS NULL;

-- Enforce uniqueness for tracked records — one enrollment per student+subject_class+session+term
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_subjects_unique_session
  ON student_subjects(student_id, subject_class_id, session_id, term_id)
  WHERE session_id IS NOT NULL AND term_id IS NOT NULL;

-- Add index for efficient session-scoped lookups on student_subjects
CREATE INDEX IF NOT EXISTS idx_student_subjects_session
  ON student_subjects(session_id);
