/**
 * Get Chat History API Route
 * Retrieves chat messages for the current or specified session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Get session ID from query params (optional)
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get user's school_id
    const { data: userProfile, error: profileError } = await supabase
      .from('teachers')
      .select('school_id')
      .eq('user_id', userId)
      .single();

    let schoolId: string;
    if (profileError || !userProfile) {
      const { data: studentProfile, error: studentError } = await supabase
        .from('students')
        .select('school_id')
        .eq('user_id', userId)
        .single();

      if (studentError || !studentProfile) {
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 403 }
        );
      }

      schoolId = studentProfile.school_id;
    } else {
      schoolId = userProfile.school_id;
    }

    let query = supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Get messages error:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // Transform messages to match the component's Message interface
    const transformedMessages = messages?.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at),
      queryInfo: msg.query_plan ? {
        explanation: msg.query_plan.explanation,
        tables: msg.query_plan.tables,
        resultCount: msg.query_plan.resultCount,
      } : undefined,
      error: msg.error,
    })) || [];

    // Get current session info if sessionId was provided
    let currentSession = null;
    if (sessionId) {
      const { data: session } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      currentSession = session;
    }

    return NextResponse.json({
      success: true,
      messages: transformedMessages,
      sessionId: sessionId,
      session: currentSession,
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
