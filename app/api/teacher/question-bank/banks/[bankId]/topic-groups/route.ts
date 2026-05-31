import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

function inferTopicGroupTerm(name: string) {
  const label = name.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';
  return undefined;
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
    .select('id, subject_class_id, visibility, created_by_teacher_id')
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

  const { data: groups, error: groupsError } = await supabase
    .from('teacher_question_topic_sets')
    .select('id, name, topics, created_by_teacher_id, created_at')
    .eq('school_id', schoolId)
    .eq('subject_class_id', bank.subject_class_id)
    .eq('created_by_teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (groupsError) {
    return NextResponse.json({ error: groupsError.message }, { status: 400 });
  }

  const mapped = (groups || []).map((g: any) => ({
    id: g.id,
    title: g.name,
    topics: g.topics || [],
    term: inferTopicGroupTerm(g.name),
    created_by_teacher_id: g.created_by_teacher_id,
    created_at: g.created_at,
  }));

  return NextResponse.json({ groups: mapped });
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

  try {
    const body = await request.json();
    const title = String(body?.title || '').trim();
    const topics = Array.isArray(body?.topics) ? body.topics : [];

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const { data: bank, error: bankError } = await supabase
      .from('teacher_question_banks')
      .select('id, subject_class_id, created_by_teacher_id')
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

    const { data, error } = await supabase
      .from('teacher_question_topic_sets')
      .insert({
        school_id: schoolId,
        created_by_teacher_id: teacherId,
        subject_class_id: bank.subject_class_id,
        name: title,
        topics: topics,
      })
      .select('id, name, topics, created_by_teacher_id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const group = data;
    return NextResponse.json({ group: { id: group.id, title: group.name, topics: group.topics, term: inferTopicGroupTerm(group.name), created_by_teacher_id: group.created_by_teacher_id, created_at: group.created_at } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
