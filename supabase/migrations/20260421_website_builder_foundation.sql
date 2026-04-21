-- ============================================================================
-- WEBSITE BUILDER FOUNDATION
-- ============================================================================
-- Adds multitenant website builder entities and public-read policies for
-- published school website content.

BEGIN;

-- ============================================================================
-- PART 1: WEBSITE BUILDER TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS website_site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  template_key text NOT NULL DEFAULT 'classic' CHECK (template_key IN ('classic', 'sunrise', 'minimal')),
  brand_name text DEFAULT '',
  primary_color text NOT NULL DEFAULT '#0f766e' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text NOT NULL DEFAULT '#f8fafc' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text NOT NULL DEFAULT '#ea580c' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  heading_font text NOT NULL DEFAULT 'Poppins',
  body_font text NOT NULL DEFAULT 'Open Sans',
  hero_title text DEFAULT '',
  hero_subtitle text DEFAULT '',
  cta_label text DEFAULT 'Apply Now',
  cta_href text DEFAULT '/admission',
  show_news boolean DEFAULT true,
  show_events boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id)
);

CREATE INDEX IF NOT EXISTS idx_website_site_settings_school
  ON website_site_settings(school_id);

CREATE TABLE IF NOT EXISTS website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  seo_title text DEFAULT '',
  seo_description text DEFAULT '',
  seo_image_url text DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_html text DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_homepage boolean DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(school_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_website_pages_school
  ON website_pages(school_id);

CREATE INDEX IF NOT EXISTS idx_website_pages_status
  ON website_pages(school_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_website_homepage_per_school
  ON website_pages(school_id)
  WHERE is_homepage = true;

CREATE TABLE IF NOT EXISTS website_navigation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  page_id uuid REFERENCES website_pages(id) ON DELETE SET NULL,
  label text NOT NULL,
  href text NOT NULL,
  order_sequence integer NOT NULL DEFAULT 1 CHECK (order_sequence > 0),
  is_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_navigation_items_school
  ON website_navigation_items(school_id);

CREATE INDEX IF NOT EXISTS idx_website_navigation_items_order
  ON website_navigation_items(school_id, order_sequence);

-- Keep updated_at columns in sync.
CREATE OR REPLACE FUNCTION update_website_builder_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_website_site_settings_updated_at ON website_site_settings;
CREATE TRIGGER trg_website_site_settings_updated_at
  BEFORE UPDATE ON website_site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_website_builder_timestamp();

DROP TRIGGER IF EXISTS trg_website_pages_updated_at ON website_pages;
CREATE TRIGGER trg_website_pages_updated_at
  BEFORE UPDATE ON website_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_website_builder_timestamp();

DROP TRIGGER IF EXISTS trg_website_navigation_items_updated_at ON website_navigation_items;
CREATE TRIGGER trg_website_navigation_items_updated_at
  BEFORE UPDATE ON website_navigation_items
  FOR EACH ROW
  EXECUTE FUNCTION update_website_builder_timestamp();

-- Seed one default website config per school.
INSERT INTO website_site_settings (school_id, brand_name)
SELECT s.id, s.name
FROM schools s
WHERE NOT EXISTS (
  SELECT 1 FROM website_site_settings ws WHERE ws.school_id = s.id
);

-- ============================================================================
-- PART 2: NEWS / EVENTS PUBLIC WEBSITE EXTENSIONS
-- ============================================================================

ALTER TABLE news ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE news ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE news ADD COLUMN IF NOT EXISTS seo_title text DEFAULT '';
ALTER TABLE news ADD COLUMN IF NOT EXISTS seo_description text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_news_school_published
  ON news(school_id, published);

ALTER TABLE events ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS excerpt text DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS published boolean DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS seo_title text DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS seo_description text DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_events_school_published
  ON events(school_id, published);

-- ============================================================================
-- PART 3: RLS POLICIES
-- ============================================================================

ALTER TABLE website_site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_navigation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can read website settings" ON website_site_settings;
DROP POLICY IF EXISTS "Admins can manage website settings" ON website_site_settings;
DROP POLICY IF EXISTS "Public can read website settings" ON website_site_settings;

CREATE POLICY "School users can read website settings"
  ON website_site_settings FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website settings"
  ON website_site_settings FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Public can read website settings"
  ON website_site_settings FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM schools s
      WHERE s.id = school_id
        AND s.is_active = true
    )
  );

DROP POLICY IF EXISTS "School users can read website pages" ON website_pages;
DROP POLICY IF EXISTS "Admins can manage website pages" ON website_pages;
DROP POLICY IF EXISTS "Public can read published website pages" ON website_pages;

CREATE POLICY "School users can read website pages"
  ON website_pages FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website pages"
  ON website_pages FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Public can read published website pages"
  ON website_pages FOR SELECT
  TO anon
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1
      FROM schools s
      WHERE s.id = school_id
        AND s.is_active = true
    )
  );

DROP POLICY IF EXISTS "School users can read website navigation" ON website_navigation_items;
DROP POLICY IF EXISTS "Admins can manage website navigation" ON website_navigation_items;
DROP POLICY IF EXISTS "Public can read website navigation" ON website_navigation_items;

CREATE POLICY "School users can read website navigation"
  ON website_navigation_items FOR SELECT
  TO authenticated
  USING (is_super_admin() OR school_id = get_my_school_id());

CREATE POLICY "Admins can manage website navigation"
  ON website_navigation_items FOR ALL
  TO authenticated
  USING (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND school_id = get_my_school_id()));

CREATE POLICY "Public can read website navigation"
  ON website_navigation_items FOR SELECT
  TO anon
  USING (
    is_visible = true
    AND EXISTS (
      SELECT 1
      FROM schools s
      WHERE s.id = school_id
        AND s.is_active = true
    )
  );

ALTER TABLE news ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read published news" ON news;
DROP POLICY IF EXISTS "Public can read published events" ON events;

CREATE POLICY "Public can read published news"
  ON news FOR SELECT
  TO anon
  USING (
    published = true
    AND school_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM schools s
      WHERE s.id = school_id
        AND s.is_active = true
    )
  );

CREATE POLICY "Public can read published events"
  ON events FOR SELECT
  TO anon
  USING (
    published = true
    AND school_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM schools s
      WHERE s.id = school_id
        AND s.is_active = true
    )
  );

COMMIT;
