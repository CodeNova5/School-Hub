-- Add school_id column to notification_logs table for multitenancy
ALTER TABLE IF EXISTS public.notification_logs ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Create index for faster filtering by school
CREATE INDEX IF NOT EXISTS idx_notification_logs_school_id ON public.notification_logs(school_id);

-- Existing logs are intentionally left as NULL and should be backfilled with
-- a verified mapping strategy if historical tenant attribution is required.

-- Create a composite index for common queries (by school and created_at)
CREATE INDEX IF NOT EXISTS idx_notification_logs_school_created ON public.notification_logs(school_id, created_at DESC);
