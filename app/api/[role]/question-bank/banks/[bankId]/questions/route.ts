import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  // Verify bank access
  let bankQuery = supabase
    .from('teacher_question_banks')
    .select('id, title, visibility, created_by_teacher_id, created_by_admin_id, subject_class_id')
    .eq('id', bankId)
    .eq('school_id', schoolId);

  if (role === 'teacher') {
    bankQuery = bankQuery.or(`created_by_teacher_id.eq.${userId},visibility.eq.public_school`);
  }

  const { data: bank, error: bankError } = await bankQuery.maybeSingle();

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 400 });
  }

  if (!bank) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
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
      metadata,
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
