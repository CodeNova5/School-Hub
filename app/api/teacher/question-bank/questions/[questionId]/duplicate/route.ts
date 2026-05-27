import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const targetBankId = String(body?.bankId || '').trim();
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';

    if (!targetBankId) {
      return NextResponse.json({ error: 'bankId is required' }, { status: 400 });
    }

    const [sourceResult, targetBankResult] = await Promise.all([
      supabase
        .from('teacher_questions')
        .select(`
          id,
          school_id,
          subject_class_id,
          topic_set_id,
          question_type,
          difficulty,
          visibility,
          topic,
          question_text,
          options,
          correct_answer,
          explanation,
          metadata,
          created_by_teacher_id
        `)
        .eq('id', params.questionId)
        .eq('school_id', schoolId)
        .maybeSingle(),
      supabase
        .from('teacher_question_banks')
        .select('id, subject_class_id, created_by_teacher_id')
        .eq('id', targetBankId)
        .eq('school_id', schoolId)
        .eq('created_by_teacher_id', teacherId)
        .maybeSingle(),
    ]);

    if (sourceResult.error || !sourceResult.data) {
      return NextResponse.json({ error: 'Source question not found' }, { status: 404 });
    }

    if (targetBankResult.error || !targetBankResult.data) {
      return NextResponse.json({ error: 'Target bank not found or not editable' }, { status: 403 });
    }

    const source = sourceResult.data;
    const canReuse = source.created_by_teacher_id === teacherId || source.visibility === 'public_school';

    if (!canReuse) {
      return NextResponse.json({ error: 'This question is not shareable' }, { status: 403 });
    }

    const { data: duplicated, error: duplicateError } = await supabase
      .from('teacher_questions')
      .insert({
        school_id: schoolId,
        bank_id: targetBankId,
        subject_class_id: targetBankResult.data.subject_class_id,
        topic_set_id: source.topic_set_id,
        created_by_teacher_id: teacherId,
        source_question_id: source.id,
        question_type: source.question_type,
        difficulty: source.difficulty,
        visibility,
        topic: source.topic,
        question_text: source.question_text,
        options: source.options || [],
        correct_answer: source.correct_answer,
        explanation: source.explanation,
        metadata: {
          ...(source.metadata || {}),
          duplicatedFrom: source.id,
          duplicatedAt: new Date().toISOString(),
        },
      })
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
        source_question_id,
        created_by_teacher_id,
        created_at,
        updated_at
      `)
      .single();

    if (duplicateError) {
      return NextResponse.json({ error: duplicateError.message }, { status: 400 });
    }

    return NextResponse.json({ question: duplicated }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
