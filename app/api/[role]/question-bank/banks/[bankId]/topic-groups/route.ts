import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string }>;
};

function inferTopicGroupTerm(name: string) {
  const label = name.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';
  return undefined;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  let bankQuery = supabase
    .from('teacher_question_banks')
    .select('id, subject_class_id, visibility, created_by_teacher_id, created_by_admin_id')
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

  // Build query for topic sets - teachers see their own, admins see all for the subject class
  let topicQuery = supabase
    .from('teacher_question_topic_sets')
    .select('id, name, topics, created_by_teacher_id, created_by_admin_id, created_at')
    .eq('school_id', schoolId)
    .eq('subject_class_id', bank.subject_class_id);

  if (role === 'teacher') {
    topicQuery = topicQuery.eq('created_by_teacher_id', userId);
  }

  topicQuery = topicQuery.order('created_at', { ascending: false });

  const { data: groups, error: groupsError } = await topicQuery;

  if (groupsError) {
    return NextResponse.json({ error: groupsError.message }, { status: 400 });
  }

  const mapped = (groups || []).map((g: any) => ({
    id: g.id,
    title: g.name,
    topics: g.topics || [],
    term: inferTopicGroupTerm(g.name),
    created_by_teacher_id: g.created_by_teacher_id,
    created_by_admin_id: g.created_by_admin_id,
    created_at: g.created_at,
  }));

  return NextResponse.json({ groups: mapped });
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
) {
  const { role, bankId } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = String(body?.title || '').trim();
    const topics = Array.isArray(body?.topics) ? body.topics : [];

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

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

    // Verify ownership for editing
    const isOwner = role === 'teacher'
      ? bank.created_by_teacher_id === userId
      : bank.created_by_admin_id === userId;

    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const insertPayload: any = {
      school_id: schoolId,
      subject_class_id: bank.subject_class_id,
      name: title,
      topics: topics,
    };

    if (role === 'teacher') {
      insertPayload.created_by_teacher_id = userId;
    } else {
      insertPayload.created_by_admin_id = userId;
    }

    const { data, error } = await supabase
      .from('teacher_question_topic_sets')
      .insert(insertPayload)
      .select('id, name, topics, created_by_teacher_id, created_by_admin_id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
