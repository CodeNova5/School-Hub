/**
 * AI Result Summarizer
 * Converts query results into natural language responses
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export interface SummaryResult {
  summary: string;
  error?: string;
}

/**
 * Generate a natural language summary of query results
 */
export async function summarizeResults(
  question: string,
  queryResults: any[],
  queryExplanation: string
): Promise<SummaryResult> {
  if (!GROQ_API_KEY) {
    return {
      summary: '',
      error: 'Groq API key not configured'
    };
  }

  // If no results, return a helpful message
  if (!queryResults || queryResults.length === 0) {
    return {
      summary: "I couldn't find any data matching your question. Please try rephrasing or check if the data exists in the system."
    };
  }

  const systemPrompt = buildSummarySystemPrompt();
  const userPrompt = buildSummaryUserPrompt(question, queryResults, queryExplanation);

  try {
    const message = `${systemPrompt}\n\nUser Query: ${userPrompt}`;
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Groq API error:', error);
      return {
        summary: '',
        error: 'Failed to generate summary'
      };
    }

    const data = await response.json();
    
    // Handle Groq response format (OpenAI-compatible)
    const summary = (data.choices?.[0]?.message?.content || '')?.trim();

    if (!summary) {
      console.error('Unexpected Groq response:', data);
      return {
        summary: '',
        error: 'No summary generated'
      };
    }

    return { summary };
  } catch (error) {
    console.error('Error generating summary:', error);
    return {
      summary: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Build the system prompt for summarization
 */
function buildSummarySystemPrompt(): string {
  return `You are a conversational AI assistant for a school management system. Your task is to convert query results into natural, engaging responses that feel like talking to a knowledgeable colleague.

**Tone & Style:**
- Be warm, approachable, and conversational
- Use natural language, not robotic phrasing
- Speak directly to the user (use "you", "your", etc.)
- Add a touch of personality while staying professional

**For Numerical Results:**
1. Lead with the key number prominently: "We have **15 students** enrolled this term"
2. Provide immediate context: "That's a 10% increase from last term"
3. Break down further if relevant: "Split across JSS1 (5), JSS2 (6), and JSS3 (4)"
4. End with insight: "This is a healthy enrollment for our capacity"

**For Multiple Results:**
- Use bullet points for clarity, but keep sentences conversational
- Group related items together
- Highlight notable patterns or outliers

**Formatting:**
- Use **bold** for emphasis and important numbers
- Use markdown headers (##) to organize complex data
- Use lists for multiple items - keep it concise
- Avoid robotic "Result 1:", "Result 2:" format

**If Data Shows Concerns:**
- Mention it tactfully but directly
- Suggest next steps (\"You might want to follow up on...\", \"Consider reviewing...\")
- Keep tone helpful, not alarming

**Response Length:**
- Keep it concise (2-4 sentences typically)
- Use line breaks for readability
- Save detailed analysis for follow-up questions

**Examples:**
- ❌ \"Found 1 result for your question: Result 1: • total_students: 3\"
- ✅ \"Great news! We currently have **3 students** enrolled.\"`;
}

/**
 * Build the user prompt with question and results
 */
function buildSummaryUserPrompt(
  question: string,
  queryResults: any[],
  queryExplanation: string
): string {
  // Limit results shown to AI (prevent token overflow)
  const maxResults = 100;
  const limitedResults = queryResults.slice(0, maxResults);
  const hasMore = queryResults.length > maxResults;

  let prompt = `**User's Question:** "${question}"\n\n`;
  prompt += `**Data Retrieved:** ${queryResults.length} result${queryResults.length !== 1 ? 's' : ''}\n\n`;
  prompt += JSON.stringify(limitedResults, null, 2);

  if (hasMore) {
    prompt += `\n\n(Note: Showing first ${maxResults} of ${queryResults.length} total results)`;
  }

  prompt += `\n\nRespond naturally to the user's question. Start with the answer directly, not "Found X results". Be conversational and highlight the most important information.`;

  return prompt;
}

/**
 * Generate a simple text summary without AI (fallback)
 */
export function generateSimpleSummary(
  question: string,
  queryResults: any[]
): string {
  if (!queryResults || queryResults.length === 0) {
    return "I couldn't find any data matching your question.";
  }

  const count = queryResults.length;
  const firstRow = queryResults[0];
  const columns = Object.keys(firstRow);

  let summary = `Found ${count} result${count !== 1 ? 's' : ''} for your question:\n\n`;

  // Show first few results
  const maxShow = Math.min(5, count);
  for (let i = 0; i < maxShow; i++) {
    const row = queryResults[i];
    summary += `**Result ${i + 1}:**\n`;
    for (const col of columns) {
      summary += `  • ${col}: ${row[col] ?? 'N/A'}\n`;
    }
    summary += '\n';
  }

  if (count > maxShow) {
    summary += `... and ${count - maxShow} more result${count - maxShow !== 1 ? 's' : ''}.`;
  }

  return summary;
}
