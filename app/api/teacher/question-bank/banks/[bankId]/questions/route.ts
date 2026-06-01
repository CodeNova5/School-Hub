import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

function toCleanStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { bankId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const bankId = params.bankId;

  const { data: bank, error: bankError } = await supabase
    .from('teacher_question_banks')
    .select('id, title, visibility, created_by_teacher_id, subject_class_id')
    .eq('id', bankId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 400 });
  }

  if (!bank) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
  }

  if (bank.created_by_teacher_id !== teacherId && bank.visibility !== 'public_school') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const difficulty = url.searchParams.get('difficulty');
  const questionType = url.searchParams.get('questionType');
  const search = url.searchParams.get('search');

  let query = supabase
    .from('teacher_questions')
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
      source_question_id,
      created_at,
      updated_at
    `)
    .eq('bank_id', bankId)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (difficulty) {
    query = query.eq('difficulty', difficulty);
  }

  if (questionType) {
    query = query.eq('question_type', questionType);
  }

  if (search) {
    query = query.ilike('question_text', `%${search}%`);
  }

  const { data: questions, error: questionsError } = await query;
  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 400 });
  }

  return NextResponse.json({ bank, questions: questions || [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { bankId: string } }
) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;
  const bankId = params.bankId;

  const { data: bank, error: bankError } = await supabase
    .from('teacher_question_banks')
    .select('id, created_by_teacher_id, subject_class_id, visibility')
    .eq('id', bankId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 400 });
  }

  if (!bank) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
  }

  if (bank.created_by_teacher_id !== teacherId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const questionText = typeof body?.questionText === 'string' ? body.questionText.trim() : '';
    const questionType = body?.questionType === 'theory' ? 'theory' : 'objective';
    const difficulty = ['easy', 'medium', 'hard'].includes(body?.difficulty) ? body.difficulty : 'medium';
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';
    const explanation = typeof body?.explanation === 'string' ? body.explanation.trim() : '';
    const correctAnswer = typeof body?.correctAnswer === 'string' ? body.correctAnswer.trim() : '';
    const options = toCleanStringList(body?.options);

    if (!topic || !questionText) {
      return NextResponse.json({ error: 'topic and questionText are required' }, { status: 400 });
    }

    if (questionType === 'objective') {
      if (options.length < 2) {
        return NextResponse.json({ error: 'Objective questions need at least two options' }, { status: 400 });
      }

      if (!correctAnswer) {
        return NextResponse.json({ error: 'Objective questions need a correctAnswer' }, { status: 400 });
      }

      const hasMatchingAnswer = options.some((option) => option.toLowerCase() === correctAnswer.toLowerCase());
      if (!hasMatchingAnswer) {
        return NextResponse.json({ error: 'correctAnswer must match one of the options' }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from('teacher_questions')
      .insert({
        school_id: schoolId,
        bank_id: bankId,
        subject_class_id: bank.subject_class_id,
        created_by_teacher_id: teacherId,
        question_type: questionType,
        difficulty,
        visibility,
        topic,
        question_text: questionText,
        options: questionType === 'objective' ? options : [],
        correct_answer: correctAnswer || null,
        explanation: explanation || null,
        metadata: {
          createdVia: 'manual',
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
        created_by_teacher_id,
        source_question_id,
        created_at,
        updated_at
      `)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to create question' }, { status: 400 });
    }

    return NextResponse.json({ question: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
