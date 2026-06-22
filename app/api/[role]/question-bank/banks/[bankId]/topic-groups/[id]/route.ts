import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string; id: string }>;
};

function inferTopicGroupTerm(name: string) {
  const label = name.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';
  return undefined;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId, id } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = body?.title ? String(body.title).trim() : null;
    const topics = Array.isArray(body?.topics) ? body.topics : null;

    const { data: bank, error: bankError } = await supabase
      .from('teacher_question_banks')
      .select('id, subject_class_id, created_by_teacher_id, created_by_admin_id')
      .eq('id', bankId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (bankError) {
      return NextResponse.json({ error: bankError.message }, { status: 400 });
    }

    if (!bank) {
      return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
    }

    const { data: existing, error: existingError } = await supabase
      .from('teacher_question_topic_sets')
      .select('id, subject_class_id, created_by_teacher_id, created_by_admin_id')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Topic group not found' }, { status: 404 });
    }

    // Check ownership
    const isOwner = role === 'teacher'
      ? existing.created_by_teacher_id === userId
      : existing.created_by_admin_id === userId;

    if (!isOwner || existing.subject_class_id !== bank.subject_class_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: any = {};
    if (title !== null) updates.name = title;
    if (topics !== null) updates.topics = topics;

    const { data, error } = await supabase
      .from('teacher_question_topic_sets')
      .update(updates)
      .eq('id', id)
      .select('id, name, topics, created_by_teacher_id, created_by_admin_id, created_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to update topic group' }, { status: 400 });
    }

    return NextResponse.json({
      group: {
        id: data.id,
        title: data.name,
        topics: data.topics,
        term: inferTopicGroupTerm(data.name),
        created_by_teacher_id: data.created_by_teacher_id,
        created_by_admin_id: data.created_by_admin_id,
        created_at: data.created_at,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId, id } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  const { data: bank, error: bankError } = await supabase
    .from('teacher_question_banks')
    .select('id, subject_class_id, created_by_teacher_id, created_by_admin_id')
    .eq('id', bankId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (bankError) {
    return NextResponse.json({ error: bankError.message }, { status: 400 });
  }

  if (!bank) {
    return NextResponse.json({ error: 'Question bank not found' }, { status: 404 });
  }

  const { data: existing, error: existingError } = await supabase
    .from('teacher_question_topic_sets')
    .select('id, subject_class_id, created_by_teacher_id, created_by_admin_id')
    .eq('id', id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }

  if (!existing) {
    return NextResponse.json({ error: 'Topic group not found' }, { status: 404 });
  }

  const isOwner = role === 'teacher'
    ? existing.created_by_teacher_id === userId
    : existing.created_by_admin_id === userId;

  if (!isOwner || existing.subject_class_id !== bank.subject_class_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase.from('teacher_question_topic_sets').delete().eq('id', id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({});
}
