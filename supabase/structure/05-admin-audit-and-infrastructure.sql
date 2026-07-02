-- =============================================================================
-- Admin Audit And Infrastructure Structure (SQL)
-- Source: supabase/structure/05-admin-audit-and-infrastructure.md
-- Depends on: 00-core-and-tenancy.sql (for schools, students, teachers, classes, etc.)
-- =============================================================================

-- =============================================================================
-- 1) Audit log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  table_name   text NOT NULL,
  record_id    uuid NOT NULL,
  operation    text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data     jsonb,
  new_data     jsonb,
  changed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_name text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  admin_audit_logs IS 'Trigger-based audit trail for all admin CRUD operations';

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_admin_audit_school_created
  ON admin_audit_logs (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_table_name
  ON admin_audit_logs (school_id, table_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_record_id
  ON admin_audit_logs (record_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_operation
  ON admin_audit_logs (school_id, operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_changed_by
  ON admin_audit_logs (changed_by);

-- =============================================================================
-- 2) Generic trigger function for audit logging
--    Captures old/new row values and resolves the admin's display name.
--    Runs with SECURITY DEFINER so it can insert into admin_audit_logs
--    even when RLS would otherwise block direct inserts.
-- =============================================================================

CREATE OR REPLACE FUNCTION log_admin_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id   uuid;
  v_admin_name text;
BEGIN
  v_user_id := auth.uid();

  -- Resolve the admin's display name from the admins table
  SELECT name INTO v_admin_name
  FROM admins
  WHERE user_id = v_user_id AND is_active = true
  LIMIT 1;

  -- Determine school_id from the row (all audited tables carry school_id)
  IF TG_OP = 'DELETE' THEN
    v_school_id := OLD.school_id;
  ELSE
    v_school_id := NEW.school_id;
  END IF;

  -- Fallback if school_id is null (e.g. super_admin operation on admins table)
  IF v_school_id IS NULL THEN
    v_school_id := get_my_school_id();
  END IF;

  BEGIN
    INSERT INTO admin_audit_logs (
      school_id, table_name, record_id, operation,
      old_data, new_data, changed_by, changed_by_name
    ) VALUES (
      v_school_id,
      TG_TABLE_NAME,
      CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      TG_OP,
      CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
      CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
      v_user_id,
      v_admin_name
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- If audit logging fails, do NOT roll back the original data change
      RAISE WARNING 'Admin audit log insert failed for %.% (%): %',
        TG_TABLE_NAME, TG_OP, TG_TABLE_NAME, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- =============================================================================
-- 3) Attach triggers to every admin-managed table
--    Each trigger fires AFTER INSERT / UPDATE / DELETE
-- =============================================================================

DROP TRIGGER IF EXISTS trg_admin_audit_students ON students;
CREATE TRIGGER trg_admin_audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_teachers ON teachers;
CREATE TRIGGER trg_admin_audit_teachers
  AFTER INSERT OR UPDATE OR DELETE ON teachers
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_classes ON classes;
CREATE TRIGGER trg_admin_audit_classes
  AFTER INSERT OR UPDATE OR DELETE ON classes
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_subjects ON subjects;
CREATE TRIGGER trg_admin_audit_subjects
  AFTER INSERT OR UPDATE OR DELETE ON subjects
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_subject_classes ON subject_classes;
CREATE TRIGGER trg_admin_audit_subject_classes
  AFTER INSERT OR UPDATE OR DELETE ON subject_classes
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_sessions ON sessions;
CREATE TRIGGER trg_admin_audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_terms ON terms;
CREATE TRIGGER trg_admin_audit_terms
  AFTER INSERT OR UPDATE OR DELETE ON terms
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_period_slots ON period_slots;
CREATE TRIGGER trg_admin_audit_period_slots
  AFTER INSERT OR UPDATE OR DELETE ON period_slots
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_timetable_entries ON timetable_entries;
CREATE TRIGGER trg_admin_audit_timetable_entries
  AFTER INSERT OR UPDATE OR DELETE ON timetable_entries
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_parents ON parents;
CREATE TRIGGER trg_admin_audit_parents
  AFTER INSERT OR UPDATE OR DELETE ON parents
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_school_education_levels ON school_education_levels;
CREATE TRIGGER trg_admin_audit_school_education_levels
  AFTER INSERT OR UPDATE OR DELETE ON school_education_levels
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_school_class_levels ON school_class_levels;
CREATE TRIGGER trg_admin_audit_school_class_levels
  AFTER INSERT OR UPDATE OR DELETE ON school_class_levels
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_school_streams ON school_streams;
CREATE TRIGGER trg_admin_audit_school_streams
  AFTER INSERT OR UPDATE OR DELETE ON school_streams
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_school_departments ON school_departments;
CREATE TRIGGER trg_admin_audit_school_departments
  AFTER INSERT OR UPDATE OR DELETE ON school_departments
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_school_religions ON school_religions;
CREATE TRIGGER trg_admin_audit_school_religions
  AFTER INSERT OR UPDATE OR DELETE ON school_religions
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_school_level_subject_presets ON school_level_subject_presets;
CREATE TRIGGER trg_admin_audit_school_level_subject_presets
  AFTER INSERT OR UPDATE OR DELETE ON school_level_subject_presets
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_student_guardian_links ON student_guardian_links;
CREATE TRIGGER trg_admin_audit_student_guardian_links
  AFTER INSERT OR UPDATE OR DELETE ON student_guardian_links
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

DROP TRIGGER IF EXISTS trg_admin_audit_admins ON admins;
CREATE TRIGGER trg_admin_audit_admins
  AFTER INSERT OR UPDATE OR DELETE ON admins
  FOR EACH ROW EXECUTE FUNCTION log_admin_audit();

-- =============================================================================
-- 4) Data retention — cleanup function
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  retention_days int DEFAULT 90
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff  timestamptz;
  deleted bigint;
BEGIN
  cutoff := now() - (retention_days || ' days')::interval;

  DELETE FROM admin_audit_logs
  WHERE created_at < cutoff;

  GET DIAGNOSTICS deleted = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % audit log rows older than %', deleted, cutoff;
  RETURN deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_old_audit_logs IS
  'Deletes admin audit log entries older than retention_days (default 90).';

-- Schedule daily via pg_cron (if extension is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-audit-logs',
      '0 3 * * *',
      $$SELECT cleanup_old_audit_logs()$$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'pg_cron not available – audit log cleanup not scheduled. %', SQLERRM;
END;
$$;

-- =============================================================================
-- 5) RLS policies
-- =============================================================================

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- School admins can read audit logs for their own school
DROP POLICY IF EXISTS "Admins can read audit logs for their school" ON admin_audit_logs;
CREATE POLICY "Admins can read audit logs for their school"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR (is_admin() AND school_id = get_my_school_id())
  );

-- Only the trigger function (running with SECURITY DEFINER) inserts rows.
-- No direct INSERT / UPDATE / DELETE policy is needed for regular users.

