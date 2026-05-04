const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://myschool.ng';
const CLASSROOM_URL = `${BASE_URL}/classroom`;

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

async function scrapeSubjectList() {
	const { data } = await axios.get(CLASSROOM_URL, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
			Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.9'
		},
		timeout: 30000
	});

	const $ = cheerio.load(data);
	const subjectsMap = new Map();

	$('h3 a[href], h4 a[href], h5 a[href], h6 a[href]').each((_, el) => {
		const href = $(el).attr('href');
		if (!href) return;

		let url;
		try {
			url = new URL(href, BASE_URL);
		} catch {
			return;
		}

		if (url.hostname !== 'myschool.ng') return;
		if (!isSubjectPath(url.pathname)) return;

		const slug = url.pathname.split('/').filter(Boolean).pop();
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

	return Array.from(subjectsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function run() {
	try {
		const subjects = await scrapeSubjectList();
		console.log(JSON.stringify({ count: subjects.length, subjects }, null, 2));
	} catch (error) {
		console.error('Failed to scrape classroom subject list:', error.message || error);
		process.exitCode = 1;
	}
}

run();
