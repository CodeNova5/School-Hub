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

    // Generate query plan using AI
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

    // Save user message to database
    if (currentSessionId) {
      await supabase.rpc('save_chat_message', {
        p_session_id: currentSessionId,
        p_user_id: userId,
        p_school_id: schoolId,
        p_role: 'user',
        p_content: question,
        p_query_plan: null,
        p_error: false,
      });

      // Save assistant response to database
      await supabase.rpc('save_chat_message', {
        p_session_id: currentSessionId,
        p_user_id: userId,
        p_school_id: schoolId,
        p_role: 'assistant',
        p_content: response,
        p_query_plan: JSON.stringify({
          explanation: queryPlan.explanation,
          tables: queryPlan.tables,
          resultCount: queryResult.rowCount,
        }),
        p_error: false,
      });
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
