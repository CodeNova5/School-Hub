import { NextRequest, NextResponse } from 'next/server';
import { fetchGroqChatCompletion } from '@/lib/ai-assistant/groq-client';
import { getTeacherQuestionBankContext, parseGroqJsonPayload, toTopicList } from '@/lib/teacher-question-bank/server';

const GROQ_MODEL = 'openai/gpt-oss-20b';

export const dynamic = 'force-dynamic';

function toLooseTopicList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const fromArray = value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          const nested = record.topic ?? record.title ?? record.name;
          return typeof nested === 'string' ? nested : '';
        }
        return '';
      })
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (fromArray.length > 0) {
      return fromArray;
    }
  }

  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,|;/)
      .map((entry) => entry.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(Boolean);
  }

  return [];
}

function extractTopicsFromRaw(raw: unknown): string[] {
  if (typeof raw !== 'string') {
    return [];
  }

  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;

    if (Array.isArray(parsed)) {
      return toLooseTopicList(parsed);
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const candidates = [
        record.topics,
        record.topic_list,
        record.topicList,
        record.suggestions,
        (record.data as Record<string, unknown> | undefined)?.topics,
        (record.result as Record<string, unknown> | undefined)?.topics,
      ];

      for (const candidate of candidates) {
        const list = toLooseTopicList(candidate);
        if (list.length > 0) {
          return list;
        }
      }
    }
  } catch {
    // Fall back to parsing plain text list output.
  }

  return toLooseTopicList(cleaned);
}

function dedupeTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const topic of topics) {
    const cleaned = topic.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(cleaned);
  }

  return normalized;
}

function buildDeterministicFallbackTopics(subjectName: string, className: string, termLabel: string): string[] {
  return [
    `Introduction to ${subjectName}`,
    `${subjectName}: Core Concepts for ${className}`,
    `${termLabel} Scheme of Work Overview`,
    `Key Terms and Definitions in ${subjectName}`,
    `Foundational Principles of ${subjectName}`,
    `Worked Examples and Guided Practice`,
    `Real-Life Applications of ${subjectName}`,
    `Problem Solving Techniques`,
    `Revision and Reinforcement Exercises`,
    `Assessment Preparation for ${subjectName}`,
  ];
}

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
            'Generate topics strictly from official NERDC curriculum Of Nigeria and scheme-of-work style sources for the requested subject, class, and term.',
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
            'Use the official NERDC curriculum Of Nigeria and scheme of work for the specified term.',
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
    const directTopics = toTopicList(parsed?.topics);
    const fallbackTopics = extractTopicsFromRaw(raw);
    const topics = dedupeTopics(directTopics.length > 0 ? directTopics : fallbackTopics);

    if (topics.length === 0) {
      const deterministicFallback = buildDeterministicFallbackTopics(subjectName, className, termLabel);
      return NextResponse.json({ topics: deterministicFallback.slice(0, topicCount), source: 'fallback' });
    }

    return NextResponse.json({ topics: topics.slice(0, topicCount), source: 'ai' });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
