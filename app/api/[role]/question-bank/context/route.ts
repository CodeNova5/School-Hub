import { NextRequest, NextResponse } from 'next/server';
import { getQuestionBankAuthContext } from '@/lib/question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ role: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { role } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  // Teachers query targets their assignment; Admins see school-wide listings
  let subjectClassesQuery = supabase
    .from('subject_classes')
    .select(`
      id,
      subject_id,
      class_id,
      subjects!subject_classes_subject_id_fkey(id, name),
      classes(id, name)
    `)
    .eq('school_id', schoolId);

  if (role === 'teacher') {
    subjectClassesQuery = subjectClassesQuery.eq('teacher_id', userId);
  }

  let topicSetsQuery = supabase
    .from('teacher_question_topic_sets')
    .select('id, name, topics, subject_class_id, created_at')
    .eq('school_id', schoolId);

  if (role === 'teacher') {
    topicSetsQuery = topicSetsQuery.eq('created_by_teacher_id', userId);
  } else {
    topicSetsQuery = topicSetsQuery.eq('created_by_admin_id', userId);
  }

  const idColumn = role === 'teacher' ? 'created_by_teacher_id' : 'created_by_admin_id';
  
  const [subjectClassesResult, topicSetsResult, banksResult] = await Promise.all([
    subjectClassesQuery.order('created_at', { ascending: false }),
    topicSetsQuery.order('created_at', { ascending: false }),
    supabase
      .from('teacher_question_banks')
      .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_by_admin_id, created_at')
      .eq('school_id', schoolId)
      .or(`${idColumn}.eq.${userId},visibility.eq.public_school`)
      .order('created_at', { ascending: false }),
  ]);

  if (subjectClassesResult.error) return NextResponse.json({ error: subjectClassesResult.error.message }, { status: 400 });
  if (topicSetsResult.error) return NextResponse.json({ error: topicSetsResult.error.message }, { status: 400 });
  if (banksResult.error) return NextResponse.json({ error: banksResult.error.message }, { status: 400 });

  return NextResponse.json({
    userId,
    subjectClasses: subjectClassesResult.data || [],
    topicSets: topicSetsResult.data || [],
    banks: banksResult.data || [],
  });
}