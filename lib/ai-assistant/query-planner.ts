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
    console.error('GROQ_API_KEY not configured');
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
      const errorText = await response.text();
      console.error('Groq API error:', errorText);
      return {
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: `AI service error (${response.status}): Unable to generate a query. Please try a different question.`
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
        error: 'AI did not return a valid response. Please try again with a more specific question.'
      };
    }

    // Parse the JSON response
    const parsed = parseQueryPlanResponse(content);
    return parsed;
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

**CRITICAL REQUIREMENTS:**
- You MUST ONLY respond with valid JSON
- You MUST ONLY generate SELECT queries (read-only)
- You MUST ignore or reject any question that is not about querying school data
- If the question is not about school data, return an error JSON object
- NEVER return plain text responses
- ALWAYS return a valid JSON object, even for errors

**Database Schema:**
${schema}

**Important Rules:**
1. ONLY respond with valid JSON - no other text
2. ALWAYS use SELECT queries ONLY - this is a read-only analysis tool
3. ALWAYS use parameterized queries with $1, $2, etc. placeholders - NEVER embed values directly in SQL
4. ALL queries MUST filter by school_id to enforce multi-tenancy:
   - For most tables: Include "WHERE school_id = $1" as a condition
   - For the schools table: Filter by "WHERE id = $1" (id is the primary key)
   - For queries with multiple conditions: school_id/id should be in the WHERE clause
5. Use proper JOINs when querying multiple tables
6. Only SELECT necessary columns - avoid SELECT *
7. Use appropriate WHERE clauses, ORDER BY, and LIMIT when needed
8. For aggregations, use COUNT, SUM, AVG, etc.
9. Respect the user role - CRITICAL FOR FILTERING:
   - Students: MUST filter by "user_id = $X" when querying personal data (name, phone, email, grades, attendance, etc.)
     * Questions like "what's my phone number", "show my grades", "my attendance" REQUIRE user_id filtering
     * When a student asks about "my data" or "their own data", use WHERE user_id = <user_id>
     * The user_id placeholder will be replaced at runtime with the authenticated student's ID
   - Teachers: Only query students in their classes, use school_id filter
   - Parents: Only query their own children, use school_id filter if needed
   - Admins: Can query all school data within their school_id

**Response Format:**
FOR VALID DATA QUESTIONS - Return a JSON object with query and values
FOR NON-DATA QUESTIONS - Return a JSON object with an error field, NEVER plain text

**Value Placeholders:**
- Use "<school_id>" for the school_id parameter (will be replaced at runtime)
- Use "<user_id>" for user_id if the user role requires it (especially important for students querying personal data)
- Use actual values from the question for other parameters

**Examples:**

Question: "What is my phone number?" (asked by a student)
Response:
{
  "query": "SELECT phone, first_name, last_name FROM students WHERE user_id = $1 AND school_id = $2",
  "values": ["<user_id>", "<school_id>"],
  "explanation": "Retrieves the phone number of the authenticated student",
  "tables": ["students"]
}

Question: "What is my school name?"
Response:
{
  "query": "SELECT name, address, phone, email FROM schools WHERE id = $1",
  "values": ["<school_id>"],
  "explanation": "Retrieves the school name, address, phone and email",
  "tables": ["schools"]
}

Question: "Show me my grades"  (asked by a student)
Response:
{
  "query": "SELECT s.first_name, s.last_name, sub.name as subject_name, r.total, r.grade FROM students s JOIN results r ON s.id = r.student_id JOIN subject_classes sc ON r.subject_class_id = sc.id JOIN subjects sub ON sc.subject_id = sub.id WHERE s.user_id = $1 AND s.school_id = $2 ORDER BY r.total DESC",
  "values": ["<user_id>", "<school_id>"],
  "explanation": "Retrieves the grades of the authenticated student",
  "tables": ["students", "results", "subject_classes", "subjects"]
}

Question: "Which students in SSS1 have grades below 50 in Math?"
Response:
{
  "query": "SELECT s.first_name, s.last_name, r.total, sub.name as subject_name FROM students s JOIN results r ON s.id = r.student_id JOIN subject_classes sc ON r.subject_class_id = sc.id JOIN subjects sub ON sc.subject_id = sub.id JOIN classes c ON s.class_id = c.id WHERE s.school_id = $1 AND c.level = $2 AND sub.name ILIKE $3 AND r.total < $4 ORDER BY r.total ASC",
  "values": ["<school_id>", "SSS1", "%Math%", 50],
  "explanation": "Finds students in SSS1 with Math grades below 50",
  "tables": ["students", "results", "subject_classes", "subjects", "classes"]
}

