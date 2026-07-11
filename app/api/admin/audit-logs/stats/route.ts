import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify the user is an admin
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

    // Get school ID
    const { data: schoolId } = await supabase.rpc('get_my_school_id');
    if (!schoolId) {
      return NextResponse.json({ error: 'No school context found' }, { status: 400 });
    }

    // Parse query params
    const url = new URL(request.url);
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '7', 10), 1), 90);
    const excludeTables = url.searchParams.get('exclude_tables') || '';

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    // Build the base query with time filter
    let baseQuery = supabase
      .from('admin_audit_logs')
      .select('created_at, operation')
      .eq('school_id', schoolId)
      .gte('created_at', cutoffIso);

    // Exclude config tables if requested
    if (excludeTables) {
      const tablesToExclude = excludeTables.split(',').map((t) => t.trim()).filter(Boolean);
      if (tablesToExclude.length > 0) {
        baseQuery = baseQuery.not('table_name', 'in', `(${tablesToExclude.map((t) => `\"${t}\"`).join(',')})`);
      }
    }

    const { data: logs, error } = await baseQuery.order('created_at', { ascending: true });

    if (error) {
      console.error('[AuditLogs Stats] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Build daily aggregation
    const dailyMap = new Map<string, { total: number; INSERT: number; UPDATE: number; DELETE: number }>();

    // Initialize all dates in the range
    for (let i = 0; i < days; i++) {
      const d = new Date(cutoffDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, { total: 0, INSERT: 0, UPDATE: 0, DELETE: 0 });
    }

    // Fill in counts
    (logs || []).forEach((log: { created_at: string; operation: string }) => {
      const key = log.created_at.slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.total++;
        if (log.operation === 'INSERT') entry.INSERT++;
        else if (log.operation === 'UPDATE') entry.UPDATE++;
        else if (log.operation === 'DELETE') entry.DELETE++;
      }
    });

    // Build summary stats
    const daily = Array.from(dailyMap.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    const totalEvents = daily.reduce((sum, d) => sum + d.total, 0);
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayEvents = dailyMap.get(todayKey)?.total || 0;

    return NextResponse.json({
      daily,
      summary: {
        totalEvents,
        todayEvents,
        days,
        dateRange: {
          from: cutoffIso.slice(0, 10),
          to: todayKey,
        },
      },
    });
  } catch (err: any) {
    console.error('[AuditLogs Stats] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
