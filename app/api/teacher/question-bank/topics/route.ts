import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext, toTopicList } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const url = new URL(request.url);
  const subjectClassId = url.searchParams.get('subjectClassId');

  let query = supabase
    .from('teacher_question_topic_sets')
    .select('id, name, topics, subject_class_id, created_at, updated_at')
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

  return NextResponse.json({ topicSets: data || [] });
}

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const topics = toTopicList(body?.topics);

    if (!name || !subjectClassId || topics.length === 0) {
      return NextResponse.json({ error: 'name, subjectClassId, and topics are required' }, { status: 400 });
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
      .from('teacher_question_topic_sets')
      .insert({
        school_id: schoolId,
        created_by_teacher_id: teacherId,
        subject_class_id: subjectClassId,
        name,
        topics,
      })
      .select('id, name, topics, subject_class_id, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ topicSet: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
