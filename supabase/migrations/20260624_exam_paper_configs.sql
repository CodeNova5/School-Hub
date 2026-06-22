-- =============================================================================
-- Add exam_paper_configs table for saving/loading exam paper configurations
-- per bank per term so users can reuse their work without starting again.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS exam_paper_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES teacher_question_banks(id) ON DELETE CASCADE,
  term text NOT NULL CHECK (term IN ('1', '2', '3')),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_by_teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  created_by_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_config_per_bank_term UNIQUE (bank_id, term)
);

CREATE INDEX IF NOT EXISTS idx_exam_paper_configs_bank
  ON exam_paper_configs (bank_id, term);

CREATE INDEX IF NOT EXISTS idx_exam_paper_configs_school
  ON exam_paper_configs (school_id, created_at DESC);

ALTER TABLE exam_paper_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read exam configs" ON exam_paper_configs;
DROP POLICY IF EXISTS "Users can manage own exam configs" ON exam_paper_configs;

CREATE POLICY "Users can read exam configs"
  ON exam_paper_configs FOR SELECT
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

CREATE POLICY "Users can manage own exam configs"
  ON exam_paper_configs FOR ALL
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

COMMENT ON TABLE exam_paper_configs IS 'Saved exam paper configurations per bank per term';

COMMIT;
