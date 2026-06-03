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
        return NextResponse.json({ error: 'Objective questions need a correctAnswer (option letter A/B/C... or the option text)' }, { status: 400 });
      }

      // Resolve correctAnswer to an option letter (A, B, C, ...). Accept either a single-letter (A-D)
      // or the option text. Store the letter in the DB.
      const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let correctAnswerLetter: string | null = null;
      const candidate = correctAnswer.trim();

      if (/^[A-H]$/i.test(candidate)) {
        const idx = LETTERS.indexOf(candidate.toUpperCase());
        if (idx >= 0 && idx < options.length) {
          correctAnswerLetter = LETTERS[idx];
        }
      }

      if (!correctAnswerLetter) {
        // try exact match against option text
        const idx = options.findIndex((opt) => opt.toLowerCase() === candidate.toLowerCase());
        if (idx >= 0) correctAnswerLetter = LETTERS[idx];
      }

      if (!correctAnswerLetter) {
        // try partial match (contains)
        const idx2 = options.findIndex((opt) => opt.toLowerCase().includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(opt.toLowerCase()));
        if (idx2 >= 0) correctAnswerLetter = LETTERS[idx2];
      }

      if (!correctAnswerLetter) {
        return NextResponse.json({ error: 'correctAnswer must match one of the options or be a valid option letter (A/B/C...)' }, { status: 400 });
      }

      // replace correctAnswer with letter for storage
      // (we keep `correctAnswer` variable for compatibility but use `correctAnswerLetter` below)
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
        correct_answer: questionType === 'objective' ? (function(){
          // derive stored letter from provided correctAnswer / options
          const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
          const candidate = (typeof body?.correctAnswer === 'string' ? body.correctAnswer.trim() : '');
          let correctAnswerLetter: string | null = null;

          if (candidate && /^[A-H]$/i.test(candidate)) {
            const idx = LETTERS.indexOf(candidate.toUpperCase());
            if (idx >= 0 && idx < options.length) correctAnswerLetter = LETTERS[idx];
          }

          if (!correctAnswerLetter && candidate) {
            const idx = options.findIndex((opt) => opt.toLowerCase() === candidate.toLowerCase());
            if (idx >= 0) correctAnswerLetter = LETTERS[idx];
          }

          if (!correctAnswerLetter && candidate) {
            const idx2 = options.findIndex((opt) => opt.toLowerCase().includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(opt.toLowerCase()));
            if (idx2 >= 0) correctAnswerLetter = LETTERS[idx2];
          }

          return correctAnswerLetter || null;
        })() : null,
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
