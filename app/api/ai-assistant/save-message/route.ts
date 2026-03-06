/**
 * Save Chat Message API Route
 * Persists chat messages to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { checkIsAdminWithSchool, errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

interface SaveMessageRequest {
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  queryPlan?: {
    explanation: string;
    tables: string[];
    resultCount?: number;
  };
  error?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check if user is admin and get school_id
    const permission = await checkIsAdminWithSchool();
    if (!permission.authorized) {
      return errorResponse(permission.error || 'Unauthorized', permission.status || 401);
    }

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
    const schoolId = permission.schoolId;

    const body: SaveMessageRequest = await request.json();
    const { sessionId, role, content, queryPlan, error: isError = false } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .rpc('get_or_create_chat_session', {
          p_user_id: userId,
          p_school_id: schoolId,
        });

      if (sessionError || !newSession) {
        return NextResponse.json(
          { error: 'Failed to create chat session' },
          { status: 500 }
        );
      }

      currentSessionId = newSession;
    }

    // Save message using the database function
    const { data: messageId, error: saveError } = await supabase
      .rpc('save_chat_message', {
        p_session_id: currentSessionId,
        p_user_id: userId,
        p_school_id: schoolId,
        p_role: role,
        p_content: content,
        p_query_plan: queryPlan ? JSON.stringify(queryPlan) : null,
        p_error: isError,
      });

    if (saveError || !messageId) {
      console.error('Save message error:', saveError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId,
      sessionId: currentSessionId,
    });
  } catch (error) {
    console.error('Error saving message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
