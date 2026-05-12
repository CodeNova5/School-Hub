#!/usr/bin/env node

require('dotenv').config();

const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const BASE_URL = 'https://myschool.ng';
const DEFAULT_PAGE_SIZE = 5;
const DEFAULT_BUCKET = 'jamb-question-images';
const REQUEST_TIMEOUT_MS = 30000;

const JAMB_SUBJECTS = [
  { slug: 'english-language', name: 'Use of English' },
  { slug: 'mathematics', name: 'Mathematics' },
  { slug: 'physics', name: 'Physics' },
  { slug: 'chemistry', name: 'Chemistry' },
  { slug: 'biology', name: 'Biology' },
  { slug: 'agricultural-science', name: 'Agricultural Science' },
  { slug: 'further-mathematics', name: 'Further Mathematics' },
  { slug: 'physical-education', name: 'Physical & Health Education (PHE)' },
  { slug: 'computer-studies', name: 'Computer Studies' },
  { slug: 'home-economics', name: 'Home Economics' },
  { slug: 'economics', name: 'Economics' },
  { slug: 'geography', name: 'Geography' },
  { slug: 'government', name: 'Government' },
  { slug: 'commerce', name: 'Commerce' },
  { slug: 'accounts-principles-of-accounts', name: 'Principles of Accounts' },
  { slug: 'civic-education', name: 'Civic Education' },
  { slug: 'literature-in-english', name: 'Literature-in-English' },
  { slug: 'christian-religious-knowledge-crk', name: 'Christian Religious Studies (CRS)' },
  { slug: 'islamic-religious-knowledge-irk', name: 'Islamic Religious Studies (IRS)' },
  { slug: 'history', name: 'History' },
  { slug: 'fine-arts', name: 'Fine Arts' },
  { slug: 'music', name: 'Music' },
  { slug: 'arabic', name: 'Arabic' },
  { slug: 'french', name: 'French' },
  { slug: 'hausa', name: 'Hausa' },
  { slug: 'igbo', name: 'Igbo' },
  { slug: 'yoruba', name: 'Yoruba' }
];

const SUBJECT_BY_SLUG = new Map(JAMB_SUBJECTS.map((subject) => [subject.slug, subject]));

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  ];

  return agents[Math.floor(Math.random() * agents.length)];
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function cleanRichText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parsePageNumber(value) {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function sanitizePathSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeSubjectName(subjectSlug, subjectName) {
  if (subjectName) return subjectName;

  const known = SUBJECT_BY_SLUG.get(subjectSlug);
  if (known) return known.name;

  return subjectSlug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseArgs(argv) {
  const args = {
    detail: true,
    pageDelayMs: 250,
    bucket: process.env.JAMB_IMAGE_BUCKET || DEFAULT_BUCKET,
    subject: '',
    subjectName: '',
    year: ''
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, rawInlineValue] = token.slice(2).split('=', 2);
    const key = rawKey.trim();
    const nextValue = rawInlineValue !== undefined ? rawInlineValue : argv[index + 1];

    const expectsValue = !['detail', 'no-detail'].includes(key);
    const value = expectsValue && rawInlineValue === undefined ? nextValue : undefined;

    switch (key) {
      case 'subject':
        args.subject = value || '';
        if (rawInlineValue === undefined) index += 1;
        break;
      case 'subject-name':
      case 'subjectName':
        args.subjectName = value || '';
        if (rawInlineValue === undefined) index += 1;
        break;
      case 'year':
        args.year = value || '';
        if (rawInlineValue === undefined) index += 1;
        break;
      case 'bucket':
        args.bucket = value || DEFAULT_BUCKET;
        if (rawInlineValue === undefined) index += 1;
        break;
      case 'page-delay-ms':
      case 'delay-ms':
        args.pageDelayMs = Number(value || args.pageDelayMs);
        if (rawInlineValue === undefined) index += 1;
        break;
      case 'detail':
        args.detail = true;
        break;
      case 'no-detail':
        args.detail = false;
        break;
      default:
        break;
    }
  }

  return args;
}

function buildSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function ensureBucketExists(supabase, bucketName) {
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(`Unable to list Supabase buckets: ${error.message}`);
  }

  const exists = (data || []).some((bucket) => bucket.name === bucketName);
  if (exists) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: true
  });

  if (createError) {
    throw new Error(`Unable to create Supabase bucket "${bucketName}": ${createError.message}`);
  }
}

