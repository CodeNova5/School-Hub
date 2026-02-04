-- ============================================================================
-- CREATE ADMINS TABLE FOR ADMIN USER DATA
-- ============================================================================

-- Create admins table to store admin-specific data
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  is_active boolean DEFAULT false,
  status text DEFAULT 'inactive',
  activation_token_hash text,
  activation_expires_at timestamptz,
  activation_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins table
CREATE POLICY "Authenticated users can read admins"
  ON admins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage admins table"
  ON admins FOR ALL
  TO authenticated
  USING (has_permission('manage_admins') OR has_permission('admin_full'))
  WITH CHECK (has_permission('manage_admins') OR has_permission('admin_full'));

CREATE POLICY "Service role can insert admins"
  ON admins FOR INSERT
  WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_activation_token ON admins(activation_token_hash);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW
  EXECUTE FUNCTION update_admins_updated_at();

-- Grant permissions
GRANT ALL ON admins TO authenticated;
GRANT ALL ON admins TO service_role;

COMMENT ON TABLE admins IS 'Stores admin user data including activation tokens';
