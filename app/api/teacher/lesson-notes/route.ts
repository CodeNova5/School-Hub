import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const { searchParams } = new URL(request.url);
  const subjectClassId = searchParams.get('subjectClassId');

  let query = supabase
    .from('teacher_lesson_notes')
    .select('id, title, topic, subject_class_id, objectives, summary, status, created_at, updated_at')
    .eq('school_id', schoolId)
    .eq('created_by_teacher_id', teacherId)
    .order('updated_at', { ascending: false });

  if (subjectClassId) {
    query = query.eq('subject_class_id', subjectClassId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, lessonNotes: data || [] });
}

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const topic = String(body?.topic || '').trim();
    const title = String(body?.title || topic || '').trim();
    const content = body?.content || {};
    const objectives = Array.isArray(body?.objectives) ? body.objectives : [];
    const summary = String(body?.summary || '').trim();

    if (!subjectClassId || !topic) {
      return NextResponse.json({ error: 'subjectClassId and topic are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('teacher_lesson_notes')
      .insert({
        school_id: schoolId,
        created_by_teacher_id: teacherId,
        subject_class_id: subjectClassId,
        topic,
        title: title || topic,
        content,
        objectives,
        summary,
        status: 'draft',
      })
      .select('id, title, topic, subject_class_id, content, objectives, summary, status, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, lessonNote: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