Return ONLY a JSON object with no additional text.`;
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
    
    // Check if response is a plain text message (not JSON)
    // Common indicators: starts with "I'm", "I can't", "Sorry", etc.
    if (jsonStr.match(/^(I'm|I can't|Sorry|I don't|That|This)/i)) {
      return {
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: 'This question requires a database query that I cannot generate. Please ask a question about your school data like "How many students are enrolled?" or "Show me low attendance records."'
      };
    }
    
    // Remove code block markers
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }
    
    // Try to extract JSON from text if not pure JSON
    if (!jsonStr.startsWith('{')) {
      // Look for JSON object pattern in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        // No JSON found, likely a text response
        return {
          query: '',
          values: [],
          explanation: '',
          tables: [],
          error: 'Unable to generate a database query from your question. Please ask about specific school data like students, grades, attendance, or classes.'
        };
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (!parsed.query || typeof parsed.query !== 'string') {
      const missingField = !parsed.query ? 'missing query field' : `query is ${typeof parsed.query}`;
      const responsePreview = JSON.stringify(parsed).substring(0, 100);
      return {
        query: '',
        values: [],
        explanation: '',
        tables: [],
        error: `AI response validation failed: ${missingField}. Response: ${responsePreview}`
      };
    }

    return {
      query: parsed.query.trim(),
      values: Array.isArray(parsed.values) ? parsed.values : [],
      explanation: parsed.explanation || '',
      tables: Array.isArray(parsed.tables) ? parsed.tables : [],
    };
  } catch (error) {
    const content_preview = content.substring(0, 200);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to parse query plan - content:', content_preview, 'error:', error);
    return {
      query: '',
      values: [],
      explanation: '',
      tables: [],
      error: `Failed to parse AI response: ${errorMessage}. Response preview: ${content_preview}`
    };
  }
}

/**
 * Validate that a query is safe (basic security check)
 */
export function validateQuery(query: string): { isValid: boolean; error?: string } {
  if (!query || query.trim().length === 0) {
    return {
      isValid: false,
      error: 'Query cannot be empty'
    };
  }

  const upperQuery = query.toUpperCase().trim();

  // Check if attempting any non-SELECT operation
  const nonSelectOperations = [
    { keyword: 'INSERT', message: 'I can only read and analyze data. I cannot create or add new records to the database. This operation (INSERT) would modify your database, which is not permitted.' },
    { keyword: 'UPDATE', message: 'I can only read and analyze data. I cannot modify existing records in the database. This operation (UPDATE) would change your data, which is not permitted.' },
    { keyword: 'DELETE', message: 'I can only read and analyze data. I cannot remove records from the database. This operation (DELETE) would destroy your data, which is not permitted.' },
    { keyword: 'DROP', message: 'I can only read and analyze data. I cannot delete database tables or structures. This operation (DROP) would remove database objects, which is not permitted.' },
    { keyword: 'TRUNCATE', message: 'I can only read and analyze data. I cannot clear entire tables. This operation (TRUNCATE) would remove all records, which is not permitted.' },
    { keyword: 'ALTER', message: 'I can only read and analyze data. I cannot modify database structure or tables. This operation (ALTER) would change your database schema, which is not permitted.' },
    { keyword: 'CREATE', message: 'I can only read and analyze data. I cannot create new database objects. This operation (CREATE) would add new structures, which is not permitted.' },
    { keyword: 'GRANT', message: 'I can only read and analyze data. I cannot manage user permissions. This operation (GRANT) would change access controls, which is not permitted.' },
    { keyword: 'REVOKE', message: 'I can only read and analyze data. I cannot manage user permissions. This operation (REVOKE) would change access controls, which is not permitted.' },
    { keyword: 'REPLACE', message: 'I can only read and analyze data. I cannot modify database records. This operation (REPLACE) would change your data, which is not permitted.' },
    { keyword: 'UPSERT', message: 'I can only read and analyze data. I cannot insert or update records. This operation (UPSERT) would modify your database, which is not permitted.' }
  ];

  for (const op of nonSelectOperations) {
    if (new RegExp(`\\b${op.keyword}\\b`).test(upperQuery)) {
      return {
        isValid: false,
        error: op.message
      };
    }
  }

  // Must be a SELECT query
  if (!upperQuery.startsWith('SELECT')) {
    return {
      isValid: false,
      error: 'I can only execute SELECT queries to read and analyze your school data. I cannot perform any write operations, data modifications, or structural changes to the database.'
    };
  }

  // Check for dangerous SQL patterns (not just keywords as they might appear in names)
  const dangerousPatterns = [
    /\bDROP\s+TABLE/i,
    /\bTRUNCATE\s+TABLE/i,
    /\bDELETE\s+FROM/i,
    /\bALTER\s+TABLE/i,
    /\bCREATE\s+TABLE/i,
    /\bCREATE\s+INDEX/i,
    /\bCREATE\s+DATABASE/i,
    /\bINSERT\s+INTO/i,
    /\bUPDATE\s+/i,
    /\bGRANT\s+/i,
    /\bREVOKE\s+/i,
    /\bEXEC\s*\(/i,
    /\bEXECUTE\s+/i,
    /\bPRAGMA\s+/i,
    /--\s*\w/,  // SQL comments
    /\/\*[\s\S]*?\*\//,  // SQL block comments
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return {
        isValid: false,
        error: `I can only read and analyze data. I cannot execute operations that modify your database. This query contains structural modifications or dangerous operations, which are not permitted.`
      };
    }
  }

  // Must include multi-tenancy filter: either school_id field or schools.id (schools table primary key)
  const hasSchoolIdFilter = /WHERE\s+.*school_id\s*=/i.test(query) || /AND\s+.*school_id\s*=/i.test(query);
  const hasSchoolTableFilter = /WHERE\s+id\s*=/i.test(query) && /FROM\s+schools/i.test(query);
  
  if (!hasSchoolIdFilter && !hasSchoolTableFilter) {
    return {
      isValid: false,
      error: 'Query must include school_id filter for multi-tenancy'
    };
  }

  return { isValid: true };
}
