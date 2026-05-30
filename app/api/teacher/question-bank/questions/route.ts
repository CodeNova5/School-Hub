import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext, toTopicList } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const bankId = String(body?.bankId || '').trim();
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const topic = String(body?.topic || '').trim();
    const questionText = String(body?.questionText || '').trim();
    const correctAnswer = body?.correctAnswer ? String(body.correctAnswer).trim() : '';
    const explanation = body?.explanation ? String(body.explanation).trim() : '';
    const difficulty = body?.difficulty as 'easy' | 'medium' | 'hard';
    const questionType = body?.questionType as 'objective' | 'theory';
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';
    const topicSetId = body?.topicSetId ? String(body.topicSetId).trim() : null;
    const options = Array.isArray(body?.options) ? toTopicList(body.options) : [];

    if (!bankId || !subjectClassId || !topic || !questionText || !difficulty || !questionType) {
      return NextResponse.json(
        { error: 'bankId, subjectClassId, topic, questionText, difficulty, and questionType are required' },
        { status: 400 }
      );
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'difficulty must be easy, medium, or hard' }, { status: 400 });
    }

    if (!['objective', 'theory'].includes(questionType)) {
      return NextResponse.json({ error: 'questionType must be objective or theory' }, { status: 400 });
    }

    if (questionType === 'objective' && options.length < 2) {
      return NextResponse.json({ error: 'Objective questions require at least two options' }, { status: 400 });
    }

    const { data: bank, error: bankError } = await supabase
      .from('teacher_question_banks')
      .select('id, subject_class_id, created_by_teacher_id')
      .eq('id', bankId)
      .eq('school_id', schoolId)
      .eq('created_by_teacher_id', teacherId)
      .maybeSingle();

    if (bankError || !bank) {
      return NextResponse.json({ error: 'Question bank not found or not editable by teacher' }, { status: 403 });
    }

    if (bank.subject_class_id !== subjectClassId) {
      return NextResponse.json({ error: 'Selected subject/class does not match this bank' }, { status: 400 });
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

    if (questionType === 'objective' && !correctAnswer) {
      return NextResponse.json({ error: 'Objective questions require a correct answer' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('teacher_questions')
      .insert({
        school_id: schoolId,
        bank_id: bankId,
        subject_class_id: subjectClassId,
        topic_set_id: topicSetId,
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
          source: 'manual',
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
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ question: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}