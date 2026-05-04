import { NextRequest, NextResponse } from 'next/server';
import axios, { AxiosError } from 'axios';
import { load, CheerioAPI } from 'cheerio';

const BASE_URL = 'https://myschool.ng';
const CLASSROOM_URL = `${BASE_URL}/classroom`;
const MAX_RETRIES = 2;

interface Subject {
    name: string;
    slug: string;
    url: string;
}

interface ErrorResponse {
    error: string;
    code?: string;
    type?: string;
}

interface SuccessResponse {
    count: number;
    subjects: Subject[];
}

function normalizeText(text: string | undefined): string {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function isSubjectPath(pathname: string | undefined): boolean {
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

async function fetchClassroomPage(retryCount = 0): Promise<string> {
    try {
        const { data, status, headers } = await axios.get<string>(CLASSROOM_URL, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 30000,
            validateStatus: (s) => s === 200
        });

        // Validate response is HTML
        const contentType = String(headers['content-type'] || '');
        if (!contentType.includes('text/html')) {
            throw new Error(`Invalid content-type: ${contentType}`);
        }

        if (!data || data.length < 1000) {
            throw new Error('Response too small, likely not the full page');
        }

        return data;
    } catch (err) {
        const axiosErr = err as AxiosError;
        if (retryCount < MAX_RETRIES && (axiosErr?.code === 'ECONNRESET' || axiosErr?.code === 'ETIMEDOUT')) {
            console.warn(`[/api/scrape/subjects] Retry ${retryCount + 1}/${MAX_RETRIES} after ${axiosErr?.code}`);
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1))); // backoff
            return fetchClassroomPage(retryCount + 1);
        }
        throw err;
    }
}

export async function GET(req: NextRequest): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
    try {
        const htmlData = await fetchClassroomPage();
        const $ = load(htmlData);
        const subjectsMap = new Map<string, Subject>();

        $('h3 a[href], h4 a[href], h5 a[href], h6 a[href]').each((_, el) => {
            try {
                const href = $(el).attr('href');
                if (!href) return;

                let urlObj: URL;
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
            } catch (itemErr) {
                console.warn('[/api/scrape/subjects] Error processing item:', itemErr);
            }
        });

        const subjects = Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

        if (subjects.length === 0) {
            console.warn('[/api/scrape/subjects] No subjects found - page structure may have changed');
        }
        
        console.log(subjects);
        return NextResponse.json({ count: subjects.length, subjects });
    } catch (err) {
        const error = err as Error & { code?: string };
        console.error('[/api/scrape/subjects] Error:', {
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
