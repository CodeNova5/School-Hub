/**
 * AI Query Planner
 * Uses Groq to convert natural language questions into safe SQL queries
 */

import { getSchemaDescription } from './schema-description';

export interface QueryPlan {
  query: string;
  values: any[];
  explanation: string;
  tables: string[];
  error?: string;
  isTruncated?: boolean; // Indicates if results were limited
  limitApplied?: number;  // The limit that was applied
}

const GEMINI_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY;

// Safe query limits to prevent returning entire database
const QUERY_LIMITS = {
  DEFAULT: 100,        // Default limit for most queries
  LARGE_TABLES: 50,    // Tables that could be very large (students, users)
  AGGREGATION: 1000,   // Aggregation queries can return more
} as const;

// Maximum result set size to warn user
const RESULT_SET_WARNING_THRESHOLD = 1000;

/**
 * Generate a SQL query plan from a natural language question
 */
export async function generateQueryPlan(
  question: string,
  userRole: 'student' | 'teacher' | 'admin' | 'parent',
  userId?: string
): Promise<QueryPlan> {
  if (!GEMINI_API_KEY) {
    console.error('GOOGLE_AI_STUDIO_KEY not configured');
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: 'AI service is not properly configured. Please contact system administrator.'
    };
  }

  const schema = getSchemaDescription();
  const systemPrompt = buildSystemPrompt(schema, userRole);
  const userPrompt = buildUserPrompt(question, userId);

  try {
    // Combine system and user prompts for Gemini
    const combinedPrompt = `${systemPrompt}\n\nUser Question:\n${userPrompt}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: combinedPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1, // Low temperature = deterministic, structurally sound SQL
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return {
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: `AI service error (${response.status}): Unable to generate a query. Please try a different question.`
      };
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error('Unexpected Gemini response:', data);
      return {
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: 'AI did not return a valid response. Please try again with a more specific question.'
      };
    }

    // Parse the JSON response safely
    return parseQueryPlanResponse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error generating query plan:', error);
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: `Failed to process your question: ${errorMessage}. Please try rephrasing it.`
    };
  }
}

/**
 * Build the system prompt with schema information
 */
function buildSystemPrompt(schema: string, userRole: string): string {
  return `You are a SQL query generator for a school management system. Your ONLY task is to convert questions about school data into safe, parameterized PostgreSQL SELECT queries.

**Current User Role:** ${userRole}

**CRITICAL REQUIREMENTS:**
- You MUST respond with a valid JSON object matching the defined schema layout.
- You MUST ONLY generate SELECT queries (read-only).
- NEVER return plain text or markdown wrappers outside the JSON string.

**Database Schema:**
${schema}

**Important Rules:**
1. ALWAYS use SELECT queries ONLY.
2. ALWAYS use parameterized queries with $1, $2, etc. placeholders - NEVER embed values directly in SQL text string literals.
3. Use proper explicit JOINs when querying multiple tables.
4. Only SELECT necessary columns - avoid using SELECT *.
5. **Use LIMIT clauses on row-returning queries when reasonable:**
   - For listing/browsing queries, ALWAYS append LIMIT 50.
   - For queries returning many rows, default to LIMIT 100.
   - Unbounded queries are structural failures.
   - If the question asks for "all" records, limit your response selection to 50 items and note this limitation explicitly in the "explanation".
6. For scalar aggregations (COUNT, SUM, AVG, MIN, MAX) without a GROUP BY statement, do not provide a LIMIT clause.

**Response Format JSON Schema Structure:**
{
  "query": "SELECT ... FROM ... WHERE ...",
  "values": ["value1", "value2"],
  "explanation": "A concise explanation of the data being pulled.",
  "tables": ["table1", "table2"],
  "error": "Optional failure message string if rules are violated."
}

**Value Placeholders Rules:**
- If the query needs tenant or user scoping, inject literal "<school_id>" or "<user_id>" tokens into the values collection for binding.`;
}

function buildUserPrompt(question: string, userId?: string): string {
  return JSON.stringify({
    task: "Generate a SQL query plan",
    question: question,
    authenticatedUserId: userId || null
  });
}

/**
 * Parse the query plan response from AI
 */
function parseQueryPlanResponse(content: string): QueryPlan {
  try {
    let jsonStr = content.trim();
    
    // Clean potential markdown formatting leftovers
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr);

    // Ensure we have a values array even if AI omitted it
    const valuesArray = Array.isArray(parsed.values) ? parsed.values : [];

    if (parsed.error) {
      return {
        query: '',
        values: valuesArray,
        explanation: parsed.explanation || '',
        tables: Array.isArray(parsed.tables) ? parsed.tables : [],
        error: parsed.error
      };
    }

    if (!parsed.query || typeof parsed.query !== 'string') {
      return {
        query: '',
        values: valuesArray,
        explanation: '',
        tables: [],
        error: 'AI response failed schema compliance. No query string was found.'
      };
    }

    // Validate that positional placeholders ($1, $2...) have corresponding values
    const placeholderMatches = [...String(parsed.query).matchAll(/\$([1-9][0-9]*)/g)].map(m => parseInt(m[1], 10));
    const maxPlaceholder = placeholderMatches.length ? Math.max(...placeholderMatches) : 0;
    if (maxPlaceholder > valuesArray.length) {
      return {
        query: '',
        values: valuesArray,
        explanation: parsed.explanation || '',
        tables: Array.isArray(parsed.tables) ? parsed.tables : [],
        error: `AI response schema violation: Query expects ${maxPlaceholder} parameter(s) but only ${valuesArray.length} value(s) were provided. Ensure the values array matches $ placeholders.`
      };
    }

    return {
      query: parsed.query.trim(),
      values: valuesArray,
      explanation: parsed.explanation || '',
      tables: Array.isArray(parsed.tables) ? parsed.tables : [],
    };
  } catch (error) {
    console.error('Failed to parse query plan JSON:', content, error);
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: 'Failed to process AI internal payload context.'
    };
  }
}

/**
 * Validate that a query is safe (advanced safety & validation checks)
 */
export function validateQuery(query: string): { isValid: boolean; error?: string; suggestion?: string } {
  if (!query || query.trim().length === 0) {
    return { isValid: false, error: 'Query cannot be empty' };
  }

  const normalizedQuery = query.trim().replace(/;+\s*$/, '');
  const upperQuery = normalizedQuery.toUpperCase().replace(/\s+/g, ' ').trim();

  // 1. Structural Write Operation Interceptions
  const nonSelectOperations = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE', 'REPLACE', 'UPSERT'];
  for (const op of nonSelectOperations) {
    if (new RegExp(`\\b${op}\\b`).test(upperQuery)) {
      return {
        isValid: false,
        error: `Read-only system exception. Mutation operation (${op}) is prohibited.`
      };
    }
  }

  if (!upperQuery.startsWith('SELECT')) {
    return {
      isValid: false,
      error: 'Only read-only SELECT statements are supported on this endpoint.'
    };
  }

  // 2. Dangerous Token Parsing Safeguards
  const dangerousPatterns = [/--/, /\/\*/];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalizedQuery)) {
      return {
        isValid: false,
        error: 'Query blocked: Contains unsafe structures or command chaining markers.'
      };
    }
  }

  // FIX 4: Flexible multi-tenancy verification handling aliases (e.g., s.school_id, schools.id)
  const hasSchoolIdFilter = /\b([a-zA-Z0-9_]+\.)?school_id\s*=/i.test(upperQuery);
  const hasSchoolTableFilter = /\bFROM\s+schools\b/i.test(upperQuery) && /\b([a-zA-Z0-9_]+\.)?id\s*=/i.test(upperQuery);
  const hasUserIdFilter = /\b([a-zA-Z0-9_]+\.)?user_id\s*=/i.test(upperQuery);
  
  if (!hasSchoolIdFilter && !hasSchoolTableFilter && !hasUserIdFilter) {
    return {
      isValid: false,
      error: 'Query violates security criteria: Missing structural school context verification filters.'
    };
  }

  // FIX 5: Comprehensive Aggregation Parsing Matrix
  // Catch any common aggregation type functions: COUNT(...), SUM(...), AVG(...), MAX(...), MIN(...)
  const hasAggregation = /\b(COUNT|SUM|AVG|MAX|MIN)\s*\(.*\)/i.test(upperQuery);
  const hasGroupBy = /\bGROUP\s+BY\b/i.test(upperQuery);
  const hasLimit = /\bLIMIT\s+\d+/i.test(upperQuery);

  // Conditions requiring a LIMIT clause:
  // - Plain queries fetching raw records (No Aggregations)
  // - Queries containing aggregation methods combined with GROUP BY divisions
  if (!hasLimit && (!hasAggregation || hasGroupBy)) {
    return {
      isValid: false,
      error: 'Query execution boundary fault: Explicit LIMIT clause required to minimize performance footprint.',
      suggestion: `Append a trailing LIMIT criteria setting (e.g., LIMIT ${QUERY_LIMITS.DEFAULT}).`
    };
  }

  // 3. Bound Cap Inspection Check
  const limitMatch = upperQuery.match(/\bLIMIT\s+(\d+)/);
  if (limitMatch) {
    const limitValue = parseInt(limitMatch[1], 10);
    if (limitValue > RESULT_SET_WARNING_THRESHOLD) {
      return {
        isValid: false,
        error: `Query pagination window scope is too high (${limitValue}). Safe upper ceiling threshold is ${RESULT_SET_WARNING_THRESHOLD}.`,
        suggestion: `Lower execution boundaries inside query configuration parameters to ${QUERY_LIMITS.DEFAULT}.`
      };
    }
  }

  return { isValid: true };
}