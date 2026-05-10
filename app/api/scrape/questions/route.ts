import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { load } from 'cheerio';

const BASE_URL = 'https://myschool.ng';
const DEFAULT_PAGE_SIZE = 5;

interface AnswerDetail {
  correct?: string;
  explanation: string;
}

interface Question {
  id?: string;
  question: string;
  options: string[];
  answerLink: string | null;
  correct?: string;
  explanation?: string;
  image?: string | null;
}

interface QuestionsResponse {
  url: string;
  page: number;
  totalPages: number;
  count: number;
  questions: Question[];
}

interface ErrorResponse {
  error: string;
  code?: string;
  type?: string;
}

function getMathAwareText($: ReturnType<typeof load>, el: any): string {
  if (!el || !$(el).length) return '';
  const clone = $(el).clone();

  // Handle MathJax 2.x
  clone.find('script[type^="math/tex"]').each((_: any, script: any) => {
    const latex = $(script).html();
    $(script).replaceWith(` $${latex}$ `);
  });

  // Handle MathJax 3.x
  clone.find('mjx-container').each((_: any, container: any) => {
    const tex = $(container).attr('data-tex') || $(container).attr('aria-label') || '';
    if (tex) $(container).replaceWith(` $${tex}$ `);
  });

  return clean(clone.text());
}

function clean(text: string | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function getText($el: any): string {
  return clean($el.text() || '');
}

function parsePageNumber(value: string | undefined): number | null {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseTotalPages($: ReturnType<typeof load>): number {
  const pageNumbers = new Set<number>();

  $('a[href*="page="]')
    .map((_i: number, element: any) => {
      const href = $(element).attr('href') || '';

      try {
        const parsed = new URL(href, BASE_URL);
        const pageNumber = parsePageNumber(parsed.searchParams.get('page') || undefined);
        if (pageNumber) {
          pageNumbers.add(pageNumber);
        }
      } catch {
        // Ignore malformed pagination links.
      }

      return null;
    })
    .get();

  return pageNumbers.size ? Math.max(...Array.from(pageNumbers)) : 1;
}

async function fetchAnswerDetail(url: string): Promise<AnswerDetail> {
  try {
    const { data } = await axios.get<string>(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 30000
    });

    const $ = load(data);
    const text = $('body').text() || '';
    let correct: string | undefined;
    const m = text.match(/Correct Answer[:\s]*Option\s*([A-D])/i) ||
      text.match(/Correct Answer[:\s]*([A-D])/i) ||
      text.match(/Answer[:\s]*([A-D])/i);
    if (m) correct = m[1].toUpperCase();

    let explanation = '';
    // find heading that contains 'Explanation' then gather following siblings until next heading
    const explHeading = $('h1,h2,h3,h4,h5,h6,strong').filter(function () {
      return /Explanation/i.test($(this).text() || '');
    }).first();

    if (explHeading && explHeading.length) {
      const parts: string[] = [];
      let node: any = explHeading[0].nextSibling;
      while (node) {
        if (node.type === 'tag') {
          const tag = node.tagName.toLowerCase();
          if (/^h[1-6]$/.test(tag)) break;
          const $node = $(node);

          // NEW: Math extraction for explanations
          $node.find('script[type^="math/tex"]').each((_: any, script: any) => {
            $(script).replaceWith(` $${$(script).html()}$ `);
          });
          $node.find('mjx-container').each((_: any, container: any) => {
            const tex = $(container).attr('data-tex') || $(container).attr('aria-label') || '';
            if (tex) $(container).replaceWith(` $${tex}$ `);
          });

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
    console.error('[/api/scrape/questions] Error fetching answer detail:', err);
    return { correct: undefined, explanation: '' };
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<QuestionsResponse | ErrorResponse>> {
  try {
    const urlObj = new URL(req.url);
    const subject = urlObj.searchParams.get('subject');

    if (!subject) {
      return NextResponse.json(
        { error: 'subject query param is required' },
        { status: 400 }
      );
    }

    const year = urlObj.searchParams.get('year') || '';
    const topic = urlObj.searchParams.get('topic') || '';
    const page = parsePageNumber(urlObj.searchParams.get('page') || undefined) || 1;
    const detail = urlObj.searchParams.get('detail') === 'true';
    const pageSize = parsePageNumber(urlObj.searchParams.get('limit') || undefined) || DEFAULT_PAGE_SIZE;

    const target = `${BASE_URL}/classroom/${encodeURIComponent(subject)}?exam_type=jamb&exam_year=${encodeURIComponent(year)}&topic=${encodeURIComponent(topic)}&page=${encodeURIComponent(String(page))}`;

    console.info('[scrape/questions] request', {
      subject,
      year,
      topic,
      page,
      pageSize,
      detail,
      target,
    });

    const { data } = await axios.get<string>(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 30000
    });

    const $ = load(data);
    const questions: Question[] = [];
    const totalPages = parseTotalPages($);

    $('.question-item').each((_i: number, el: any) => {
      const $el = $(el);

      // Extract question text
      const qParagraph = $el.find('.question-desc p');
      const questionText = getMathAwareText($, qParagraph.length ? qParagraph : $el.find('.question-desc'));

      // Extract options
      const options = $el
        .find('ul.list-unstyled li, ul.options li')
        .map((_: number, opt: any) => getMathAwareText($, opt))
        .get()
        .filter(Boolean);

      // Extract images (can be in media-body or directly in question-item)
      let image: string | null = null;
      const imgElement = $el.find('img.img-fluid, img').first();
      if (imgElement && imgElement.length) {
        const src = imgElement.attr('src');
        if (src) {
          // Convert relative URLs to absolute URLs
          image = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        }
      }

      const answerLink = $el.find('a.btn-outline-danger, a[href*="/answers"], a[href*="/answer"]').attr('href') || null;
      const answerId = answerLink ? (answerLink.match(/\/(\d+)\b/) || [])[1] : undefined;

      questions.push({
        id: answerId,
        question: questionText,
        options,
        answerLink,
        image: image || null
      });
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

    return NextResponse.json({
      url: target,
      page,
      totalPages,
      count: questions.length,
      questions
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    console.error('[/api/scrape/questions] Error:', {
      message: error?.message,
      code: error?.code,
      type: error?.constructor?.name,
      stack: error?.stack
    });

    return NextResponse.json(
      {
        error: error?.message || String(err),
        code: error?.code,
        type: error?.constructor?.name
      },
      { status: 500 }
    );
  }
}
