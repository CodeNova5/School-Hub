/**
 * AI Result Summarizer
 * Converts query results into natural language responses
 */

const APIFREELLM_API_KEY = process.env.APIFREELLM_API_KEY;

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
  if (!APIFREELLM_API_KEY) {
    return {
      summary: '',
      error: 'APIFreeLLM API key not configured'
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
    
    const response = await fetch('https://apifreellm.com/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APIFREELLM_API_KEY}`
      },
      body: JSON.stringify({
        message: message
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('APIFreeLLM API error:', error);
      return {
        summary: '',
        error: 'Failed to generate summary'
      };
    }

    const data = await response.json();
    
    // Handle APIFreeLLM response format
    const summary = (data.reply || data.message || data.response || data.text || '')?.trim();

    if (!summary) {
      console.error('Unexpected APIFreeLLM response:', data);
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
  return `You are an AI assistant for a school management system. Your task is to convert query results into clear, natural language responses.

**Guidelines:**
1. Be conversational and helpful
2. Present data in an organized, easy-to-read format
3. Use bullet points or numbered lists for multiple items
4. Include relevant details but keep it concise
5. If the data is numerical, provide context (e.g., "out of 50 students")
6. Use proper formatting with markdown when appropriate
7. Be precise with names, numbers, and dates
8. If results show a problem (e.g., low grades, absences), mention it tactfully
9. End with a helpful suggestion or next action when appropriate

**Formatting Examples:**
- For lists: Use bullet points (•) or numbered lists
- For tables: Use markdown tables when showing multiple data points
- For emphasis: Use **bold** for important information
- For names: Always capitalize properly

**Tone:** Professional but friendly, like a helpful school administrator.`;
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

  let prompt = `**User Question:** ${question}\n\n`;
  prompt += `**Query Explanation:** ${queryExplanation}\n\n`;
  prompt += `**Query Results (${queryResults.length} rows):**\n`;
  prompt += JSON.stringify(limitedResults, null, 2);

  if (hasMore) {
    prompt += `\n\n(Note: Showing first ${maxResults} of ${queryResults.length} total results)`;
  }

  prompt += `\n\nPlease provide a clear, natural language answer to the user's question based on these results.`;

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
