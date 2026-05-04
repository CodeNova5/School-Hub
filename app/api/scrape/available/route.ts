import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { load } from 'cheerio';

const BASE_URL = 'https://myschool.ng';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectData {
  label: string;
  id: string;
  name: string;
  options: SelectOption[];
}

interface Topic {
  value: string;
  topic: string;
}

interface AvailableResponse {
  url: string;
  years: string[];
  topics: Topic[];
  topicCount: number;
  debug: {
    foundSelects: Array<{
      label: string;
      id: string;
      name: string;
      optionCount: number;
    }>;
  };
}

interface ErrorResponse {
  error: string;
  code?: string;
  type?: string;
}

function clean(text: string | undefined): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function getLabelForSelect($: any, selectEl: any): string {
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

function parseSelectOptions($: any, selectEl: any): SelectOption[] {
  return $(selectEl)
    .find('option')
    .map((_: number, opt: any) => {
      const value = clean($(opt).attr('value') || '');
      const label = clean($(opt).text());
      return { value, label };
    })
    .get()
    .filter((item: SelectOption) => item.label);
}

function looksLikeYear(value: string, label: string): boolean {
  const text = `${value} ${label}`;
  return /\b(19|20)\d{2}\b/.test(text);
}

export async function GET(req: NextRequest): Promise<NextResponse<AvailableResponse | ErrorResponse>> {
  try {
    const urlObj = new URL(req.url);
    const subject = urlObj.searchParams.get('subject') || 'commerce';

    const target = `${BASE_URL}/classroom/${encodeURIComponent(subject)}?exam_type=jamb&exam_year=&topic=`;

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

    const selects: SelectData[] = $('select')
      .map((_: number, selectEl: any) => {
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

    const uniqueYears = [...new Set(years)].sort((a: string, b: string) => Number(b) - Number(a));

    const topics = (topicSelect?.options || [])
      .filter((opt) => opt.label && !/^all$/i.test(opt.label))
      .map((opt) => ({ value: opt.value, topic: opt.label }));

    return NextResponse.json({
      url: target,
      years: uniqueYears,
      topics,
      topicCount: topics.length,
      debug: {
        foundSelects: selects.map((s) => ({
          label: s.label,
          id: s.id,
          name: s.name,
          optionCount: s.options.length
        }))
      }
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    console.error('[/api/scrape/available] Error:', {
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
