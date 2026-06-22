import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { insertAuditLog } from '@/lib/question-bank/audit';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; questionId: string }>;
};

export async function PATCH(
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
    // fetch existing question to help resolve correct_answer when needed
    const { data: existingQuestion } = await supabase
      .from('teacher_questions')
      .select('options, question_type, bank_id, created_by_teacher_id, created_by_admin_id')
      .eq('id', questionId)
      .maybeSingle();

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Verify ownership
    if (role === 'teacher' && existingQuestion.created_by_teacher_id !== userId) {
      return NextResponse.json({ error: 'You can only edit your own questions' }, { status: 403 });
    }

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
      const candidate = body.correctAnswer.trim();
      const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let resolved: string | null = null;

      const optionsList: string[] = Array.isArray(body.options)
        ? (body.options as string[]).map((v) => String(v || '').trim()).filter(Boolean)
        : Array.isArray((existingQuestion as any)?.options)
        ? ((existingQuestion as any).options as string[])
        : [];

      if (/^[A-H]$/i.test(candidate)) {
        const idx = LETTERS.indexOf(candidate.toUpperCase());
        if (idx >= 0 && idx < optionsList.length) resolved = LETTERS[idx];
      }

      if (!resolved && optionsList.length > 0) {
        const exact = optionsList.findIndex((opt) => opt.toLowerCase() === candidate.toLowerCase());
        if (exact >= 0) resolved = LETTERS[exact];
        else {
          const partial = optionsList.findIndex(
            (opt) =>
              opt.toLowerCase().includes(candidate.toLowerCase()) ||
              candidate.toLowerCase().includes(opt.toLowerCase())
          );
          if (partial >= 0) resolved = LETTERS[partial];
        }
      }

      if (resolved) {
        updates.correct_answer = resolved;
      } else {
        const qType = (existingQuestion as any)?.question_type || 'objective';
        if (qType === 'theory' || optionsList.length === 0) {
          updates.correct_answer = candidate || null;
        } else {
          return NextResponse.json(
            { error: 'correctAnswer could not be resolved to an option letter for this objective question' },
            { status: 400 }
          );
        }
      }
    }

    if (body?.difficulty && ['easy', 'medium', 'hard'].includes(body.difficulty)) {
      updates.difficulty = body.difficulty;
    }

    if (body?.visibility && ['private', 'public_school'].includes(body.visibility)) {
      updates.visibility = body.visibility;
    }

    if (Array.isArray(body?.options)) {
      updates.options = (body.options as string[]).map((v: string) => String(v || '').trim()).filter(Boolean);
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No valid update fields supplied' }, { status: 400 });
    }

    let query = supabase
      .from('teacher_questions')
      .update(updates)
      .eq('id', questionId)
      .eq('school_id', schoolId);

    if (role === 'teacher') {
      query = query.eq('created_by_teacher_id', userId);
    }

    const { data, error } = await query
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

    // Audit log for question edit
    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at');
    await insertAuditLog(supabase, data.bank_id || existingQuestion.bank_id, schoolId, 'question_updated', userId, role as 'teacher' | 'admin', {
      questionId: data.id,
      changedFields,
      questionText: (data.question_text || '').slice(0, 100),
    });

    return NextResponse.json({ question: data });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { role, questionId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  let query = supabase
    .from('teacher_questions')
    .delete()
    .eq('id', questionId)
    .eq('school_id', schoolId);

  if (role === 'teacher') {
    query = query.eq('created_by_teacher_id', userId);
  }

  // Fetch question info before deleting for audit
  const { data: questionToDelete } = await supabase
    .from('teacher_questions')
    .select('bank_id, topic, question_text')
    .eq('id', questionId)
    .maybeSingle();

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Audit log for question delete
  if (questionToDelete) {
    await insertAuditLog(supabase, questionToDelete.bank_id, schoolId, 'question_deleted', userId, role as 'teacher' | 'admin', {
      questionId,
      topic: questionToDelete.topic,
      questionText: (questionToDelete.question_text || '').slice(0, 100),
    });
  }

  return NextResponse.json({ success: true });
}
