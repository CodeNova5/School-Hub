import { NextResponse } from 'next/server';

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
    page?: number;
    totalPages?: number;
}

const JAMB_SUBJECTS: Subject[] = [
    { slug: 'english-language', name: 'Use of English', url: 'https://myschool.ng/classroom/english-language' },
    { slug: 'mathematics', name: 'Mathematics', url: 'https://myschool.ng/classroom/mathematics' },
    { slug: 'physics', name: 'Physics', url: 'https://myschool.ng/classroom/physics' },
    { slug: 'chemistry', name: 'Chemistry', url: 'https://myschool.ng/classroom/chemistry' },
    { slug: 'biology', name: 'Biology', url: 'https://myschool.ng/classroom/biology' },
    { slug: 'agricultural-science', name: 'Agricultural Science', url: 'https://myschool.ng/classroom/agricultural-science' },
    { slug: 'further-mathematics', name: 'Further Mathematics', url: 'https://myschool.ng/classroom/further-mathematics' },
    { slug: 'physical-education', name: 'Physical & Health Education (PHE)', url: 'https://myschool.ng/classroom/physical-education' },
    { slug: 'computer-studies', name: 'Computer Studies', url: 'https://myschool.ng/classroom/computer-studies' },
    { slug: 'home-economics', name: 'Home Economics', url: 'https://myschool.ng/classroom/home-economics' },
    { slug: 'economics', name: 'Economics', url: 'https://myschool.ng/classroom/economics' },
    { slug: 'geography', name: 'Geography', url: 'https://myschool.ng/classroom/geography' },
    { slug: 'government', name: 'Government', url: 'https://myschool.ng/classroom/government' },
    { slug: 'commerce', name: 'Commerce', url: 'https://myschool.ng/classroom/commerce' },
    { slug: 'accounts-principles-of-accounts', name: 'Principles of Accounts', url: 'https://myschool.ng/classroom/accounts-principles-of-accounts' },
    { slug: 'civic-education', name: 'Civic Education', url: 'https://myschool.ng/classroom/civic-education' },
    { slug: 'literature-in-english', name: 'Literature-in-English', url: 'https://myschool.ng/classroom/literature-in-english' },
    { slug: 'christian-religious-knowledge-crk', name: 'Christian Religious Studies (CRS)', url: 'https://myschool.ng/classroom/christian-religious-knowledge-crk' },
    { slug: 'islamic-religious-knowledge-irk', name: 'Islamic Religious Studies (IRS)', url: 'https://myschool.ng/classroom/islamic-religious-knowledge-irk' },
    { slug: 'history', name: 'History', url: 'https://myschool.ng/classroom/history' },
    { slug: 'fine-arts', name: 'Fine Arts', url: 'https://myschool.ng/classroom/fine-arts' },
    { slug: 'music', name: 'Music', url: 'https://myschool.ng/classroom/music' },
    { slug: 'arabic', name: 'Arabic', url: 'https://myschool.ng/classroom/arabic' },
    { slug: 'french', name: 'French', url: 'https://myschool.ng/classroom/french' },
    { slug: 'hausa', name: 'Hausa', url: 'https://myschool.ng/classroom/hausa' },
    { slug: 'igbo', name: 'Igbo', url: 'https://myschool.ng/classroom/igbo' },
    { slug: 'yoruba', name: 'Yoruba', url: 'https://myschool.ng/classroom/yoruba' }
];

export async function GET(request: Request): Promise<NextResponse<SuccessResponse | ErrorResponse>> {
    try {
        const url = new URL(request.url);
        const pageParam = url.searchParams.get('page');
        const parsedPage = Number(pageParam);
        const page = Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;
        const PAGE_SIZE = 10;

        const total = JAMB_SUBJECTS.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const subjects = JAMB_SUBJECTS.slice(start, end);

        return NextResponse.json({ count: total, subjects, page, totalPages });
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
