-- Remove delivery_method column from notification_logs as emails are now in separate table
-- This cleanup completes the separation of email and notification logging

DROP INDEX IF EXISTS public.idx_notification_logs_delivery_method;
DROP INDEX IF EXISTS public.idx_notification_logs_school_delivery;

ALTER TABLE IF EXISTS public.notification_logs 
DROP COLUMN IF EXISTS delivery_method;
