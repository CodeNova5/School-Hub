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
        return [];
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
            const txt = (correctEl.text ? (correctEl.text() || '') : '').replace(/\n+/g, ' ').trim();
            const m = txt.match(/Correct Answer[:\s]*Option\s*([A-D])/i) || txt.match(/Correct Answer[:\s]*([A-D])/i);
            if (m) correct = m[1].toUpperCase();
        }

        // Try to grab the explanation section (look for a heading containing "Explanation")
        let explanation = '';
        const explHeading = $('*:contains("Explanation")').filter(function() {
            return $(this).children().length === 0 || /^Explanation/i.test($(this).text().trim().split('\n')[0]);
        }).first();

        if (explHeading && explHeading.length) {
            const parts = [];
            let node = explHeading[0].nextSibling;
            while (node) {
                // stop when we hit another major section or known footer blocks
                if (node.nodeType === 1) {
                    const tag = node.tagName.toLowerCase();
                    const $node = $(node);
                    const nodeText = ($node.text ? ($node.text() || '') : '').replace(/\s+/g, ' ').trim();
                    if (nodeText && !/^(Contributions|Quick Questions|Post your Contribution|Next|Go back to|Report an Error)/i.test(nodeText)) {
                        // prefer MathJax data if available
                        const mathjaxEls = $node.find('.MathJax').addBack('.MathJax');
                        if (mathjaxEls.length) {
                            mathjaxEls.each((_, m) => {
                                const dm = $(m).attr('data-mathml') || ($(m).text ? $(m).text() : '');
                                if (dm) parts.push((dm || '').replace(/\s+/g, ' ').trim());
                            });
                        }
                        // include normal text content as fallback
                        if (nodeText) parts.push(nodeText);
                    } else {
                        break;
                    }
                    // stop if we hit a heading element
                    if (/^h[1-6]$/.test(tag)) break;
                } else if (node.nodeType === 3) {
                    const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
                    if (t) parts.push(t);
                }
                node = node.nextSibling;
            }

            explanation = parts.join(' ').replace(/\s+/g, ' ').trim();
        } else {
            // fallback: look for any block labelled Explanation deeper in the page
            const expl = $('h1,h2,h3,h4,h5,h6,strong').filter(function() {
                return /Explanation/i.test($(this).text ? $(this).text() : '');
            }).first();
            if (expl && expl.length) {
                explanation = (expl.parent().text ? expl.parent().text() : '').replace(/Explanation/i, '').replace(/\s+/g, ' ').trim();
            }
        }

        return { correct, explanation };
    } catch (err) {
        console.error('Failed to fetch answer detail', url, err.message || err);
        return { correct: undefined, explanation: '' };
    }
}

async function run(pageNumber = 1) {
    const questions = await scrapeJamb(pageNumber);
    for (const q of questions) {
        if (q.answerLink) {
            const detail = await fetchAnswerDetail(q.answerLink);
            q.correct = detail.correct;
            q.explanation = detail.explanation;
        }
    }

    console.log(questions);
}

module.exports = {
    getRandomUserAgent,
    scrapeJamb,
    fetchAnswerDetail,
};

if (require.main === module) {
    run(1).catch(err => console.error(err));
}