-- =============================================================================
-- Migration: add-undone-at-to-audit-logs
-- 
-- Adds the `undone_at` column to `admin_audit_logs` to track which audit
-- entries have already been reversed via the Undo feature.
--
-- How to run:
--   1. Open your Supabase Dashboard → SQL Editor
--   2. Paste this entire script
--   3. Click "Run"
--
-- Safe to run multiple times — uses IF NOT EXISTS.
-- =============================================================================

-- ── 1) Add undone_at column ───────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_audit_logs'
      AND column_name = 'undone_at'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD COLUMN undone_at timestamptz DEFAULT NULL;

    RAISE NOTICE 'Column "undone_at" added to admin_audit_logs.';
  ELSE
    RAISE NOTICE 'Column "undone_at" already exists — skipping.';
  END IF;
END $$;

-- ── 2) Add index for querying undone entries (optional but recommended) ────

CREATE INDEX IF NOT EXISTS idx_admin_audit_undone_at
  ON admin_audit_logs (undone_at)
  WHERE undone_at IS NOT NULL;

-- ── 3) Verify ─────────────────────────────────────────────────────────────

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'admin_audit_logs'
  AND column_name = 'undone_at';

-- ── Done ──────────────────────────────────────────────────────────────────
