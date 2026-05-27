import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const url = new URL(request.url);
  const subjectClassId = url.searchParams.get('subjectClassId');
  const owner = url.searchParams.get('owner');

  let query = supabase
    .from('teacher_question_banks')
    .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_at, updated_at')
    .eq('school_id', schoolId)
    .order('updated_at', { ascending: false });

  if (subjectClassId) {
    query = query.eq('subject_class_id', subjectClassId);
  }

  if (owner === 'mine') {
    query = query.eq('created_by_teacher_id', teacherId);
  } else {
    query = query.or(`created_by_teacher_id.eq.${teacherId},visibility.eq.public_school`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ banks: data || [] });
}

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = String(body?.title || '').trim();
    const description = body?.description ? String(body.description).trim() : null;
    const subjectClassId = String(body?.subjectClassId || '').trim();
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
      .insert({
        school_id: schoolId,
        created_by_teacher_id: teacherId,
        subject_class_id: subjectClassId,
        title,
        description,
        visibility,
      })
      .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ bank: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
