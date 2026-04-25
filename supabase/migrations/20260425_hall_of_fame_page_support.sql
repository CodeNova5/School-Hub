-- ============================================================================
-- WEBSITE BUILDER: HALL OF FAME PAGE SUPPORT
-- ============================================================================

ALTER TABLE website_sections
  DROP CONSTRAINT IF EXISTS website_sections_section_key_check;

ALTER TABLE website_sections
  ADD CONSTRAINT website_sections_section_key_check
  CHECK (
    section_key IN (
      'home',
      'about',
      'programs',
      'facilities',
      'faculty',
      'news',
      'testimonials',
      'gallery',
      'admissions',
      'contact',
      'achievements_hero',
      'achievements_timeline',
      'hall_of_fame',
      'achievements_awards',
      'achievements_cta'
    )
  );

-- Ensure every school has a Hall of Fame page scaffold row.
INSERT INTO website_pages (school_id, title, slug, status)
SELECT s.id, 'Hall of Fame', 'hall-of-fame', 'draft'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_pages wp
  WHERE wp.school_id = s.id
    AND wp.slug = 'hall-of-fame'
);
