import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; questionId: string }>;
};

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, questionId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

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
          created_by_teacher_id,
          created_by_admin_id
        `)
        .eq('id', questionId)
        .eq('school_id', schoolId)
        .maybeSingle(),
      supabase
        .from('teacher_question_banks')
        .select('id, subject_class_id')
        .eq('id', targetBankId)
        .eq('school_id', schoolId)
        .maybeSingle(),
    ]);

    if (sourceResult.error || !sourceResult.data) {
      return NextResponse.json({ error: 'Source question not found' }, { status: 404 });
    }

    if (targetBankResult.error || !targetBankResult.data) {
      return NextResponse.json({ error: 'Target bank not found' }, { status: 404 });
    }

    const source = sourceResult.data;

    // Check if user can access this question (own or public)
    let canReuse = false;
    if (role === 'teacher') {
      canReuse = source.created_by_teacher_id === userId || source.visibility === 'public_school';
    } else {
      canReuse = true; // Admins can duplicate any question in their school
    }

    if (!canReuse) {
      return NextResponse.json({ error: 'This question is not shareable' }, { status: 403 });
    }

    const insertPayload: Record<string, unknown> = {
      school_id: schoolId,
      bank_id: targetBankId,
      subject_class_id: targetBankResult.data.subject_class_id,
      topic_set_id: source.topic_set_id,
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
        ...((source.metadata as Record<string, unknown>) || {}),
        duplicatedFrom: source.id,
        duplicatedAt: new Date().toISOString(),
      },
    };

    if (role === 'teacher') {
      insertPayload.created_by_teacher_id = userId;
    } else {
      insertPayload.created_by_admin_id = userId;
    }

    const { data: duplicated, error: duplicateError } = await supabase
      .from('teacher_questions')
      .insert(insertPayload)
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
