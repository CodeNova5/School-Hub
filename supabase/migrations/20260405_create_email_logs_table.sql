-- Create separate email_logs table for email delivery tracking
-- This separates email delivery tracking from push notifications

CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    target TEXT NOT NULL CHECK (target IN ('all', 'role', 'user', 'class')),
    target_value TEXT,
    target_name TEXT,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    total_recipients INTEGER DEFAULT 0,
    sent_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_school_id ON public.email_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON public.email_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_school_created ON public.email_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON public.email_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_logs_target ON public.email_logs(target);

-- Create a view to get email sent today (convenience view)
CREATE OR REPLACE VIEW email_logs_today AS
SELECT *
FROM public.email_logs
WHERE DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE;

-- Enable RLS on email_logs table
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage their school's email logs
CREATE POLICY "Admins can manage their school email logs" ON public.email_logs
    FOR ALL
    USING (
        school_id = (
            SELECT school_id FROM public.admins
            WHERE user_id = auth.uid()
        )
    );
