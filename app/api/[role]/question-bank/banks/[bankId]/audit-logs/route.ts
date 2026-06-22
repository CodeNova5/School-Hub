import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';
import { insertAuditLog } from '@/lib/question-bank/audit';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string }>;
};

// GET /api/[role]/question-bank/banks/[bankId]/audit-logs
// Returns paginated audit logs for the bank
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, schoolId } = ctxResult.context;
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const action = url.searchParams.get('action');

  let query = supabase
    .from('question_bank_audit_logs')
    .select('*', { count: 'exact' })
    .eq('bank_id', bankId)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) {
    query = query.eq('action', action);
  }

  const { data: logs, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    logs: logs || [],
    total: count || 0,
    offset,
    limit,
  });
}

// POST /api/[role]/question-bank/banks/[bankId]/audit-logs
// Log a client-side event (e.g. exam_printed)
export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, userName, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const action = body?.action as string;
    const details = (body?.details || {}) as Record<string, unknown>;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    await insertAuditLog(
      supabase,
      bankId,
      schoolId,
      action as any,
      userId,
      role as 'teacher' | 'admin',
      details,
      userName
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
