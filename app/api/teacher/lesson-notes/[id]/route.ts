import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext } from '@/lib/teacher-question-bank/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  const { data, error } = await supabase
    .from('teacher_lesson_notes')
    .select('*')
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('created_by_teacher_id', teacherId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Lesson note not found' }, { status: error ? 400 : 404 });
  }

  return NextResponse.json({ success: true, lessonNote: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.topic !== undefined) updates.topic = String(body.topic).trim();
    if (body.content !== undefined) updates.content = body.content;
    if (body.objectives !== undefined) updates.objectives = body.objectives;
    if (body.summary !== undefined) updates.summary = String(body.summary).trim();
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'published', 'archived'];
      if (validStatuses.includes(body.status)) {
        updates.status = body.status;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('teacher_lesson_notes')
      .update(updates)
      .eq('id', id)
      .eq('school_id', schoolId)
      .eq('created_by_teacher_id', teacherId)
      .select('id, title, topic, subject_class_id, content, objectives, summary, status, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, lessonNote: data });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, schoolId, teacherId } = ctxResult.context;

  const { error } = await supabase
    .from('teacher_lesson_notes')
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId)
    .eq('created_by_teacher_id', teacherId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
