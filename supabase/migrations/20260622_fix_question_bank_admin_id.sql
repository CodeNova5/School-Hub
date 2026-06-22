-- =============================================================================
-- Fix: Add created_by_admin_id to question bank tables
-- The original migration added created_by_teacher_id but admins also need
-- to create/manage question banks and topic sets.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. teacher_question_topic_sets: add created_by_admin_id
-- ---------------------------------------------------------------------------

ALTER TABLE teacher_question_topic_sets
  ADD COLUMN IF NOT EXISTS created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make created_by_teacher_id nullable since a record is owned by either a teacher OR an admin
ALTER TABLE teacher_question_topic_sets
  ALTER COLUMN created_by_teacher_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. teacher_question_banks: add created_by_admin_id
-- ---------------------------------------------------------------------------

ALTER TABLE teacher_question_banks
  ADD COLUMN IF NOT EXISTS created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make created_by_teacher_id nullable since a record is owned by either a teacher OR an admin
ALTER TABLE teacher_question_banks
  ALTER COLUMN created_by_teacher_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Indexes for admin lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_teacher_q_topic_sets_admin
  ON teacher_question_topic_sets (school_id, created_by_admin_id, subject_class_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_q_banks_admin
  ON teacher_question_banks (school_id, created_by_admin_id, subject_class_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Update RLS policies on teacher_question_topic_sets
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers can read own topic sets" ON teacher_question_topic_sets;
DROP POLICY IF EXISTS "Teachers can manage own topic sets" ON teacher_question_topic_sets;

CREATE POLICY "Teachers and admins can read topic sets"
  ON teacher_question_topic_sets FOR SELECT
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
  );

CREATE POLICY "Teachers and admins can manage topic sets"
  ON teacher_question_topic_sets FOR ALL
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

-- ---------------------------------------------------------------------------
-- 5. Update RLS policies on teacher_question_banks
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Teachers can read own and shared banks" ON teacher_question_banks;
DROP POLICY IF EXISTS "Teachers can manage own banks" ON teacher_question_banks;

CREATE POLICY "Teachers and admins can read banks"
  ON teacher_question_banks FOR SELECT
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

CREATE POLICY "Teachers and admins can manage banks"
  ON teacher_question_banks FOR ALL
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
