import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext, toTopicList } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.topic === 'string') {
      updates.topic = body.topic.trim();
    }

    if (typeof body?.questionText === 'string') {
      updates.question_text = body.questionText.trim();
    }

    if (typeof body?.explanation === 'string') {
      updates.explanation = body.explanation.trim() || null;
    }

    if (typeof body?.correctAnswer === 'string') {
      updates.correct_answer = body.correctAnswer.trim() || null;
    }

    if (body?.difficulty && ['easy', 'medium', 'hard'].includes(body.difficulty)) {
      updates.difficulty = body.difficulty;
    }

    if (body?.visibility && ['private', 'public_school'].includes(body.visibility)) {
      updates.visibility = body.visibility;
    }

    if (Array.isArray(body?.options)) {
      updates.options = toTopicList(body.options);
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No valid update fields supplied' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('teacher_questions')
      .update(updates)
      .eq('id', params.questionId)
      .eq('school_id', schoolId)
      .eq('created_by_teacher_id', teacherId)
      .select(`
        id,
        topic,
        question_text,
        options,
        correct_answer,
        explanation,
        question_type,
        difficulty,
        visibility,
        created_by_teacher_id,
        created_at,
        updated_at
      `)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Question not found or not editable' }, { status: 404 });
    }

    return NextResponse.json({ question: data });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  const { error } = await supabase
    .from('teacher_questions')
    .delete()
    .eq('id', params.questionId)
    .eq('school_id', schoolId)
    .eq('created_by_teacher_id', teacherId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
