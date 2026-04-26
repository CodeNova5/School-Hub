-- ============================================================================
-- WEBSITE ALUMNI DIRECTORY + APPLICATION MODERATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS website_alumni_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  profile_slug text NOT NULL,
  full_name text NOT NULL,
  occupation text NOT NULL,
  story text NOT NULL,
  image_url text NOT NULL,
  linkedin_url text DEFAULT '',
  x_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  website_url text DEFAULT '',
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, profile_slug)
);

CREATE TABLE IF NOT EXISTS website_alumni_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  occupation text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  story text NOT NULL,
  image_url text NOT NULL,
  linkedin_url text DEFAULT '',
  x_url text DEFAULT '',
  tiktok_url text DEFAULT '',
  instagram_url text DEFAULT '',
  facebook_url text DEFAULT '',
  website_url text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes text DEFAULT '',
  reviewed_at timestamptz,
  reviewed_by_user_id uuid,
  approved_profile_id uuid REFERENCES website_alumni_profiles(id) ON DELETE SET NULL,
  ip_address text DEFAULT '',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_alumni_profiles_school_created
  ON website_alumni_profiles (school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_website_alumni_profiles_school_slug
  ON website_alumni_profiles (school_id, profile_slug);

CREATE INDEX IF NOT EXISTS idx_website_alumni_applications_school_status_submitted
  ON website_alumni_applications (school_id, status, submitted_at DESC);

DROP TRIGGER IF EXISTS trigger_update_website_alumni_profiles_timestamp ON website_alumni_profiles;
CREATE TRIGGER trigger_update_website_alumni_profiles_timestamp
  BEFORE UPDATE ON website_alumni_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_website_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_alumni_applications_timestamp ON website_alumni_applications;
CREATE TRIGGER trigger_update_website_alumni_applications_timestamp
  BEFORE UPDATE ON website_alumni_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_website_timestamp();

ALTER TABLE website_alumni_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_alumni_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read website alumni profiles" ON website_alumni_profiles;
DROP POLICY IF EXISTS "Admins can manage website alumni profiles" ON website_alumni_profiles;
DROP POLICY IF EXISTS "Anon can read visible website alumni profiles" ON website_alumni_profiles;

CREATE POLICY "School users can read website alumni profiles"
  ON website_alumni_profiles FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website alumni profiles"
  ON website_alumni_profiles FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Anon can read visible website alumni profiles"
  ON website_alumni_profiles FOR SELECT
  TO anon
  USING (is_visible = true);

DROP POLICY IF EXISTS "School users can read website alumni applications" ON website_alumni_applications;
DROP POLICY IF EXISTS "Admins can manage website alumni applications" ON website_alumni_applications;
DROP POLICY IF EXISTS "Anon can create website alumni applications" ON website_alumni_applications;

CREATE POLICY "School users can read website alumni applications"
  ON website_alumni_applications FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website alumni applications"
  ON website_alumni_applications FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Anon can create website alumni applications"
  ON website_alumni_applications FOR INSERT
  TO anon
  WITH CHECK (status = 'pending');
