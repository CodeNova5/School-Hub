-- =============================================================================
-- Audit Logs — Data Retention Policy
--
-- Automatically deletes admin_audit_logs older than the retention period (90
-- days by default). Also provides a helper for manual one-off purges.
-- Scheduling is done via pg_cron (Supabase supported); if pg_cron is not
-- available the function can still be called manually or via the API.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Cleanup function
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Schedule daily via pg_cron (if the extension is available)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- pg_cron may not be installed or accessible on all Supabase projects.
  -- Wrap in a sub-block so the migration doesn't fail if it's missing.
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-audit-logs',        -- job name
      '0 3 * * *',                 -- every day at 03:00 UTC
      $$SELECT cleanup_old_audit_logs()$$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'pg_cron not available – audit log cleanup not scheduled. %', SQLERRM;
END;
$$;

COMMIT;