function getMathAwareText($, el, options) {
  if (!el || !$(el).length) return '';

  const clone = $(el).clone();

  clone.find('script[type^="math/tex"]').each((_, script) => {
    const latex = $(script).html();
    $(script).replaceWith(` $${latex}$ `);
  });

  clone.find('mjx-container').each((_, container) => {
    const tex = $(container).attr('data-tex') || $(container).attr('aria-label') || '';
    if (tex) {
      $(container).replaceWith(` $${tex}$ `);
    }
  });

  if (options && options.preserveHtml) {
    clone.find('script,style').remove();
    return (clone.html() || '').replace(/\u00a0/g, ' ').trim();
  }

  return clean(clone.text());
}

function parseTotalPages($) {
  const pageNumbers = new Set();

  $('a[href*="page="]').each((_, element) => {
    const href = $(element).attr('href') || '';

    try {
      const parsed = new URL(href, BASE_URL);
      const pageNumber = parsePageNumber(parsed.searchParams.get('page'));
      if (pageNumber) {
        pageNumbers.add(pageNumber);
      }
    } catch {
      // Ignore malformed pagination links.
    }
  });

  return pageNumbers.size ? Math.max(...Array.from(pageNumbers)) : 1;
}

async function fetchPageHtml(url) {
  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    timeout: REQUEST_TIMEOUT_MS
  });

  return data;
}

async function fetchAnswerDetail(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: REQUEST_TIMEOUT_MS
    });

    const $ = cheerio.load(data);
    const text = $('body').text() || '';

    let correct;
    const match =
      text.match(/Correct Answer[:\s]*Option\s*([A-E])/i) ||
      text.match(/Correct Answer[:\s]*([A-E])/i) ||
      text.match(/Answer[:\s]*([A-E])/i);

    if (match) {
      correct = match[1].toUpperCase();
    }

    let explanation = '';
    const explHeading = $('h1,h2,h3,h4,h5,h6,strong')
      .filter(function () {
        return /Explanation/i.test($(this).text() || '');
      })
      .first();

    if (explHeading && explHeading.length) {
      const parts = [];
      let node = explHeading[0].nextSibling;

      while (node) {
        if (node.type === 'tag') {
          const tag = node.tagName.toLowerCase();
          if (/^h[1-6]$/.test(tag)) break;

          const $node = $(node);

          $node.find('script[type^="math/tex"]').each((_, script) => {
            $(script).replaceWith(` $${$(script).html()}$ `);
          });

          $node.find('mjx-container').each((_, container) => {
            const tex = $(container).attr('data-tex') || $(container).attr('aria-label') || '';
            if (tex) {
              $(container).replaceWith(` $${tex}$ `);
            }
          });

          const nodeText = clean($node.text());
          if (
            nodeText &&
            !/^(Contributions|Quick Questions|Post your Contribution|Next|Go back to|Report an Error)/i.test(nodeText)
          ) {
            parts.push(nodeText);
          } else {
            break;
          }
        } else if (node.type === 'text') {
          const textValue = clean(node.data);
          if (textValue) parts.push(textValue);
        }

        node = node.nextSibling;
      }

      explanation = parts.join(' ').trim();
    } else {
      const expl = $('*:contains("Explanation")')
        .filter(function () {
          return /Explanation/i.test($(this).text() || '');
        })
        .first();

      if (expl && expl.length) {
        explanation = clean(expl.parent().text().replace(/Explanation/i, ''));
      }
    }

    return { correct, explanation };
  } catch (error) {
    console.error('[jamb-import] answer detail fetch failed', {
      url,
      message: error?.message || String(error)
    });

    return { correct: undefined, explanation: '' };
  }
}

async function downloadImage(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': getRandomUserAgent(),
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    },
    timeout: REQUEST_TIMEOUT_MS
  });

  const contentType = String(response.headers['content-type'] || '').split(';')[0].trim();
  return {
    buffer: Buffer.from(response.data),
    contentType,
    contentLength: Number(response.headers['content-length'] || 0) || null,
    finalUrl: response.request?.res?.responseUrl || imageUrl
  };
}

function inferExtension(imageUrl, contentType) {
  const pathname = (() => {
    try {
      return new URL(imageUrl).pathname;
    } catch {
      return '';
    }
  })();

  const fromPath = pathname.split('.').pop();
  if (fromPath && fromPath.length <= 5 && /^(png|jpe?g|webp|gif|bmp|svg)$/i.test(fromPath)) {
    return fromPath.toLowerCase().replace('jpeg', 'jpg');
  }

  const contentTypeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico'
  };

  return contentTypeMap[contentType] || 'jpg';
}

