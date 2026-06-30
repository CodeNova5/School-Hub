-- ============================================================================
-- ADD SIGNATURE_URL TO TEACHERS TABLE
-- Allows teachers to upload their signature for display on student report cards.
-- ============================================================================

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS signature_url text DEFAULT NULL;

COMMENT ON COLUMN teachers.signature_url IS 'URL to the teacher signature file stored on GitHub. Used for signing report cards and official documents.';
