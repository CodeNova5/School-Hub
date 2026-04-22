-- ============================================================================
-- WEBSITE BUILDER V1 FOUNDATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS website_site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  site_title text NOT NULL DEFAULT 'School Website',
  site_tagline text DEFAULT '',
  logo_url text DEFAULT '',
  hero_background_url text DEFAULT '',
  primary_color text DEFAULT '#1e3a8a',
  secondary_color text DEFAULT '#059669',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  contact_address text DEFAULT '',
  is_website_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  seo_title text DEFAULT '',
  seo_description text DEFAULT '',
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, slug)
);

CREATE TABLE IF NOT EXISTS website_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES website_pages(id) ON DELETE CASCADE,
  section_key text NOT NULL CHECK (section_key IN ('home','about','programs','facilities','faculty','news','testimonials','gallery','admissions','contact')),
  section_label text NOT NULL,
  is_visible boolean DEFAULT true,
  order_sequence integer NOT NULL DEFAULT 1 CHECK (order_sequence > 0),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(page_id, section_key)
);

CREATE TABLE IF NOT EXISTS website_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  page_id uuid REFERENCES website_pages(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  github_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text,
  file_size bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_pages_school_status
  ON website_pages(school_id, status);

CREATE INDEX IF NOT EXISTS idx_website_sections_page_order
  ON website_sections(page_id, order_sequence);

CREATE INDEX IF NOT EXISTS idx_website_media_school
  ON website_media(school_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_website_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_website_site_settings_timestamp ON website_site_settings;
CREATE TRIGGER trigger_update_website_site_settings_timestamp
  BEFORE UPDATE ON website_site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_website_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_pages_timestamp ON website_pages;
CREATE TRIGGER trigger_update_website_pages_timestamp
  BEFORE UPDATE ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_website_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_sections_timestamp ON website_sections;
CREATE TRIGGER trigger_update_website_sections_timestamp
  BEFORE UPDATE ON website_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_website_timestamp();

DROP TRIGGER IF EXISTS trigger_update_website_media_timestamp ON website_media;
CREATE TRIGGER trigger_update_website_media_timestamp
  BEFORE UPDATE ON website_media
  FOR EACH ROW
  EXECUTE FUNCTION update_website_timestamp();

ALTER TABLE website_site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read website settings" ON website_site_settings;
DROP POLICY IF EXISTS "Admins can manage website settings" ON website_site_settings;
DROP POLICY IF EXISTS "Anon can read enabled website settings" ON website_site_settings;

CREATE POLICY "School users can read website settings"
  ON website_site_settings FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website settings"
  ON website_site_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Anon can read enabled website settings"
  ON website_site_settings FOR SELECT
  TO anon
  USING (is_website_enabled = true);

DROP POLICY IF EXISTS "School users can read website pages" ON website_pages;
DROP POLICY IF EXISTS "Admins can manage website pages" ON website_pages;
DROP POLICY IF EXISTS "Anon can read published website pages" ON website_pages;

CREATE POLICY "School users can read website pages"
  ON website_pages FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website pages"
  ON website_pages FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Anon can read published website pages"
  ON website_pages FOR SELECT
  TO anon
  USING (status = 'published');

DROP POLICY IF EXISTS "School users can read website sections" ON website_sections;
DROP POLICY IF EXISTS "Admins can manage website sections" ON website_sections;
DROP POLICY IF EXISTS "Anon can read website sections for published pages" ON website_sections;

CREATE POLICY "School users can read website sections"
  ON website_sections FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website sections"
  ON website_sections FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Anon can read website sections for published pages"
  ON website_sections FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM website_pages wp
      WHERE wp.id = website_sections.page_id
        AND wp.status = 'published'
    )
  );

DROP POLICY IF EXISTS "School users can read website media" ON website_media;
DROP POLICY IF EXISTS "Admins can manage website media" ON website_media;

CREATE POLICY "School users can read website media"
  ON website_media FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website media"
  ON website_media FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

INSERT INTO website_pages (school_id, title, slug, status)
SELECT s.id, 'Home', 'home', 'draft'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_pages wp
  WHERE wp.school_id = s.id
    AND wp.slug = 'home'
);

INSERT INTO website_site_settings (school_id, site_title, site_tagline)
SELECT s.id, s.name, 'Excellence in education'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_site_settings ws
  WHERE ws.school_id = s.id
);
