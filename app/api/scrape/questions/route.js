import axios from 'axios';
import cheerio from 'cheerio';

const BASE_URL = 'https://myschool.ng';

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function getText($el) {
  return clean($el.text() || '');
}

async function fetchAnswerDetail(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 30000
    });

    const $ = cheerio.load(data);
    const text = $('body').text() || '';
    let correct;
    const m = text.match(/Correct Answer[:\s]*Option\s*([A-D])/i) || text.match(/Correct Answer[:\s]*([A-D])/i) || text.match(/Answer[:\s]*([A-D])/i);
    if (m) correct = m[1].toUpperCase();

    let explanation = '';
    // find heading that contains 'Explanation' then gather following siblings until next heading
    const explHeading = $('h1,h2,h3,h4,h5,h6,strong').filter(function () {
      return /Explanation/i.test($(this).text() || '');
    }).first();

    if (explHeading && explHeading.length) {
      const parts = [];
      let node = explHeading[0].nextSibling;
      while (node) {
        if (node.type === 'tag') {
          const tag = node.tagName.toLowerCase();
          if (/^h[1-6]$/.test(tag)) break;
          const $node = $(node);
          const nodeText = clean($node.text());
          if (nodeText && !/^(Contributions|Quick Questions|Post your Contribution|Next|Go back to|Report an Error)/i.test(nodeText)) {
            parts.push(nodeText);
          } else {
            break;
          }
        } else if (node.type === 'text') {
          const t = clean(node.data);
          if (t) parts.push(t);
        }
        node = node.nextSibling;
      }
      explanation = parts.join(' ').trim();
    } else {
      // fallback: find any element with 'Explanation' then take its parent text
      const expl = $('*:contains("Explanation")').filter(function () {
        return /Explanation/i.test($(this).text() || '');
      }).first();
      if (expl && expl.length) {
        explanation = clean(expl.parent().text().replace(/Explanation/i, ''));
      }
    }

    return { correct, explanation };
  } catch (err) {
    return { correct: undefined, explanation: '' };
  }
}

export async function GET(req) {
  try {
    const urlObj = new URL(req.url);
    const subject = urlObj.searchParams.get('subject');
    if (!subject) {
      return new Response(JSON.stringify({ error: 'subject query param is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const year = urlObj.searchParams.get('year') || '';
    const topic = urlObj.searchParams.get('topic') || '';
    const page = urlObj.searchParams.get('page') || '1';
    const detail = urlObj.searchParams.get('detail') === 'true';

    const target = `${BASE_URL}/classroom/${encodeURIComponent(subject)}?exam_type=jamb&exam_year=${encodeURIComponent(year)}&topic=${encodeURIComponent(topic)}&page=${encodeURIComponent(page)}`;

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
    const questions = [];

    $('.question-item').each((i, el) => {
      const $el = $(el);
      const questionText = getText($el.find('.question-desc p')) || getText($el.find('.question-desc')) || '';
      const options = $el
        .find('ul.list-unstyled li, ul.options li')
        .map((_, opt) => clean($(opt).text()))
        .get()
        .filter(Boolean);

      const answerLink = $el.find('a.btn-outline-danger, a[href*="/answers"], a[href*="/answer"]').attr('href') || null;
      const answerId = answerLink ? (answerLink.match(/\/(\d+)\b/) || [])[1] : undefined;

      questions.push({ id: answerId, question: questionText, options, answerLink });
    });

    if (detail) {
      for (const q of questions) {
        if (q.answerLink) {
          const abs = q.answerLink.startsWith('http') ? q.answerLink : `${BASE_URL}${q.answerLink}`;
          const det = await fetchAnswerDetail(abs);
          q.correct = det.correct;
          q.explanation = det.explanation;
        }
      }
    }

    return new Response(JSON.stringify({ url: target, count: questions.length, questions }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[/api/scrape/questions] Error:', {
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
