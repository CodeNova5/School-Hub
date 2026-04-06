-- ============================================================================
-- ADD SIGNATURE_URL TO ADMINS TABLE
-- ============================================================================

ALTER TABLE admins ADD COLUMN IF NOT EXISTS signature_url text DEFAULT NULL;

COMMENT ON COLUMN admins.signature_url IS 'URL to the admin signature file stored on GitHub';
