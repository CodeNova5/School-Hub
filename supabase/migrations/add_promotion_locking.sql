-- ============================================================================
-- PROMOTION LOCKING FEATURE
-- ============================================================================
-- This migration adds:
-- 1. last_processed_at field to track when promotions were processed
-- 2. This enables the 24-hour undo window and session locking after 24 hours
-- ============================================================================

-- Add last_processed_at column to promotion_settings
ALTER TABLE promotion_settings 
ADD COLUMN IF NOT EXISTS last_processed_at timestamptz DEFAULT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN promotion_settings.last_processed_at IS 
'Timestamp when promotions were last processed. Used to enforce 24-hour undo window and session locking.';

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_promotion_settings_processed_at 
ON promotion_settings(last_processed_at) WHERE last_processed_at IS NOT NULL;
