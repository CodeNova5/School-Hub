import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';
import { insertAuditLog } from '@/lib/question-bank/audit';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string; bankId: string; id: string }>;
};

/** Build a default 12-week scheme-of-work array with week 6 as break */
function buildDefaultWeeks(): WeekEntry[] {
  const weeks: WeekEntry[] = [];
  for (let w = 1; w <= 12; w++) {
    weeks.push({ week_number: w, topics: [], is_break: w === 6 });
  }
  return weeks;
}

/** Flatten all topics from weeks into a single array */
function flattenTopicsFromWeeks(weeks: WeekEntry[]): string[] {
  return (weeks || [])
    .filter((w) => !w.is_break)
    .flatMap((w) => w.topics || [])
    .filter(Boolean);
}

type WeekEntry = {
  week_number: number;
  topics: string[];
  is_break: boolean;
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

  const { supabase, userId, userName, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = body?.title ? String(body.title).trim() : null;
    const topics = Array.isArray(body?.topics) ? body.topics : null;
    const weeks = Array.isArray(body?.weeks) ? body.weeks : null;

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
    if (weeks !== null) {
      updates.weeks = weeks;
      // Also update flat topics list from weeks for queries that reference topics
      updates.topics = flattenTopicsFromWeeks(weeks);
    }

    const { data, error } = await supabase
      .from('teacher_question_topic_sets')
      .update(updates)
      .eq('id', id)
      .select('id, name, topics, weeks, created_by_teacher_id, created_by_admin_id, created_at')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to update topic group' }, { status: 400 });
    }

    const savedWeeks: WeekEntry[] = (data.weeks as WeekEntry[]) || [];
    const hasWeeks = Array.isArray(savedWeeks) && savedWeeks.length > 0;

    // Audit log for group update
    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at');
    await insertAuditLog(supabase, bankId, schoolId, 'group_updated', userId, role as 'teacher' | 'admin', {
      groupId: data.id,
      changedFields,
      title: data.name,
    }, userName);

    return NextResponse.json({
      group: {
        id: data.id,
        title: data.name,
        topics: hasWeeks ? flattenTopicsFromWeeks(savedWeeks) : (data.topics || []),
        weeks: hasWeeks ? savedWeeks : buildDefaultWeeks(),
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

  const { supabase, userId, userName, schoolId } = ctxResult.context;

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
    .select('id, name, subject_class_id, created_by_teacher_id, created_by_admin_id')
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

  // Audit log for group deletion
  await insertAuditLog(supabase, bankId, schoolId, 'group_deleted', userId, role as 'teacher' | 'admin', {
    groupId: id,
    title: existing.name,
  }, userName);

  return NextResponse.json({});
}
