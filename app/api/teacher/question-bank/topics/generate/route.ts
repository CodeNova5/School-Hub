import { NextRequest, NextResponse } from 'next/server';
import { fetchGroqChatCompletion } from '@/lib/ai-assistant/groq-client';
import { getTeacherQuestionBankContext, parseGroqJsonPayload, toTopicList } from '@/lib/teacher-question-bank/server';

const GROQ_MODEL = 'openai/gpt-oss-20b';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const count = Number(body?.count || 10);
    const guidance = String(body?.guidance || '').trim();
    const term = Number(body?.term || 1);

    if (!subjectClassId) {
      return NextResponse.json({ error: 'subjectClassId is required' }, { status: 400 });
    }

    if (![1, 2, 3].includes(term)) {
      return NextResponse.json({ error: 'term must be 1, 2, or 3' }, { status: 400 });
    }

    const topicCount = Math.min(Math.max(Number.isFinite(count) ? Math.floor(count) : 10, 3), 30);
    const termLabel = term === 1 ? '1st term' : term === 2 ? '2nd term' : '3rd term';

    const { data: subjectClass, error: subjectClassError } = await supabase
      .from('subject_classes')
      .select(`
        id,
        subjects!subject_classes_subject_id_fkey(name),
        classes(name)
      `)
      .eq('id', subjectClassId)
      .eq('school_id', schoolId)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (subjectClassError || !subjectClass) {
      return NextResponse.json({ error: 'Invalid subject class selection' }, { status: 403 });
    }

    const subjectName = (subjectClass as any)?.subjects?.name || 'the selected subject';
    const className = (subjectClass as any)?.classes?.name || 'the selected class';

    const response = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert school teacher assistant.',
            'Generate topics strictly from official NERDC curriculum and scheme-of-work style sources for the requested subject, class, and term.',
            'Do not invent topics outside the NERDC syllabus progression.',
            'Return JSON only with shape {"topics": string[]}. No markdown.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `Generate ${topicCount} high-quality teaching topics for subject: ${subjectName}.`,
            `Class: ${className}.`,
            `Term: ${termLabel}.`,
            guidance ? `Additional guidance: ${guidance}.` : '',
            'Use the official NERDC curriculum and scheme of work for the specified term.',
            'Focus on curriculum-appropriate progression from foundational to advanced topics.',
            'Return only JSON with a topics array of concise topic names.',
          ].filter(Boolean).join('\n'),
        },
      ],
    });

    if (!response.ok) {
      return NextResponse.json({ error: response.error }, { status: response.status || 400 });
    }

    const raw = response.data?.choices?.[0]?.message?.content;
    const parsed = parseGroqJsonPayload(raw);
    const topics = toTopicList(parsed?.topics);

    if (topics.length === 0) {
      return NextResponse.json({ error: 'AI returned invalid topics payload' }, { status: 422 });
    }

    return NextResponse.json({ topics: topics.slice(0, topicCount) });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
