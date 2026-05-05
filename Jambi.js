const axios = require('axios');
const cheerio = require('cheerio');

const chromeUserAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

function getRandomUserAgent() {
    return chromeUserAgents[Math.floor(Math.random() * chromeUserAgents.length)];
}

async function scrapeJamb(pageNumber) {
    const url = `https://myschool.ng/classroom/mathematics?exam_type=jamb&exam_year=2022&page=${pageNumber}`;
    
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const $ = cheerio.load(data);
        const questions = [];

        $('.question-item').each((i, el) => {
            const questionText = $(el).find('.question-desc p').text().replace(/\s+/g, ' ').trim();
            const options = $(el)
                .find('ul.list-unstyled li')
                .map((_, opt) => $(opt).text().replace(/\s+/g, ' ').trim())
                .get()
                .filter(Boolean);

            const answerLink = $(el).find('a.btn-outline-danger').attr('href');
            const answerId = answerLink ? answerLink.match(/\/(\d+)\?/ )?.[1] : undefined;

            questions.push({
                id: answerId,
                question: questionText,
                options,
                answerLink
            });
        });

        return questions;
    } catch (error) {
        console.error("Scraping failed:", error);
    }
}
async function fetchAnswerDetail(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        const $ = cheerio.load(data);

        // Find the element that contains the "Correct Answer" label
        const correctEl = $('*:contains("Correct Answer")').first();
        let correct = undefined;
        if (correctEl && correctEl.length) {
            const txt = correctEl.text().replace(/\n+/g, ' ').trim();
            const m = txt.match(/Correct Answer[:\s]*Option\s*([A-D])/i) || txt.match(/Correct Answer[:\s]*([A-D])/i);
            if (m) correct = m[1].toUpperCase();
        }

    
        return { correct };
    } catch (err) {
        console.error('Failed to fetch answer detail', url, err.message || err);
        return { correct: undefined };
    }
}

async function getPaginationInfo(pageNumber = 1) {
    const url = `https://myschool.ng/classroom/mathematics?exam_type=jamb&exam_year=2022&page=${pageNumber}`;
    
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const $ = cheerio.load(data);
        
        // Get all pagination tab numbers
        const paginationLinks = $('nav ul.pagination li a, nav ul.pagination li button, .pagination a, .pagination button');
        const pageNumbers = [];
        
        paginationLinks.each((i, el) => {
            const text = $(el).text().trim();
            const num = parseInt(text);
            if (!isNaN(num) && num > 0) {
                pageNumbers.push(num);
            }
        });

        // Get unique, sorted page numbers
        const uniquePages = [...new Set(pageNumbers)].sort((a, b) => a - b);
        const totalPages = uniquePages.length > 0 ? Math.max(...uniquePages) : 1;
        
        return { totalPages, uniquePages };
    } catch (error) {
        console.error("Failed to get pagination info:", error);
        return { totalPages: 1, uniquePages: [1] };
    }
}

async function run(pageNumber = 1) {
    // First, detect total pages
    const { totalPages, uniquePages } = await getPaginationInfo();
    console.log(`\n📊 PAGINATION INFO`);
    console.log(`Total pages found: ${totalPages}`);
    console.log(`Page numbers: ${uniquePages.join(', ')}`);
    
    // Scrape first page as example
    const questions = await scrapeJamb(pageNumber);
    const questionsPerPage = questions.length;
    
    console.log(`\n📝 QUESTIONS INFO`);
    console.log(`Questions on page ${pageNumber}: ${questionsPerPage}`);
    console.log(`Estimated total questions: ${questionsPerPage * totalPages}`);
    
    // Fetch details for questions on first page
    for (const q of questions) {
        if (q.answerLink) {
            const detail = await fetchAnswerDetail(q.answerLink);
            q.correct = detail.correct;
        }
    }

    console.log(`\n✅ Questions from page ${pageNumber}:`);
    console.log(questions);
}

run(1).catch(err => console.error(err));