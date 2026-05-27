import { NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  const [subjectClassesResult, topicSetsResult, banksResult] = await Promise.all([
    supabase
      .from('subject_classes')
      .select(`
        id,
        subject_id,
        class_id,
        subjects!subject_classes_subject_id_fkey(id, name),
        classes(id, name)
      `)
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false }),
    supabase
      .from('teacher_question_topic_sets')
      .select('id, name, topics, subject_class_id, created_at')
      .eq('school_id', schoolId)
      .eq('created_by_teacher_id', teacherId)
      .order('created_at', { ascending: false }),
    supabase
      .from('teacher_question_banks')
      .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_at')
      .eq('school_id', schoolId)
      .or(`created_by_teacher_id.eq.${teacherId},visibility.eq.public_school`)
      .order('created_at', { ascending: false }),
  ]);

  if (subjectClassesResult.error) {
    return NextResponse.json({ error: subjectClassesResult.error.message }, { status: 400 });
  }
  if (topicSetsResult.error) {
    return NextResponse.json({ error: topicSetsResult.error.message }, { status: 400 });
  }
  if (banksResult.error) {
    return NextResponse.json({ error: banksResult.error.message }, { status: 400 });
  }

  return NextResponse.json({
    teacherId,
    subjectClasses: subjectClassesResult.data || [],
    topicSets: topicSetsResult.data || [],
    banks: banksResult.data || [],
  });
}
