-- Add delivery_method column to notification_logs table
-- This allows tracking of both push notifications and emails in the same table

ALTER TABLE IF EXISTS public.notification_logs 
ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'push' CHECK (delivery_method IN ('push', 'email'));

-- Add school_id column if it doesn't exist (for multitenancy support)
ALTER TABLE IF EXISTS public.notification_logs 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Create index for delivery_method queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_delivery_method ON public.notification_logs(delivery_method);

-- Create index for school_id and delivery_method combined queries  
CREATE INDEX IF NOT EXISTS idx_notification_logs_school_delivery ON public.notification_logs(school_id, delivery_method);

-- Create index for school_id queries (for email stats)
CREATE INDEX IF NOT EXISTS idx_notification_logs_school_id ON public.notification_logs(school_id);
