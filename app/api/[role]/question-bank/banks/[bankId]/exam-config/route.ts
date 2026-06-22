import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';
import { insertAuditLog } from '@/lib/question-bank/audit';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string }>;
};

// GET /api/[role]/question-bank/banks/[bankId]/exam-config?term=1
// Load a saved exam paper configuration for a specific term
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
  const term = request.nextUrl.searchParams.get('term');

  if (!term || !['1', '2', '3'].includes(term)) {
    return NextResponse.json({ error: 'term parameter is required (1, 2, or 3)' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('exam_paper_configs')
    .select('id, term, config, created_at, updated_at')
    .eq('bank_id', bankId)
    .eq('school_id', schoolId)
    .eq('term', term)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ config: data || null });
}

// POST /api/[role]/question-bank/banks/[bankId]/exam-config
// Save or update an exam paper configuration for a specific term
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
    const term = body?.term as string;
    const config = body?.config as Record<string, unknown>;

    if (!term || !['1', '2', '3'].includes(term)) {
      return NextResponse.json({ error: 'term is required (1, 2, or 3)' }, { status: 400 });
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'config is required' }, { status: 400 });
    }

    // Verify bank access
    let bankQuery = supabase
      .from('teacher_question_banks')
      .select('id')
      .eq('id', bankId)
      .eq('school_id', schoolId);

    if (role === 'teacher') {
      bankQuery = bankQuery.or(`created_by_teacher_id.eq.${userId},visibility.eq.public_school`);
    }

    const { data: bank } = await bankQuery.maybeSingle();
    if (!bank) {
      return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
    }

    // Upsert: create or update the config for this bank+term
    const ownershipFields: Record<string, unknown> =
      role === 'teacher'
        ? { created_by_teacher_id: userId, created_by_admin_id: null }
        : { created_by_admin_id: userId, created_by_teacher_id: null };

    const { data, error } = await supabase
      .from('exam_paper_configs')
      .upsert(
        {
          bank_id: bankId,
          term,
          school_id: schoolId,
          ...ownershipFields,
          config,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'bank_id, term',
          ignoreDuplicates: false,
        }
      )
      .select('id, term, config, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Audit log for config save
    const questionCount = (config?.orderedQuestionIds as string[])?.length || 0;
    await insertAuditLog(supabase, bankId, schoolId, 'exam_config_saved', userId, role as 'teacher' | 'admin', {
      term,
      questionCount,
      hasCustomNumbers: Object.keys((config?.customNumbers as Record<string, string>) || {}).length > 0,
    }, userName);

    return NextResponse.json({ config: data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}

// DELETE /api/[role]/question-bank/banks/[bankId]/exam-config?term=1
// Delete a saved exam paper configuration
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, userName, schoolId } = ctxResult.context;
  const term = request.nextUrl.searchParams.get('term');

  if (!term || !['1', '2', '3'].includes(term)) {
    return NextResponse.json({ error: 'term parameter is required (1, 2, or 3)' }, { status: 400 });
  }

  // Log before deleting (fire-and-forget)
  await insertAuditLog(supabase, bankId, schoolId, 'exam_config_deleted', userId, role as 'teacher' | 'admin', {
    term,
  }, userName);

  let query = supabase
    .from('exam_paper_configs')
    .delete()
    .eq('bank_id', bankId)
    .eq('school_id', schoolId)
    .eq('term', term);

  if (role === 'teacher') {
    query = query.eq('created_by_teacher_id', userId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
