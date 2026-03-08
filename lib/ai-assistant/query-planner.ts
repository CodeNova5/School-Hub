/**
 * AI Query Planner
 * Uses OpenAI to convert natural language questions into safe SQL queries
 */

import { getSchemaDescription } from './schema-description';

export interface QueryPlan {
  query: string;
  values: any[];
  explanation: string;
  tables: string[];
  error?: string;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/**
 * Generate a SQL query plan from a natural language question
 */
export async function generateQueryPlan(
  question: string,
  userRole: 'student' | 'teacher' | 'admin' | 'parent',
  userId?: string
): Promise<QueryPlan> {
  if (!GROQ_API_KEY) {
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: 'Groq API key not configured'
    };
  }

  const schema = getSchemaDescription();
  const systemPrompt = buildSystemPrompt(schema, userRole);
  const userPrompt = buildUserPrompt(question, userId);

  try {
    const message = `${systemPrompt}\n\nUser Question: ${userPrompt}`;
    
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
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: 'Failed to generate query plan'
      };
    }

    const data = await response.json();
    
    // Handle Groq response format (OpenAI-compatible)
    let content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('Unexpected Groq response:', data);
      return {
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: 'No response from AI'
      };
    }

    // Parse the JSON response
    const parsed = parseQueryPlanResponse(content);
    return parsed;
  } catch (error) {
    console.error('Error generating query plan:', error);
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Build the system prompt with schema information
 */
function buildSystemPrompt(schema: string, userRole: string): string {
  return `You are a SQL query generator for a school management system. Your task is to convert natural language questions into safe, parameterized PostgreSQL queries.

**Database Schema:**
${schema}

**Important Rules:**
1. ALWAYS use parameterized queries with $1, $2, etc. placeholders - NEVER embed values directly in SQL
2. ALL queries MUST filter by school_id to enforce multi-tenancy:
   - For most tables: Include "WHERE school_id = $1" as a condition
   - For the schools table: Filter by "WHERE id = $1" (id is the primary key)
   - For queries with multiple conditions: school_id/id should be in the WHERE clause
3. Use proper JOINs when querying multiple tables
4. Only SELECT necessary columns - avoid SELECT *
5. Use appropriate WHERE clauses, ORDER BY, and LIMIT when needed
6. For aggregations, use COUNT, SUM, AVG, etc.
7. Respect the user role: ${userRole}
   - Students: Only query their own data
   - Teachers: Only query students in their classes
   - Parents: Only query their own children
   - Admins: Can query all school data
8. Return a valid JSON object with this exact structure:
{
  "query": "SELECT ... FROM ... WHERE school_id = $1 AND ...",
  "values": ["<school_id>", "<other_values>"],
  "explanation": "Brief explanation of what the query does",
  "tables": ["table1", "table2"]
}

**Value Placeholders:**
- Use "<school_id>" for the school_id parameter (will be replaced at runtime)
- Use "<user_id>" for user_id if the user role requires it
- Use actual values from the question for other parameters

**Examples:**

Question: "What is my school name?"
Response:
{
  "query": "SELECT name, address, phone, email FROM schools WHERE id = $1",
  "values": ["<school_id>"],
  "explanation": "Retrieves the school name, address, phone and email",
  "tables": ["schools"]
}

Question: "Which students in SSS1 have grades below 50 in Math?"
Response:
{
  "query": "SELECT s.first_name, s.last_name, r.total, sub.name as subject_name FROM students s JOIN results r ON s.id = r.student_id JOIN subject_classes sc ON r.subject_class_id = sc.id JOIN subjects sub ON sc.subject_id = sub.id JOIN classes c ON s.class_id = c.id WHERE s.school_id = $1 AND c.level = $2 AND sub.name ILIKE $3 AND r.total < $4 ORDER BY r.total ASC",
  "values": ["<school_id>", "SSS1", "%Math%", 50],
  "explanation": "Finds students in SSS1 with Math grades below 50",
  "tables": ["students", "results", "subject_classes", "subjects", "classes"]
}

Question: "Who is the teacher for Science in SSS2?"
Response:
{
  "query": "SELECT t.first_name, t.last_name, t.email, sub.name as subject_name, c.name as class_name FROM teachers t JOIN subject_classes sc ON t.id = sc.teacher_id JOIN subjects sub ON sc.subject_id = sub.id JOIN classes c ON sc.class_id = c.id WHERE t.school_id = $1 AND sub.name ILIKE $2 AND c.level = $3",
  "values": ["<school_id>", "%Science%", "SSS2"],
  "explanation": "Finds the teacher assigned to Science in SSS2",
  "tables": ["teachers", "subject_classes", "subjects", "classes"]
}

Question: "How many students are in Primary 4?"
Response:
{
  "query": "SELECT COUNT(*) as student_count, c.name as class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.school_id = $1 AND c.level = $2 AND s.status = $3 GROUP BY c.name",
  "values": ["<school_id>", "Primary 4", "active"],
  "explanation": "Counts active students in Primary 4",
  "tables": ["students", "classes"]
}

Return ONLY the JSON object, no additional text.`;
}

/**
 * Build the user prompt with the question
 */
function buildUserPrompt(question: string, userId?: string): string {
  let prompt = `Generate a SQL query for this question: "${question}"`;
  
  if (userId) {
    prompt += `\n\nUser ID: ${userId} (use "<user_id>" placeholder if needed for filtering)`;
  }

  return prompt;
}

/**
 * Parse the query plan response from AI
 */
function parseQueryPlanResponse(content: string): QueryPlan {
  try {
    // Remove markdown code blocks if present
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr);

    return {
      query: parsed.query || '',
      values: parsed.values || [],
      explanation: parsed.explanation || '',
      tables: parsed.tables || [],
    };
  } catch (error) {
    console.error('Failed to parse query plan:', content, error);
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: 'Failed to parse AI response'
    };
  }
}

/**
 * Validate that a query is safe (basic security check)
 */
export function validateQuery(query: string): { isValid: boolean; error?: string } {
  const upperQuery = query.toUpperCase();

  // Check for dangerous operations
  const dangerousKeywords = [
    'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 
    'INSERT', 'UPDATE', 'GRANT', 'REVOKE', 'EXEC', 
    'EXECUTE', 'PRAGMA', '--', '/*', '*/', ';'
  ];

  for (const keyword of dangerousKeywords) {
    if (upperQuery.includes(keyword)) {
      return {
        isValid: false,
        error: `Query contains dangerous keyword: ${keyword}`
      };
    }
  }

  // Must be a SELECT query
  if (!upperQuery.startsWith('SELECT')) {
    return {
      isValid: false,
      error: 'Only SELECT queries are allowed'
    };
  }

  // Must include multi-tenancy filter: either school_id field or schools.id (schools table primary key)
  const hasSchoolIdFilter = query.includes('school_id');
  const hasSchoolTableFilter = /schools\.id\s*=|WHERE\s+id\s*=/i.test(query);
  
  if (!hasSchoolIdFilter && !hasSchoolTableFilter) {
    return {
      isValid: false,
      error: 'Query must include school_id filter for multi-tenancy'
    };
  }

  return { isValid: true };
}
