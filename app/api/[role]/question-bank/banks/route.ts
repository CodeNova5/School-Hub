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
  const url = new URL(request.url);
  const subjectClassId = url.searchParams.get('subjectClassId');
  const owner = url.searchParams.get('owner');

  let query = supabase
    .from('teacher_question_banks')
    .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_by_admin_id, created_at, updated_at')
    .eq('school_id', schoolId)
    .order('updated_at', { ascending: false });

  if (subjectClassId) {
    query = query.eq('subject_class_id', subjectClassId);
  }

  // Teachers see their own banks + school-shared; admins see everything
  if (role === 'teacher') {
    if (owner === 'mine') {
      query = query.eq('created_by_teacher_id', userId);
    } else {
      query = query.or(`created_by_teacher_id.eq.${userId},visibility.eq.public_school`);
    }
  } else if (owner === 'mine') {
    query = query.eq('created_by_admin_id', userId);
  }
  // Admins with no owner filter see all banks

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ banks: data || [] });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { role } = await params;
  const ctxResult = await getQuestionBankAuthContext(role);

  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, userId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const title = String(body?.title || '').trim();
    const description = body?.description ? String(body.description).trim() : null;
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';

    if (!title || !subjectClassId) {
      return NextResponse.json({ error: 'title and subjectClassId are required' }, { status: 400 });
    }

    let scQuery = supabase
      .from('subject_classes')
      .select('id')
      .eq('id', subjectClassId)
      .eq('school_id', schoolId);

    if (role === 'teacher') {
      scQuery = scQuery.eq('teacher_id', userId);
    }

    const { data: subjectClass, error: subjectClassError } = await scQuery.maybeSingle();

    if (subjectClassError || !subjectClass) {
      return NextResponse.json({ error: 'Invalid subject class selection' }, { status: 403 });
    }

    const insertPayload: Record<string, any> = {
      school_id: schoolId,
      subject_class_id: subjectClassId,
      title,
      description,
      visibility,
    };

    if (role === 'teacher') {
      insertPayload.created_by_teacher_id = userId;
    } else {
      insertPayload.created_by_admin_id = userId;
    }

    const { data, error } = await supabase
      .from('teacher_question_banks')
      .insert(insertPayload)
      .select('id, title, description, subject_class_id, visibility, created_by_teacher_id, created_by_admin_id, created_at, updated_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ bank: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}