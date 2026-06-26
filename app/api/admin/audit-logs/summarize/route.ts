import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAuditAISummary } from '@/lib/audit-ai-summarizer';
import type { AdminAuditLogRecord } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // AI calls may take a few seconds

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    // Parse the audit log ID from the request body
    const body = await request.json();
    const logId = body?.log_id;

    if (!logId || typeof logId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid log_id' }, { status: 400 });
    }

    // Fetch the full audit log entry
    const { data: log, error: logError } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return NextResponse.json({ error: 'Audit log entry not found' }, { status: 404 });
    }

    // Generate AI summary
    const result = await generateAuditAISummary(log as unknown as AdminAuditLogRecord);

    if (result.error && !result.summary) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({
      summary: result.summary,
      cached: result.cached || false,
    });
  } catch (err: any) {
    console.error('[AuditLogs Summarize] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
