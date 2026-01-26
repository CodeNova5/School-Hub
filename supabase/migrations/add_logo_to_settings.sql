-- Add logo_url column to school_settings table if it doesn't exist
ALTER TABLE school_settings ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';

-- Create or update school info settings with default values
INSERT INTO school_settings (key, value, description) VALUES
  ('school_name', '', 'Name of the school'),
  ('school_address', '', 'School address'),
  ('school_email', '', 'School contact email'),
  ('school_phone', '', 'School phone number'),
  ('school_logo', '', 'School logo URL'),
  ('email_notifications_enabled', 'true', 'Enable email notifications'),
  ('sms_notifications_enabled', 'false', 'Enable SMS notifications')
ON CONFLICT (key) DO NOTHING;
