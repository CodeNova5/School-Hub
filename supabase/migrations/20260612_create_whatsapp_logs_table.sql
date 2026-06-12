-- Create whatsapp_logs table for WhatsApp broadcast delivery tracking
-- Mirrors the structure of email_logs for consistency and multi-tenancy

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
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
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_school_id ON public.whatsapp_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_created_at ON public.whatsapp_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_school_created ON public.whatsapp_logs(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_sent_by ON public.whatsapp_logs(sent_by);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_target ON public.whatsapp_logs(target);

-- Enable RLS on whatsapp_logs table
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all logs (used by API routes)
CREATE POLICY "Service role can manage all whatsapp logs" ON public.whatsapp_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- RLS Policy: Admins can manage their school's WhatsApp logs
CREATE POLICY "Admins can manage their school whatsapp logs" ON public.whatsapp_logs
    FOR ALL
    USING (
        school_id = (
            SELECT school_id FROM public.admins
            WHERE user_id = auth.uid()
        )
    );
