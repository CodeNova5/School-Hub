-- =============================================================================
-- Add question_bank_audit_logs table for tracking all question bank activity:
-- question created, edited, deleted, generated, printed, config saved, etc.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'question_bank_audit_action'
  ) THEN
    CREATE TYPE question_bank_audit_action AS ENUM (
      'bank_created',
      'bank_updated',
      'question_created',
      'question_updated',
      'question_deleted',
      'question_generated',
      'question_duplicated',
      'exam_printed',
      'exam_config_saved',
      'exam_config_loaded',
      'exam_config_deleted',
      'group_created',
      'group_updated',
      'group_deleted'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS question_bank_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id uuid NOT NULL REFERENCES teacher_question_banks(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  action question_bank_audit_action NOT NULL,
  actor_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('teacher', 'admin')),
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_bank
  ON question_bank_audit_logs (bank_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school
  ON question_bank_audit_logs (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON question_bank_audit_logs (bank_id, action, created_at DESC);

ALTER TABLE question_bank_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read audit logs" ON question_bank_audit_logs;
DROP POLICY IF EXISTS "Admins and owners can insert audit logs" ON question_bank_audit_logs;

CREATE POLICY "Users can read audit logs"
  ON question_bank_audit_logs FOR SELECT
  TO authenticated
  USING (
    school_id = get_my_school_id()
    AND (
      is_admin()
      OR bank_id IN (
        SELECT id FROM teacher_question_banks
        WHERE school_id = get_my_school_id()
        AND (
          created_by_teacher_id IN (
            SELECT id FROM teachers WHERE user_id = auth.uid() AND school_id = get_my_school_id()
          )
          OR created_by_admin_id = auth.uid()
          OR visibility = 'public_school'
        )
      )
    )
  );

-- Allow service_role and authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON question_bank_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = get_my_school_id()
  );

COMMENT ON TABLE question_bank_audit_logs IS 'Audit trail for all question bank activities';

COMMIT;
