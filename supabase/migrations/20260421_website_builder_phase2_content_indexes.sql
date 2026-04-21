-- ============================================================================
-- WEBSITE BUILDER PHASE 2: CONTENT SLUG SAFETY + INDEXES
-- ============================================================================

BEGIN;

-- Normalize slugs to lowercase and trim to improve consistency.
UPDATE news
SET slug = NULLIF(LOWER(TRIM(slug)), '')
WHERE slug IS NOT NULL;

UPDATE events
SET slug = NULLIF(LOWER(TRIM(slug)), '')
WHERE slug IS NOT NULL;

-- Resolve duplicate slugs safely before adding uniqueness constraints.
WITH ranked_news AS (
  SELECT
    id,
    school_id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY school_id, slug ORDER BY created_at, id) AS rn
  FROM news
  WHERE slug IS NOT NULL
)
UPDATE news n
SET slug = CONCAT(ranked_news.slug, '-', ranked_news.rn)
FROM ranked_news
WHERE n.id = ranked_news.id
  AND ranked_news.rn > 1;

WITH ranked_events AS (
  SELECT
    id,
    school_id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY school_id, slug ORDER BY created_at, id) AS rn
  FROM events
  WHERE slug IS NOT NULL
)
UPDATE events e
SET slug = CONCAT(ranked_events.slug, '-', ranked_events.rn)
FROM ranked_events
WHERE e.id = ranked_events.id
  AND ranked_events.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_news_school_slug
  ON news(school_id, slug)
  WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_school_slug
  ON events(school_id, slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_school_published_created
  ON news(school_id, published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_school_published_start
  ON events(school_id, published, start_date DESC);

COMMIT;
