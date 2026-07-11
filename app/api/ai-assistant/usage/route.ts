import { createServerSupabaseClient } from "@/lib/supabase-server";

import { NextResponse } from 'next/server';
import { errorResponse, getAiAssistantContext } from '@/lib/api-helpers';
import { AIAssistantRole, formatAIAssistantUsageSummary, getAIAssistantDailyTokenLimit, getUtcDateKey } from '@/lib/ai-assistant/usage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const context = await getAiAssistantContext();
    if (!context.authorized || !context.role || !context.schoolId) {
      return errorResponse(context.error || 'Forbidden', context.status || 403);
    }

    const usageDate = getUtcDateKey();
    const quotaLimit = getAIAssistantDailyTokenLimit(context.role as AIAssistantRole);

    const { data, error } = await supabase.rpc('get_ai_assistant_usage_summary', {
      p_user_id: session.user.id,
      p_school_id: context.schoolId,
      p_role: context.role,
      p_usage_date: usageDate,
    });

    if (error) {
      console.error('Error loading AI usage summary:', error);
      return NextResponse.json({ error: 'Failed to load usage summary' }, { status: 500 });
    }

    const summary = data as Record<string, unknown> | null;
    const normalized = formatAIAssistantUsageSummary({
      usageDate,
      tokensUsed: Number(summary?.tokensUsed ?? 0),
      quotaLimit: Number(summary?.quotaLimit ?? quotaLimit),
      role: context.role as AIAssistantRole,
      schoolId: context.schoolId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      usage: normalized,
    });
  } catch (error) {
    console.error('Error fetching AI usage summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
