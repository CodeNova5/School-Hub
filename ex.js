const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const {
    scrapeJamb,
    fetchAnswerDetail,
    getRandomUserAgent,
} = require('./jamb');

const BASE_URL = 'https://myschool.ng';

// Helper to extract math source before stripping tags
function getMathAwareText($, el) {
    const clone = $(el).clone();

    // 1. Find MathJax script tags (Common in older/standard MathJax)
    clone.find('script[type^="math/tex"]').each((_, script) => {
        const latex = $(script).html();
        $(script).replaceWith(` $${latex}$ `);
    });

    // 2. Find MathJax 3+ containers (Common in modern sites)
    clone.find('mjx-container').each((_, container) => {
        // Many sites put the TeX in the 'data-tex' or 'aria-label'
        const tex = $(container).attr('data-tex') || $(container).attr('aria-label') || '';
        $(container).replaceWith(` $${tex}$ `);
    });

    return clone.text().replace(/\s+/g, ' ').trim();
}
app.get('/', async (req, res) => {
    try {
        // Scrape page 1 for demonstration
        const questions = await scrapeJamb(1) || [];
        
        // Detailed fetching (doing a few for speed)
        for (let i = 0; i < Math.min(questions.length, 5); i++) {
            if (questions[i].answerLink) {
                const detail = await fetchAnswerDetail(questions[i].answerLink);
                questions[i].correct = detail.correct;
                questions[i].explanation = detail.explanation;
            }
        }

        // Generate simple HTML with KaTeX Auto-render
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Jamb Questions</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" 
                onload="renderMathInElement(document.body);"></script>
            <style>
                body { font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 800px; margin: auto; }
                .q-card { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
                .opt { margin-left: 20px; color: #444; }
                .correct { color: green; font-weight: bold; }
                .explanation { background: #f9f9f9; padding: 10px; border-left: 4px solid #007bff; }
            </style>
        </head>
        <body>
            <h1>Mathematics Questions</h1>
            ${questions.map(q => `
                <div class="q-card">
                    <p><strong>Question:</strong> ${q.question}</p>
                    <div>${q.options.map(opt => `<div class="opt">${opt}</div>`).join('')}</div>
                    ${q.correct ? `<p class="correct">Correct Answer: ${q.correct}</p>` : ''}
                    ${q.explanation ? `<div class="explanation"><strong>Explanation:</strong> ${q.explanation}</div>` : ''}
                </div>
            `).join('')}
        </body>
        </html>`;

        res.send(html);
    } catch (err) {
        res.status(500).send("Error scraping data");
    }
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));