/**
 * Save Chat Message API Route
 * Persists chat messages to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { errorResponse, getAiAssistantContext } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

interface SaveMessageRequest {
  sessionId?: string;
  role: 'user' | 'assistant';
  content: string;
  generatedTitle?: string;
  queryPlan?: {
    explanation: string;
    tables: string[];
    resultCount?: number;
  };
  error?: boolean;
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

    const context = await getAiAssistantContext();
    if (!context.authorized) {
      return errorResponse(context.error || 'Forbidden', context.status || 403);
    }

    const schoolId = context.schoolId;

    const body: SaveMessageRequest = await request.json();
    const { sessionId, role, content, generatedTitle, queryPlan, error: isError = false } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    // Get or create session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const createSessionResponse = await supabase.rpc('create_chat_session', {
        p_user_id: userId,
        p_school_id: schoolId,
      });

      if (createSessionResponse.error || !createSessionResponse.data) {
        const fallbackSessionResponse = await supabase.rpc('get_or_create_chat_session', {
          p_user_id: userId,
          p_school_id: schoolId,
        });

        if (fallbackSessionResponse.error || !fallbackSessionResponse.data) {
          return NextResponse.json(
            { error: 'Failed to create chat session' },
            { status: 500 }
          );
        }

        currentSessionId = fallbackSessionResponse.data;
      } else {
        currentSessionId = createSessionResponse.data;
      }
    }

    if (generatedTitle && role === 'assistant') {
      await supabase
        .from('ai_chat_sessions')
        .update({ title: generatedTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', currentSessionId);
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
