import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateAuditAISummary } from '@/lib/audit-ai-summarizer';
import { enrichAuditData } from '@/lib/audit-uuid-resolver';
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

    // ── Resolve UUIDs to human-readable names for richer AI descriptions ──
    // This replaces e.g. class_id="550e8400-..." with class_id="JSS 1A"
    // so the AI can say "moved from JSS 1A to JSS 1B" instead of generic text.
    const schoolId = (log as unknown as AdminAuditLogRecord).school_id;
    const { nameMap } = await enrichAuditData(
      supabase,
      log.old_data as Record<string, unknown> | null,
      log.new_data as Record<string, unknown> | null,
      schoolId
    );

    // Generate AI summary + undo description with resolved names
    const result = await generateAuditAISummary(
      log as unknown as AdminAuditLogRecord,
      nameMap
    );

    if (result.error && !result.summary) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    // Persist the AI results to the database so they're cached for future views
    const updatePayload: Record<string, string> = {};
    if (result.summary) updatePayload.ai_summary = result.summary;
    if (result.undo_description) updatePayload.undo_description = result.undo_description;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('admin_audit_logs')
        .update(updatePayload)
        .eq('id', logId);

      if (updateError) {
        console.warn('[AuditLogs Summarize] Failed to persist AI summary:', updateError.message);
        // Non-fatal — the summary was already generated
      }
    }

    return NextResponse.json({
      summary: result.summary,
      undo_description: result.undo_description,
      cached: result.cached || false,
    });
  } catch (err: any) {
    console.error('[AuditLogs Summarize] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
