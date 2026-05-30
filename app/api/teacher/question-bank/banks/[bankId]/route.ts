import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { bankId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  const [bankResult, questionCountResult] = await Promise.all([
    supabase
      .from('teacher_question_banks')
      .select('id, school_id, created_by_teacher_id, subject_class_id, title, description, visibility, created_at, updated_at')
      .eq('id', params.bankId)
      .eq('school_id', schoolId)
      .or(`created_by_teacher_id.eq.${teacherId},visibility.eq.public_school`)
      .maybeSingle(),
    supabase
      .from('teacher_questions')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('bank_id', params.bankId),
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
  { params }: { params: { bankId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : null;
    const subjectClassId = typeof body?.subjectClassId === 'string' ? body.subjectClassId.trim() : '';
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';

    if (!title || !subjectClassId) {
      return NextResponse.json({ error: 'title and subjectClassId are required' }, { status: 400 });
    }

    const { data: subjectClass, error: subjectClassError } = await supabase
      .from('subject_classes')
      .select('id')
      .eq('id', subjectClassId)
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (subjectClassError || !subjectClass) {
      return NextResponse.json({ error: 'Invalid subject class selection' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('teacher_question_banks')
      .update({
        title,
        description,
        subject_class_id: subjectClassId,
        visibility,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.bankId)
      .eq('school_id', schoolId)
      .eq('created_by_teacher_id', teacherId)
      .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_at, updated_at')
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