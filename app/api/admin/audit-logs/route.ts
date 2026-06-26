import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Verify the user is an admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin status via RPC
    const { data: isAdmin } = await supabase.rpc('is_admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    // Get school ID
    const { data: schoolId } = await supabase.rpc('get_my_school_id');
    if (!schoolId) {
      return NextResponse.json({ error: 'No school context found' }, { status: 400 });
    }

    // Parse query params
    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    const tableName = url.searchParams.get('table_name') || '';
    const operation = url.searchParams.get('operation') || '';
    const search = url.searchParams.get('search') || '';

    // Build query
    let query = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (tableName) {
      query = query.eq('table_name', tableName);
    }

    if (operation) {
      query = query.eq('operation', operation);
    }

    // For search, we filter by changed_by_name ILIKE
    if (search) {
      query = query.ilike('changed_by_name', `%${search}%`);
    }

    const { data: logs, count, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[AuditLogs API] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    return NextResponse.json({
      logs: logs || [],
      total: count || 0,
    });
  } catch (err: any) {
    console.error('[AuditLogs API] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
