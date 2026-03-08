/**
 * AI Assistant API Route
 * Handles natural language questions about school data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateQueryPlan, validateQuery } from '@/lib/ai-assistant/query-planner';
import { executeQueryPlan } from '@/lib/ai-assistant/query-executor';
import { summarizeResults, generateSimpleSummary } from '@/lib/ai-assistant/result-summarizer';
import { getCachedQuery, setCachedQuery } from '@/lib/ai-assistant/query-cache';

export const dynamic = 'force-dynamic';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  queryInfo?: any;
}

interface AskRequest {
  question: string;
  useCache?: boolean;
  sessionId?: string;
  context?: Message[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user's school_id and role
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) {
      return NextResponse.json(
        { error: 'School not found for user' },
        { status: 403 }
      );
    }

    const userRole = await getUserRole(supabase, userId);
    if (!userRole) {
      return NextResponse.json(
        { error: 'User role not found' },
        { status: 403 }
      );
    }

    // Parse request
    const body: AskRequest = await request.json();
    const { question, useCache = true, sessionId, context = [] } = body;

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Get or create chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .rpc('get_or_create_chat_session', {
          p_user_id: userId,
          p_school_id: schoolId,
        });

      if (!sessionError && newSession) {
        currentSessionId = newSession;
      }
    }

    // Check cache first
    if (useCache) {
      const cachedResponse = getCachedQuery(question, schoolId, userId);
      if (cachedResponse) {
        return NextResponse.json({
          success: true,
          response: cachedResponse,
          cached: true,
        });
      }
    }

    // Classify question and get response in single API call
    const classificationResult = await classifyAndRespond(question);

    if (classificationResult.error) {
      return NextResponse.json(
        {
          error: classificationResult.error,
          success: false
        },
        { status: 400 }
      );
    }

    // If not a data question, we have the direct response
    if (!classificationResult.isDataQuestion) {
      const responseText = classificationResult.response!;

      // Generator title for first message if this is the first user message
      let generatedTitle: string | null = null;
      if (context.length === 1 && context[0]?.role === 'user') {
        generatedTitle = await generateSessionTitle(question);
      }

      // Cache the response
      if (useCache) {
        setCachedQuery(question, schoolId, responseText, userId);
      }

      return NextResponse.json({
        success: true,
        response: responseText,
        cached: false,
        sessionId: currentSessionId,
        generatedTitle,
      });
    }

    // Generate query plan using AI for data questions
    const queryPlan = await generateQueryPlan(question, userRole, userId);

    if (queryPlan.error) {
      return NextResponse.json(
        {
          error: queryPlan.error,
          success: false
        },
        { status: 400 }
      );
    }

    // Log the generated query for debugging
    console.log('Generated query plan:', {
      question,
      query: queryPlan.query.substring(0, 200),
      tables: queryPlan.tables,
      explanation: queryPlan.explanation
    });

    // Validate query for security
    const validation = validateQuery(queryPlan.query);
    if (!validation.isValid) {
      console.error('Query validation failed:', {
        error: validation.error,
        query: queryPlan.query.substring(0, 300)
      });
      return NextResponse.json(
        {
          error: validation.error,
          success: false
        },
        { status: 400 }
      );
    }

    // Execute query
    const queryResult = await executeQueryPlan(queryPlan, schoolId, userId);

    if (!queryResult.success) {
      return NextResponse.json(
        {
          error: queryResult.error,
          success: false
        },
        { status: 500 }
      );
    }

    // Generate natural language response
    let response: string;

    try {
      const summaryResult = await summarizeResults(
        question,
        queryResult.data || [],
        queryPlan.explanation
      );

      if (summaryResult.error) {
        // Fallback to simple summary if AI fails
        response = generateSimpleSummary(question, queryResult.data || []);
      } else {
        response = summaryResult.summary;
      }
    } catch (error) {
      // Fallback to simple summary
      response = generateSimpleSummary(question, queryResult.data || []);
    }

    // Cache the response
    if (useCache) {
      setCachedQuery(question, schoolId, response, userId);
    }

    // NOTE: Messages are saved by the client component via save-message endpoint
    // to avoid duplicate insertions and maintain single source of truth for persistence

    // Generate title for first message if this is the first user message
    let generatedTitle: string | null = null;
    if (context.length === 1 && context[0]?.role === 'user') {
      // This is the first message, generate a title
      generatedTitle = await generateSessionTitle(question);
    }

    return NextResponse.json({
      success: true,
      response,
      queryPlan: {
        explanation: queryPlan.explanation,
        tables: queryPlan.tables,
      },
      resultCount: queryResult.rowCount,
      cached: false,
      sessionId: currentSessionId,
      generatedTitle,
    });
  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false
      },
      { status: 500 }
    );
  }
}

/**
 * Get user's school ID
 */