async function uploadQuestionImage(supabase, bucket, questionContext, imageUrl) {
  const attempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const download = await downloadImage(imageUrl);
      const extension = inferExtension(imageUrl, download.contentType);
      const objectPath = [
        'jamb',
        sanitizePathSegment(questionContext.subjectSlug),
        sanitizePathSegment(questionContext.examYear),
        sanitizePathSegment(questionContext.pageLabel),
        `${sanitizePathSegment(questionContext.externalQuestionId || `question-${questionContext.index + 1}`)}.${extension}`
      ].join('/');

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, download.buffer, {
          upsert: true,
          contentType: download.contentType || undefined
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
      return {
        imageUrl: publicData.publicUrl,
        storagePath: objectPath,
        sourceUrl: download.finalUrl
      };
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw new Error(`Image upload failed for ${imageUrl}: ${lastError?.message || lastError}`);
}

async function scrapeQuestionsPage(subjectSlug, year, page, detail) {
  const target = `${BASE_URL}/classroom/${encodeURIComponent(subjectSlug)}?exam_type=jamb&exam_year=${encodeURIComponent(year)}&page=${encodeURIComponent(String(page))}`;
  const html = await fetchPageHtml(target);
  const $ = cheerio.load(html);
  const totalPages = parseTotalPages($);
  const questions = [];

  $('.question-item').each((index, element) => {
    const $el = $(element);
    const questionText = getMathAwareText($, $el.find('.question-desc'), { preserveHtml: true });
    const options = $el
      .find('ul.list-unstyled li, ul.options li')
      .map((_, option) => getMathAwareText($, option))
      .get()
      .filter(Boolean);

    let image = null;
    const imageElement = $el.find('img.img-fluid, img').first();
    if (imageElement && imageElement.length) {
      const src = imageElement.attr('src');
      if (src) {
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
      image
    });
  });

  if (detail) {
    for (const question of questions) {
      if (!question.answerLink) continue;

      const abs = question.answerLink.startsWith('http') ? question.answerLink : `${BASE_URL}${question.answerLink}`;
      const detailResult = await fetchAnswerDetail(abs);
      question.correct = detailResult.correct;
      question.explanation = detailResult.explanation;
    }
  }

  return {
    url: target,
    page,
    totalPages,
    count: questions.length,
    questions
  };
}

async function upsertQuestionsForPage(supabase, rows, context) {
  const externalIds = rows.map((row) => row.external_question_id);
  const { data: existingRows, error: existingError } = externalIds.length
    ? await supabase
        .from('jamb_questions')
        .select('id, external_question_id')
        .in('external_question_id', externalIds)
    : { data: [], error: null };

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingByExternalId = new Map((existingRows || []).map((row) => [String(row.external_question_id), row]));
  const existingExternalIds = new Set(existingByExternalId.keys());
  const missingRows = rows.filter((row) => !existingExternalIds.has(row.external_question_id));

  let insertedCount = 0;
  if (missingRows.length > 0) {
    const { error: insertError } = await supabase.from('jamb_questions').insert(missingRows);
    if (insertError) {
      throw new Error(insertError.message);
    }

    insertedCount = missingRows.length;
  }

  const rowsToRefresh = rows.filter((row) => existingExternalIds.has(row.external_question_id));
  let refreshedCount = 0;

  for (const row of rowsToRefresh) {
    const existing = existingByExternalId.get(row.external_question_id);
    if (!existing?.id) continue;

    const { error: updateError } = await supabase
      .from('jamb_questions')
      .update({
        question_text: row.question_text,
        options: row.options,
        correct_option: row.correct_option,
        explanation: row.explanation,
        source_url: row.source_url,
        image_url: row.image_url
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    refreshedCount += 1;
  }

  return { insertedCount, refreshedCount };
}

async function importSubjectYear(options) {
  if (!options.subject) {
    throw new Error('The --subject flag is required');
  }

  if (!options.year) {
    throw new Error('The --year flag is required');
  }

  const subjectSlug = options.subject.trim();
  const subjectName = normalizeSubjectName(subjectSlug, options.subjectName.trim());
  const supabase = buildSupabaseClient();

  await ensureBucketExists(supabase, options.bucket);

  const firstPage = await scrapeQuestionsPage(subjectSlug, options.year, 1, options.detail);
  const totalPages = Math.max(1, firstPage.totalPages || 1);

  // Validation: skip years with > 50 pages (likely edge case where year doesn't exist and combined data is returned)
  const MAX_PAGES = 50;
  if (totalPages > MAX_PAGES) {
    console.warn('[jamb-import] skipping year with suspicious page count', {
      subjectSlug,
      year: options.year,
      totalPages,
      reason: `exceeds max allowed pages (${MAX_PAGES})`
    });
    return;
  }

  console.log('[jamb-import] starting import', {
    subjectSlug,
    subjectName,
    year: options.year,
    bucket: options.bucket,
    totalPages
  });

  let totalScraped = 0;
  let totalInserted = 0;
  let totalRefreshed = 0;
  let totalImagesUploaded = 0;
  let totalImageFailures = 0;

  for (let page = 1; page <= totalPages; page += 1) {
    const pageResult = page === 1 ? firstPage : await scrapeQuestionsPage(subjectSlug, options.year, page, options.detail);
    const rows = [];

    for (let index = 0; index < pageResult.questions.length; index += 1) {
      const question = pageResult.questions[index];

      if (!clean(question.question)) {
        continue;
      }

      const pageScopedId = `${subjectSlug}-${options.year}-all-${page}-${index + 1}`;
      const sourceId = clean(question.id || '');
      const externalQuestionId = sourceId ? `${pageScopedId}-${sourceId}` : pageScopedId;

      let imageUrl = null;
      if (question.image) {
        try {
          const uploaded = await uploadQuestionImage(
            supabase,
            options.bucket,
            {
              subjectSlug,
              examYear: options.year,
              pageLabel: `page-${page}`,
              externalQuestionId,
              index
            },
            question.image
          );

          imageUrl = uploaded.imageUrl;
          totalImagesUploaded += 1;
        } catch (error) {
          totalImageFailures += 1;
          console.error('[jamb-import] image upload failed', {
            page,
            index: index + 1,
            subjectSlug,
            imageUrl: question.image,
            message: error?.message || String(error)
          });
        }
      }

      if (!question.correct) {
        console.warn('[jamb-import] skipping question without resolved correct answer', {
          page,
          index: index + 1,
          subjectSlug,
          externalQuestionId
        });
        continue;
      }

      rows.push({
        exam_type: 'jamb',
        subject_slug: subjectSlug,
        subject_name: subjectName,
        exam_year: Number(options.year),
        topic: null,
        question_text: cleanRichText(question.question || ''),
        options: Array.isArray(question.options) ? question.options : [],
        correct_option: clean(question.correct || '') || null,
        explanation: cleanRichText(question.explanation || '') || null,
        source_url: question.answerLink || null,
        image_url: imageUrl,
        external_question_id: externalQuestionId
      });
    }

    totalScraped += rows.length;

    if (rows.length === 0) {
      console.log('[jamb-import] page had no importable questions', {
        page,
        totalPages,
        scraped: pageResult.questions.length
      });
      continue;
    }

    const { insertedCount, refreshedCount } = await upsertQuestionsForPage(supabase, rows, {
      subjectSlug,
      examYear: options.year
    });

    totalInserted += insertedCount;
    totalRefreshed += refreshedCount;

    console.log('[jamb-import] page complete', {
      page,
      totalPages,
      scraped: pageResult.questions.length,
      importable: rows.length,
      insertedCount,
      refreshedCount,
      imagesUploaded: rows.filter((row) => row.image_url).length
    });

    if (options.pageDelayMs > 0 && page < totalPages) {
      await new Promise((resolve) => setTimeout(resolve, options.pageDelayMs));
    }
  }

  console.log('[jamb-import] finished', {
    subjectSlug,
    subjectName,
    year: options.year,
    totalPages,
    totalImportableQuestions: totalScraped,
    totalInserted,
    totalRefreshed,
    totalImagesUploaded,
    totalImageFailures
  });
}

function parseYearRange(yearValue) {
  if (!yearValue || typeof yearValue !== 'string') return null;
  const m = yearValue.match(/^\s*(\d{4})\s*-\s*(\d{4})\s*$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return [String(a)];
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  const years = [];
  for (let y = start; y <= end; y += 1) years.push(String(y));
  return years;
}

async function importYears(options) {
  const years = parseYearRange(String(options.year || '')) || (options.year ? [String(options.year)] : []);
  if (years.length === 0) {
    throw new Error('The --year flag is required');
  }

  for (const year of years) {
    console.log('[jamb-import] starting year', { year });
    try {
      // clone options and set the current year
      const opts = Object.assign({}, options, { year });
      await importSubjectYear(opts);
    } catch (err) {
      console.error('[jamb-import] error importing year', { year, message: err?.message || String(err) });
    }
  }
}

async function main() {
  const options = {
    detail: true,
    pageDelayMs: 250,
    bucket: DEFAULT_BUCKET,
    subject: 'mathematics',
    subjectName: '',
    year: '1997-2025'
  };

  try {
    await importYears(options);
  } catch (error) {
    console.error('[jamb-import] fatal error', {
      message: error?.message || String(error),
      stack: error?.stack
    });
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  importSubjectYear,
  scrapeQuestionsPage,
  fetchAnswerDetail,
  uploadQuestionImage,
  parseArgs
};