-- =============================================================================
-- Migration: add-ai-summary-to-audit-logs
-- 
-- Adds `ai_summary` and `undo_description` columns to `admin_audit_logs` so
-- AI-generated explanations can be cached and displayed inline.
--
-- How to run:
--   1. Open your Supabase Dashboard → SQL Editor
--   2. Paste this entire script
--   3. Click "Run"
--
-- Safe to run multiple times — uses IF NOT EXISTS.
-- =============================================================================

-- ── 1) Add ai_summary column ──────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_audit_logs'
      AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD COLUMN ai_summary text DEFAULT NULL;

    RAISE NOTICE 'Column "ai_summary" added to admin_audit_logs.';
  ELSE
    RAISE NOTICE 'Column "ai_summary" already exists — skipping.';
  END IF;
END $$;

-- ── 2) Add undo_description column ────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'admin_audit_logs'
      AND column_name = 'undo_description'
  ) THEN
    ALTER TABLE admin_audit_logs
      ADD COLUMN undo_description text DEFAULT NULL;

    RAISE NOTICE 'Column "undo_description" added to admin_audit_logs.';
  ELSE
    RAISE NOTICE 'Column "undo_description" already exists — skipping.';
  END IF;
END $$;

-- ── 3) Verify ─────────────────────────────────────────────────────────────

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'admin_audit_logs'
  AND column_name IN ('ai_summary', 'undo_description');

-- ── Done ──────────────────────────────────────────────────────────────────
