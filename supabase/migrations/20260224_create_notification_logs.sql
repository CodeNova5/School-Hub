-- Create notification_logs table to track sent notifications
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  target TEXT NOT NULL,
  target_value TEXT,
  target_name TEXT,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  total_recipients INTEGER DEFAULT 0,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Add target_name column if it doesn't exist (for existing databases)
ALTER TABLE IF EXISTS public.notification_logs ADD COLUMN IF NOT EXISTS target_name TEXT;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON public.notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_target ON public.notification_logs(target);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_by ON public.notification_logs(sent_by);

-- Enable RLS (Row Level Security)
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policy: Allow service role (used by API routes) to manage all logs
CREATE POLICY "Service role can manage all logs" ON public.notification_logs
  FOR ALL
  USING (
    auth.role() = 'service_role'
  )
  WITH CHECK (
    auth.role() = 'service_role'
  );

-- Create policy: Admins can view and manage logs
CREATE POLICY "Admins can manage all logs" ON public.notification_logs
  FOR ALL
  USING (
  (has_permission('admin_full'::text))
  ) with check (
  (has_permission('admin_full'::text))
);

-- Create policy: Students can view notifications sent to all or to student role
CREATE POLICY "Students can view their notifications" ON public.notification_logs
  FOR SELECT
  USING (
    is_student()
    AND (
      target = 'all' 
      OR (target = 'role' AND target_value = 'student')
    )
  );

-- Create policy: Teachers can view notifications sent to all or to teacher role
CREATE POLICY "Teachers can view their notifications" ON public.notification_logs
  FOR SELECT
  USING (
    is_teacher()
    AND (
      target = 'all' 
      OR (target = 'role' AND target_value = 'teacher')
    )
  );

-- Create policy: Parents can view notifications sent to all or to parent role
CREATE POLICY "Parents can view their notifications" ON public.notification_logs
  FOR SELECT
  USING (
    is_parent()
    AND (
      target = 'all' 
      OR (target = 'role' AND target_value = 'parent')
    )
  );


