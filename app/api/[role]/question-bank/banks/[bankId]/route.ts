import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  let bankQuery = supabase
    .from('teacher_question_banks')
    .select('id, school_id, created_by_teacher_id, created_by_admin_id, subject_class_id, title, description, visibility, created_at, updated_at')
    .eq('id', bankId)
    .eq('school_id', schoolId);

  // Teachers need visibility-based filtering
  if (role === 'teacher') {
    bankQuery = (bankQuery as any).or(`created_by_teacher_id.eq.${userId},visibility.eq.public_school`);
  }

  const [bankResult, questionCountResult] = await Promise.all([
    (bankQuery as any).maybeSingle(),
    supabase
      .from('teacher_questions')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('bank_id', bankId),
  ]);

  if (bankResult.error) {
    return NextResponse.json({ error: bankResult.error.message }, { status: 400 });
  }

  if (questionCountResult.error) {
    return NextResponse.json({ error: questionCountResult.error.message }, { status: 400 });
  }

  if (!bankResult.data) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
  }

  return NextResponse.json({
    bank: bankResult.data,
    questionCount: questionCountResult.count || 0,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const subjectClassId = typeof body?.subjectClassId === 'string' ? body.subjectClassId.trim() : '';
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';

    if (!title || !subjectClassId) {
      return NextResponse.json({ error: 'title and subjectClassId are required' }, { status: 400 });
    }

    // Verify subject class belongs to school
    const { data: subjectClass, error: subjectClassError } = await supabase
      .from('subject_classes')
      .select('id')
      .eq('id', subjectClassId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (subjectClassError || !subjectClass) {
      return NextResponse.json({ error: 'Invalid subject class selection' }, { status: 403 });
    }

    // Build ownership filter for the update
    const ownershipFilter: Record<string, any> =
      role === 'teacher'
        ? { created_by_teacher_id: userId }
        : { created_by_admin_id: userId };

    const { data, error } = await supabase
      .from('teacher_question_banks')
      .update({
        title,
        description,
        subject_class_id: subjectClassId,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bankId)
      .eq('school_id', schoolId)
      .eq(role === 'teacher' ? 'created_by_teacher_id' : 'created_by_admin_id', userId)
      .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_by_admin_id, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Question bank not found or not editable' }, { status: 404 });
    }

    return NextResponse.json({ bank: data });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
