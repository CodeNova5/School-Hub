-- Deprecated migration.
-- Catalog reset and authoritative schema now live in:
--   20260512_reset_jamb_catalogs.sql
--
-- This file is intentionally a no-op to keep migration ordering stable
-- for environments that replay the full migration history.

BEGIN;
COMMIT;
