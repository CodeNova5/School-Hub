-- =============================================================================
-- Fix: Add created_by_admin_id to teacher_questions table
-- The original fix migration (20260622) added created_by_admin_id to
-- teacher_question_topic_sets and teacher_question_banks but NOT to
-- teacher_questions. This caused errors when admins tried to create
-- or generate questions.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. teacher_questions: add created_by_admin_id
-- ---------------------------------------------------------------------------

ALTER TABLE teacher_questions
  ADD COLUMN IF NOT EXISTS created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make created_by_teacher_id nullable since a record is owned by either a teacher OR an admin
ALTER TABLE teacher_questions
  ALTER COLUMN created_by_teacher_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Indexes for admin lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_teacher_questions_admin
  ON teacher_questions (school_id, created_by_admin_id, bank_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Update RLS policies on teacher_questions
-- Drop old teacher-only policies and create new inclusive policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers can read own and shared questions" ON teacher_questions;
DROP POLICY IF EXISTS "Teachers can manage own questions" ON teacher_questions;

CREATE POLICY "Users can read questions in their school"
  ON teacher_questions FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      created_by_teacher_id IN (
        SELECT id FROM teachers WHERE user_id = auth.uid() AND school_id = get_my_school_id()
      )
      OR created_by_admin_id = auth.uid()
      OR visibility = 'public_school'
      OR is_admin()
    )
  );

CREATE POLICY "Users can manage own questions"
  ON teacher_questions FOR ALL
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      created_by_teacher_id IN (
        SELECT id FROM teachers WHERE user_id = auth.uid() AND school_id = get_my_school_id()
      )
      OR created_by_admin_id = auth.uid()
      OR is_admin()
    )
  )
  WITH CHECK (
    school_id = get_my_school_id()
    AND (
      created_by_teacher_id IN (
        SELECT id FROM teachers WHERE user_id = auth.uid() AND school_id = get_my_school_id()
      )
      OR created_by_admin_id = auth.uid()
      OR is_admin()
    )
  );

COMMIT;
