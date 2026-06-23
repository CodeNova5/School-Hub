import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

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

/** Distribute a flat list of topics across teaching weeks (weeks 1-5, 7-12) */
function distributeTopicsAcrossWeeks(topics: string[], weeks: WeekEntry[]): WeekEntry[] {
  const teachingWeeks = weeks.filter((w) => !w.is_break);
  if (teachingWeeks.length === 0) return weeks;

  const result = weeks.map((w) => ({ ...w, topics: [] }));
  const topicsCopy = [...topics];

  let topicIdx = 0;
  while (topicIdx < topicsCopy.length) {
    for (const tw of teachingWeeks) {
      if (topicIdx >= topicsCopy.length) break;
      const weekIdx = result.findIndex((r) => r.week_number === tw.week_number);
      if (weekIdx !== -1) {
        result[weekIdx].topics.push(topicsCopy[topicIdx]);
      }
      topicIdx++;
    }
  }

  return result;
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

export async function GET(
  _request: NextRequest,
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
    .select('id, name, topics, weeks, created_by_teacher_id, created_at')
    .eq('school_id', schoolId)
    .eq('subject_class_id', bank.subject_class_id)
    .eq('created_by_teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (groupsError) {
    return NextResponse.json({ error: groupsError.message }, { status: 400 });
  }

  const mapped = (groups || []).map((g: any) => {
    const weeks: WeekEntry[] = (g.weeks as WeekEntry[]) || [];
    const hasWeeks = Array.isArray(weeks) && weeks.length > 0;
    return {
      id: g.id,
      title: g.name,
      topics: hasWeeks ? flattenTopicsFromWeeks(weeks) : (g.topics || []),
      weeks: hasWeeks ? weeks : buildDefaultWeeks(),
      term: inferTopicGroupTerm(g.name),
      created_by_teacher_id: g.created_by_teacher_id,
      created_at: g.created_at,
    };
  });

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

    // Build weeks from topics if not provided, or use provided weeks
    const weeks = Array.isArray(body?.weeks) ? body.weeks : buildDefaultWeeks();
    const finalWeeks = Array.isArray(body?.weeks)
      ? body.weeks
      : (topics.length > 0 ? distributeTopicsAcrossWeeks(topics, weeks) : weeks);

    const { data, error } = await supabase
      .from('teacher_question_topic_sets')
      .insert({
        school_id: schoolId,
        created_by_teacher_id: teacherId,
        subject_class_id: bank.subject_class_id,
        name: title,
        topics: flattenTopicsFromWeeks(finalWeeks),
        weeks: finalWeeks,
      })
      .select('id, name, topics, weeks, created_by_teacher_id, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const savedWeeks: WeekEntry[] = (data.weeks as WeekEntry[]) || [];
    const hasWeeks = Array.isArray(savedWeeks) && savedWeeks.length > 0;

    const group = data;
    return NextResponse.json({
      group: {
        id: group.id,
        title: group.name,
        topics: hasWeeks ? flattenTopicsFromWeeks(savedWeeks) : (group.topics || []),
        weeks: hasWeeks ? savedWeeks : buildDefaultWeeks(),
        term: inferTopicGroupTerm(group.name),
        created_by_teacher_id: group.created_by_teacher_id,
        created_at: group.created_at,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
