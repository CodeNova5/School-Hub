-- Allow public/anon access to subjects for the public academics showcase
-- The policy allows reading active subjects by school_id without authentication

DROP POLICY IF EXISTS "Public can read active subjects by school" ON subjects;
DROP POLICY IF EXISTS "Public can read active education levels" ON school_education_levels;
DROP POLICY IF EXISTS "Public can read class levels for active education levels" ON school_class_levels;
DROP POLICY IF EXISTS "Public can read website media by school" ON website_media;

CREATE POLICY "Public can read active subjects by school"
  ON subjects FOR SELECT
  TO anon
  USING (is_active = true);

-- Similarly, allow public access to education levels for the academics page
CREATE POLICY "Public can read active education levels"
  ON school_education_levels FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow public access to class levels linked to active education levels
CREATE POLICY "Public can read class levels for active education levels"
  ON school_class_levels FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow public access to website media
CREATE POLICY "Public can read website media by school"
  ON website_media FOR SELECT
  TO anon
  USING (true);
