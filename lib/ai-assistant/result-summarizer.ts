/**
 * AI Result Summarizer
 * Converts query results into natural language responses
 */

import { fetchGroqChatCompletion } from './groq-client';

const GROQ_MODEL = 'openai/gpt-oss-20b';

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
  queryExplanation: string,
  executionError?: string
): Promise<SummaryResult> {
  if (executionError) {
    return {
      summary: executionError
    };
  }

  if (!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEYS) {
    return {
      summary: '',
      error: 'Groq API key not configured'
    };
  }

  // If no results, provide a clean, context-appropriate message
  if (!queryResults || queryResults.length === 0) {
    return {
      summary: "I couldn't find any data matching your question. Please try rephrasing or check if the data exists in the system."
    };
  }

  const systemPrompt = buildSummarySystemPrompt();
  const userPrompt = buildSummaryUserPrompt(question, queryResults, queryExplanation);

  try {
    // Combine system and user prompts for Groq
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

    const result = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: combinedPrompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 512,
    });

    if (!result.ok) {
      console.error('Groq API error:', result.error);
      return {
        summary: '',
        error: result.status === 429
          ? `Groq is temporarily rate limited. Please retry in ${result.retryAfterSeconds || 60} seconds.`
          : 'Failed to generate summary'
      };
    }

    const data = result.data;
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
  return `You are a conversational AI assistant for a school management system. Your task is to convert database query results into natural, engaging responses that feel like talking to a helpful colleague.

**Tone & Style:**
- Be warm, approachable, and highly conversational.
- Use natural language; avoid robotic phrasing.
- Speak directly to the user (use "you", "your", etc.).
- Maintain a professional yet personable persona.

**Data Presentation Rules:**
1. **For Numerical/Count Results:** Lead with the key number prominently (e.g., "We have **15 students** enrolled this term"). Break it down further if relevant data is present, and end with a brief helpful insight.
2. **For Multiple Row Results:** Group related items cleanly, highlight notable patterns or outliers, and use conversational bullet points rather than dumping long raw rows.
3. **Avoid Technical Clutter:** Never mention terms like "query", "database", "rows", "table", "Result 1", or internal column IDs unless directly asked.

**Formatting Constraints:**
- Use markdown bold (**text**) exclusively for numbers, metrics, or critical names.
- Use markdown headers (##) only when separating complex sections of data.
- Keep the overall response concise (typically 2 to 5 sentences) unless the user explicitly requested an exhaustive breakdown.

**If Data Shows Concerns or Low Performance:**
- Frame anomalies tactfully but directly (e.g., notice low attendance or failing marks).
- Softly suggest actionable steps ("You might want to check in on...", "Consider reviewing...").`;
}

/**
 * Build the user prompt with question and results
 */
function buildSummaryUserPrompt(
  question: string,
  queryResults: any[],
  queryExplanation: string
): string {
  // Limit results shown to AI to prevent context window saturation
  const maxResults = 50; // Lowered slightly to ensure higher efficiency and low latency
  const limitedResults = queryResults.slice(0, maxResults);
  const hasMore = queryResults.length > maxResults;

  return JSON.stringify({
    userQuestion: question,
    queryIntentContext: queryExplanation,
    totalRecordsFound: queryResults.length,
    resultsSample: limitedResults,
    truncatedDataWarning: hasMore ? `Showing first ${maxResults} rows out of ${queryResults.length} total rows.` : null
  });
}

/**
 * Generate a clean text summary without AI (Robust fallback strategy)
 */
export function generateSimpleSummary(
  question: string,
  queryResults: any[]
): string {
  if (!queryResults || queryResults.length === 0) {
    return "I couldn't find any data matching your question.";
  }

  const count = queryResults.length;

  if (count === 1) {
    const row = queryResults[0] || {};
    const questionLower = question.toLowerCase();

    if (looksLikeSchoolIdentityQuestion(questionLower) && hasMeaningfulValue(row.name)) {
      const details: string[] = [];
      if (hasMeaningfulValue(row.address)) details.push(`**Address:** ${row.address}`);
      if (hasMeaningfulValue(row.phone)) details.push(`**Phone:** ${row.phone}`);
      if (hasMeaningfulValue(row.email)) details.push(`**Email:** ${row.email}`);

      if (details.length === 0) {
        return `Your school name is **${row.name}**.`;
      }

      return `Your school is **${row.name}**.\n\n${details.join('\n')}`;
    }

    const formattedPairs = formatRowAsPairs(row);
    if (formattedPairs.length === 1) {
      return `${formattedPairs[0].label}: **${formattedPairs[0].value}**.`;
    }

    if (formattedPairs.length > 1) {
      const lines = formattedPairs.slice(0, 6).map((item) => `• **${item.label}**: ${item.value}`);
      return `Here is the record I found:\n\n${lines.join('\n')}`;
    }
  }

  const maxShow = Math.min(5, count);
  const lines: string[] = [];

  for (let i = 0; i < maxShow; i++) {
    const row = queryResults[i] || {};
    const formattedPairs = formatRowAsPairs(row).slice(0, 3);

    if (formattedPairs.length === 0) continue;

    const rowSummary = formattedPairs
      .map((item) => `${item.label}: ${item.value}`)
      .join(' • ');
    lines.push(`• ${rowSummary}`);
  }

  if (lines.length === 0) {
    return `I found **${count}** matching records, but there are no readable fields to display.`;
  }

  const remainingRecordsNotice = count > maxShow
    ? `\n\n(Showing the first ${maxShow} of ${count} records)`
    : '';

  return `I found **${count}** results matching your inquiry:\n\n${lines.join('\n')}${remainingRecordsNotice}`;
}

function looksLikeSchoolIdentityQuestion(questionLower: string): boolean {
  return (
    questionLower.includes('school name') ||
    questionLower.includes('my school') ||
    questionLower.includes('name of my school') ||
    questionLower.includes('what school')
  );
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'n/a') return false;
  }
  return true;
}

function humanizeFieldName(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\bid\b/i, 'ID')
    .replace(/\burl\b/i, 'URL')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatRowAsPairs(row: Record<string, unknown>): Array<{ label: string; value: string }> {
  return Object.keys(row)
    .map((key) => ({
      label: humanizeFieldName(key),
      value: formatValue(row[key]),
    }))
    .filter((item) => hasMeaningfulValue(item.value));
}