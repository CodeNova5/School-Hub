import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/audit-logs/undo
 *
 * Reverses the most recent audit log entry:
 *  - INSERT  → Delete the record that was created
 *  - UPDATE  → Restore the old_data values
 *  - DELETE  → Re-insert the old_data record
 *
 * Safety guards:
 *  - Only works for entries ≤5 minutes old
 *  - Only the admin who made the change can undo it
 *  - Marks the entry as undone (sets undone_at) to prevent double-undo
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // ── Auth check ────────────────────────────────────────────────────
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

    // ── Parse request ─────────────────────────────────────────────────
    const body = await request.json();
    const logId = body?.log_id;

    if (!logId || typeof logId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid log_id' }, { status: 400 });
    }

    // ── Fetch the audit log entry ─────────────────────────────────────
    const { data: log, error: logError } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      return NextResponse.json({ error: 'Audit log entry not found' }, { status: 404 });
    }

    // ── Safety: time window (5 minutes) ───────────────────────────────
    const createdAt = new Date(log.created_at).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (createdAt < fiveMinutesAgo) {
      return NextResponse.json(
        { error: 'Cannot undo — the entry is older than 5 minutes.' },
        { status: 400 }
      );
    }

    // ── Safety: not already undone ────────────────────────────────────
    if (log.undone_at) {
      return NextResponse.json(
        { error: 'This action has already been undone.' },
        { status: 400 }
      );
    }

    // ── Safety: same admin ────────────────────────────────────────────
    if (log.changed_by !== user.id) {
      return NextResponse.json(
        { error: 'Cannot undo — only the admin who made the change can undo it.' },
        { status: 403 }
      );
    }

    const { table_name, record_id, operation, old_data, new_data } = log;

    // ── Execute the reverse operation ─────────────────────────────────
    let reverseResult;

    switch (operation) {
      case 'INSERT': {
        // Reverse: delete the record that was created
        reverseResult = await supabase
          .from(table_name)
          .delete()
          .eq('id', record_id);
        break;
      }

      case 'UPDATE': {
        // Reverse: restore old_data (exclude immutable fields)
        if (!old_data || typeof old_data !== 'object') {
          return NextResponse.json(
            { error: 'Cannot undo — no old_data available for this update.' },
            { status: 400 }
          );
        }
        const restoreData = { ...old_data };
        // Remove fields that shouldn't be overwritten
        delete restoreData.id;
        delete restoreData.school_id;
        delete restoreData.created_at;
        delete restoreData.updated_at;

        if (Object.keys(restoreData).length === 0) {
          return NextResponse.json(
            { error: 'Cannot undo — no meaningful fields to restore.' },
            { status: 400 }
          );
        }

        reverseResult = await supabase
          .from(table_name)
          .update(restoreData)
          .eq('id', record_id);
        break;
      }

      case 'DELETE': {
        // Reverse: re-insert the old_data
        if (!old_data || typeof old_data !== 'object') {
          return NextResponse.json(
            { error: 'Cannot undo — no old_data available for this deletion.' },
            { status: 400 }
          );
        }
        reverseResult = await supabase
          .from(table_name)
          .insert(old_data);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Cannot undo '${operation}' operations.` },
          { status: 400 }
        );
    }

    if (reverseResult?.error) {
      console.error('[AuditLogs Undo] Reverse operation error:', reverseResult.error);
      return NextResponse.json(
        {
          error: `Failed to undo: ${reverseResult.error.message}`,
          details: reverseResult.error,
        },
        { status: 500 }
      );
    }

    // ── Mark the audit entry as undone ────────────────────────────────
    const { error: updateError } = await supabase
      .from('admin_audit_logs')
      .update({ undone_at: new Date().toISOString() })
      .eq('id', logId);

    if (updateError) {
      console.error('[AuditLogs Undo] Failed to mark entry as undone:', updateError);
      // Non-fatal — the reverse operation already succeeded
    }

    return NextResponse.json({
      message: `Successfully undone the ${operation} on ${table_name}.`,
      undone: true,
    });
  } catch (err: any) {
    console.error('[AuditLogs Undo] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