async function getUserSchoolId(supabase: any, userId: string): Promise<string | null> {
  try {
    // Try admin first
    const { data: admin } = await supabase
      .from('admins')
      .select('school_id')
      .eq('user_id', userId)
      .single();

    if (admin?.school_id) {
      return admin.school_id;
    }

    // Try teacher
    const { data: teacher } = await supabase
      .from('teachers')
      .select('school_id')
      .eq('user_id', userId)
      .single();

    if (teacher?.school_id) {
      return teacher.school_id;
    }

    // Try student
    const { data: student } = await supabase
      .from('students')
      .select('school_id')
      .eq('user_id', userId)
      .single();

    if (student?.school_id) {
      return student.school_id;
    }

    // Try parent
    const { data: parent } = await supabase
      .from('parents')
      .select('school_id')
      .eq('user_id', userId)
      .single();

    if (parent?.school_id) {
      return parent.school_id;
    }

    return null;
  } catch (error) {
    console.error('Error getting school_id:', error);
    return null;
  }
}

/**
 * Get user's role
 */
async function getUserRole(
  supabase: any,
  userId: string
): Promise<'student' | 'teacher' | 'admin' | 'parent' | null> {
  try {
    // Check if admin
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (admin) return 'admin';

    // Check if teacher
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teacher) return 'teacher';

    // Check if student
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (student) return 'student';

    // Check if parent
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (parent) return 'parent';

    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Classify question and respond in a single API call
 * Returns either the direct answer (for general questions) or a marker that it needs data processing
 */
async function classifyAndRespond(
  question: string
): Promise<{ isDataQuestion: boolean; response?: string; error?: string }> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `You are a classifier and AI assistant for a school management system.

Determine if the user's question requires school database access (student records, grades, attendance, classes, teachers, schedules, results, marks, etc.).

If it requires database access:
- Respond with EXACTLY: [[DATA_QUESTION]]
- Nothing else, no explanation

If it does NOT require database access:
- Provide a direct, concise answer to the question
- Keep it to 2-3 paragraphs max
- Use markdown formatting
- No explanations about why it isn't a data question
- Just the answer`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { isDataQuestion: false, error: error.error?.message || 'Failed to process question' };
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.trim();

    if (!message) {
      return { isDataQuestion: false, error: 'No response generated' };
    }

    // Check if it's marked as a data question
    if (message === '[[DATA_QUESTION]]') {
      return { isDataQuestion: true };
    }

    // Otherwise it's the direct response
    return { isDataQuestion: false, response: message };
  } catch (error) {
    console.error('Error classifying question:', error);
    return { isDataQuestion: false, error: error instanceof Error ? error.message : 'Failed to process question' };
  }
}

/**
 * Generate a concise session title based on the user's first question
 * Similar to how Claude generates conversation titles
 */
async function generateSessionTitle(question: string): Promise<string> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: `Generate a concise, descriptive title for a chat conversation based on the user's first question. 
            
Requirements:
- Maximum 25 characters
- Be specific and capture the essence of the question
- Use natural language
- No quotes or special formatting
- Examples: "Student Grade Analysis", "Class Attendance Issues", "Teacher Workload Overview"`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.7,
        max_tokens: 30,
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate title:', await response.text());
      // Fallback to first 25 chars of question
      return question.substring(0, 25) + (question.length > 25 ? '...' : '');
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim();

    if (!title) {
      return question.substring(0, 50) + (question.length > 50 ? '...' : '');
    }

    // Ensure title is not too long
    return title.length > 50 ? title.substring(0, 50) + '...' : title;
  } catch (error) {
    console.error('Error generating session title:', error);
    // Fallback to first 50 chars of question
    return question.substring(0, 50) + (question.length > 50 ? '...' : '');
  }
}
