-- ============================================================================
-- CREATE ADMINS TABLE FOR ADMIN USER DATA
-- ============================================================================

-- Create admins table to store admin-specific data
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  school_id uuid REFERENCES schools(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  signature_url text DEFAULT NULL,
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

-- RLS Policies for admins table, only super admin can manage admins
CREATE POLICY "Admins: Super Admin Access" ON admins
  FOR ALL
  TO authenticated
  USING (
    is_super_admin()
  );

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
