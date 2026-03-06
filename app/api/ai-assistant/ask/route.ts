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

interface AskRequest {
  question: string;
  useCache?: boolean;
  sessionId?: string;
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
    const { question, useCache = true, sessionId } = body;

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

    // Detect if this is a data-related question
    const isDataQuestion = await detectDataQuestion(question);

    // If not a data question, answer directly using AI
    if (!isDataQuestion) {
      const directResponse = await generateDirectResponse(question);

      if (directResponse.error || !directResponse.response) {
        return NextResponse.json(
          {
            error: directResponse.error || 'No response generated',
            success: false
          },
          { status: 400 }
        );
      }

      const responseText = directResponse.response;

      // Cache the response
      if (useCache) {
        setCachedQuery(question, schoolId, responseText, userId);
      }

      return NextResponse.json({
        success: true,
        response: responseText,
        cached: false,
        sessionId: currentSessionId,
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

    // Validate query for security
    const validation = validateQuery(queryPlan.query);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: `Query validation failed: ${validation.error}`,
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
 * Detect if a question is data-related or general
 * Returns true if the question requires database queries
 */
async function detectDataQuestion(question: string): Promise<boolean> {
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
            content: `You are a classifier that determines if a question is about school data/database queries or a general question.

Respond with ONLY "DATA" or "GENERAL".

DATA questions: Questions about students, grades, attendance, classes, teachers, schedules, results, marks, etc. that would require database queries.
GENERAL questions: Common knowledge, advice, explanations, definitions, how-to questions, etc.`,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0,
        max_tokens: 5,
      }),
    });

    const data = await response.json();
    const classification = data.choices?.[0]?.message?.content?.trim().toUpperCase();

    return classification === 'DATA';
  } catch (error) {
    console.error('Error detecting question type:', error);
    // Default to data question if detection fails
    return true;
  }
}

/**
 * Generate a direct response to a general question using AI
 */
async function generateDirectResponse(
  question: string
): Promise<{ response?: string; error?: string }> {
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
            content: `You are a helpful AI assistant for a school management system. 
Answer the user's question concisely and helpfully.
Keep responses to 2-3 paragraphs max.
Use markdown formatting for better readability.`,
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
      return { error: error.error?.message || 'Failed to generate response' };
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content;

    if (!message) {
      return { error: 'No response generated' };
    }

    return { response: message };
  } catch (error) {
    console.error('Error generating direct response:', error);
    return { error: error instanceof Error ? error.message : 'Failed to generate response' };
  }
}
