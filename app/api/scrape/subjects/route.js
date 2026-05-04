import axios from 'axios';
import cheerio from 'cheerio';

const BASE_URL = 'https://myschool.ng';
const CLASSROOM_URL = `${BASE_URL}/classroom`;
const MAX_RETRIES = 2;

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function isSubjectPath(pathname) {
  return /^\/classroom\/[^/?#]+\/?$/.test(pathname || '');
}

const EXCLUDED_SLUGS = new Set([
  'exam',
  'jamb-brochure',
  'jamb-novel',
  'jamb-syllabus',
  'video-lessons',
  'topic-videos',
  'novels',
  'exam-ranking'
]);

async function fetchClassroomPage(retryCount = 0) {
  try {
    const { data, status, headers } = await axios.get(CLASSROOM_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 30000,
      validateStatus: (status) => status === 200
    });

    // Validate response is HTML
    if (!headers['content-type']?.includes('text/html')) {
      throw new Error(`Invalid content-type: ${headers['content-type']}`);
    }

    if (!data || data.length < 1000) {
      throw new Error('Response too small, likely not the full page');
    }

    return data;
  } catch (err) {
    if (retryCount < MAX_RETRIES && (err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT')) {
      console.warn(`[/api/scrape/subjects] Retry ${retryCount + 1}/${MAX_RETRIES} after ${err?.code}`);
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1))); // backoff
      return fetchClassroomPage(retryCount + 1);
    }
    throw err;
  }
}

export async function GET(req) {
  try {
    const data = await fetchClassroomPage();
    const $ = cheerio.load(data);
    const subjectsMap = new Map();

    $('h3 a[href], h4 a[href], h5 a[href], h6 a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      let urlObj;
      try {
        urlObj = new URL(href, BASE_URL);
      } catch (e) {
        return;
      }

      if (urlObj.hostname !== 'myschool.ng') return;
      if (!isSubjectPath(urlObj.pathname)) return;

      const parts = urlObj.pathname.split('/').filter(Boolean);
      const slug = parts.pop();
      if (!slug) return;
      if (EXCLUDED_SLUGS.has(slug)) return;

      const anchorText = normalizeText($(el).text());
      if (!anchorText) return;
      if (/^study past questions$/i.test(anchorText)) return;
      if (/^watch video lessons$/i.test(anchorText)) return;
      if (/^check syllabus$/i.test(anchorText)) return;

      const fallbackName = slug
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase());

      subjectsMap.set(slug, {
        name: anchorText || fallbackName,
        slug,
        url: `${BASE_URL}/classroom/${slug}`
      });
    });

    const subjects = Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    if (subjects.length === 0) {
      console.warn('[/api/scrape/subjects] No subjects found - page structure may have changed');
    }

    return new Response(JSON.stringify({ count: subjects.length, subjects }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[/api/scrape/subjects] Error:', {
      message: err?.message,
      code: err?.code,
      type: err?.constructor?.name,
      stack: err?.stack
    });

    return new Response(JSON.stringify({ 
      error: err?.message || String(err),
      code: err?.code,
      type: err?.constructor?.name
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
