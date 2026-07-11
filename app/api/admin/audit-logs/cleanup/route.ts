import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

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

    // Parse optional retention_days from body
    const body = await request.json().catch(() => ({}));
    const retentionDays = Math.max(1, Math.min(parseInt(body.retention_days || '90', 10), 365));

    const { data, error } = await supabase.rpc('cleanup_old_audit_logs', {
      retention_days: retentionDays,
    });

    if (error) {
      console.error('[AuditLogs Cleanup] RPC error:', error);
      return NextResponse.json({ error: 'Failed to run cleanup' }, { status: 500 });
    }

    return NextResponse.json({
      message: `Cleaned up ${data || 0} audit log entries older than ${retentionDays} days.`,
      deleted: data || 0,
      retentionDays,
    });
  } catch (err: any) {
    console.error('[AuditLogs Cleanup] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
