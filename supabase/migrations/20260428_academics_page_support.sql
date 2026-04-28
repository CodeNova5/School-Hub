-- ============================================================================
-- WEBSITE BUILDER: ACADEMICS PAGE SUPPORT
-- ============================================================================
-- This migration adds support for the "academics" page in the website builder.
-- - Updates the section_key CHECK constraint to include new academics section keys
-- - Seeds draft academics pages for all existing schools

-- Update CHECK constraint for section_key to include academics sections
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
      'achievements_cta',
      'academics_hero',
      'academics_class_levels',
      'academics_curriculum',
      'academics_gallery'
    )
  );

-- Ensure every school has a draft academics page (idempotent insert)
INSERT INTO website_pages (school_id, title, slug, status)
SELECT s.id, 'Academics', 'academics', 'draft'
FROM schools s
WHERE NOT EXISTS (
  SELECT 1
  FROM website_pages wp
  WHERE wp.school_id = s.id
    AND wp.slug = 'academics'
)
ON CONFLICT DO NOTHING;

-- Note: Initial sections for academics pages will be created by the admin
-- when they first access the website builder for the academics page.
