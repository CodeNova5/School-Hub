import axios from 'axios';
import cheerio from 'cheerio';

const BASE_URL = 'https://myschool.ng';

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function getLabelForSelect($, selectEl) {
  const id = $(selectEl).attr('id');
  const name = $(selectEl).attr('name');

  if (id) {
    const byFor = clean($(`label[for="${id}"]`).first().text());
    if (byFor) return byFor;
  }

  const fromParent = clean($(selectEl).closest('div').find('label').first().text());
  if (fromParent) return fromParent;

  if (name) return name;
  return id || 'unknown';
}

function parseSelectOptions($, selectEl) {
  return $(selectEl)
    .find('option')
    .map((_, opt) => {
      const value = clean($(opt).attr('value') || '');
      const label = clean($(opt).text());
      return { value, label };
    })
    .get()
    .filter((item) => item.label);
}

function looksLikeYear(value, label) {
  const text = `${value} ${label}`;
  return /\b(19|20)\d{2}\b/.test(text);
}

export async function GET(req) {
  try {
    const urlObj = new URL(req.url);
    const subject = urlObj.searchParams.get('subject') || 'commerce';

    const target = `${BASE_URL}/classroom/${encodeURIComponent(subject)}?exam_type=jamb&exam_year=&topic=`;

    const { data } = await axios.get(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 30000
    });

    const $ = cheerio.load(data);

    const selects = $('select')
      .map((_, selectEl) => {
        const label = getLabelForSelect($, selectEl);
        const id = clean($(selectEl).attr('id') || '');
        const name = clean($(selectEl).attr('name') || '');
        const options = parseSelectOptions($, selectEl);

        return { label, id, name, options };
      })
      .get();

    const yearSelect =
      selects.find((s) => /exam\s*year/i.test(s.label)) ||
      selects.find((s) => /year/i.test(`${s.id} ${s.name} ${s.label}`)) ||
      selects.find((s) => s.options.some((opt) => looksLikeYear(opt.value, opt.label)));

    const topicSelect =
      selects.find((s) => /^topics?:?$/i.test(s.label)) ||
      selects.find((s) => /topic/i.test(`${s.id} ${s.name} ${s.label}`));

    const years = (yearSelect?.options || [])
      .filter((opt) => looksLikeYear(opt.value, opt.label))
      .map((opt) => opt.label.match(/(19|20)\d{2}/)?.[0] || opt.label)
      .filter(Boolean);

    const uniqueYears = [...new Set(years)].sort((a, b) => Number(b) - Number(a));

    const topics = (topicSelect?.options || [])
      .filter((opt) => opt.label && !/^all$/i.test(opt.label))
      .map((opt) => ({ value: opt.value, topic: opt.label }));

    return new Response(
      JSON.stringify({ url: target, years: uniqueYears, topics, topicCount: topics.length, debug: { foundSelects: selects.map((s) => ({ label: s.label, id: s.id, name: s.name, optionCount: s.options.length })) } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[/api/scrape/available] Error:', {
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
