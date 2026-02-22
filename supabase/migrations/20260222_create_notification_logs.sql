-- Create notification_logs table to track sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  target text NOT NULL,
  target_value text,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  total_recipients integer DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 0,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_target ON notification_logs(target);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_by ON notification_logs(sent_by);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all notification logs
CREATE POLICY "Admins can manage notification logs" ON notification_logs
  FOR ALL
  TO authenticated
  USING (is_admin());