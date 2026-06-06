import { NextRequest, NextResponse } from 'next/server';
import { fetchGroqChatCompletion } from '@/lib/ai-assistant/groq-client';
import { getTeacherQuestionBankContext, parseGroqJsonPayload, toTopicList } from '@/lib/teacher-question-bank/server';

const GROQ_MODEL = 'openai/gpt-oss-20b';
const PROMPT_VERSION = 'v1';

type GeneratedQuestion = {
  topic: string;
  question_text: string;
  options: string[];
  correct_answer?: string | null;
  explanation?: string | null;
  contains_math: boolean;
};

function normalizeGeneratedQuestions(input: unknown, questionType: 'objective' | 'theory'): GeneratedQuestion[] {
  if (!Array.isArray(input)) return [];

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  function resolveLetter(options: string[], raw: string | undefined | null): string | null {
    if (!raw) return null;
    const candidate = String(raw).trim();
    if (!candidate) return null;

    const strippedCandidate = candidate
      .replace(/^answer\s*[:\-]?\s*/i, '')
      .replace(/^(?:option\s*)?([A-H])\s*[).:-]?\s*/i, '$1')
      .trim();

    const normalizedCandidate = strippedCandidate || candidate;

    if (/^[A-H]$/i.test(normalizedCandidate)) {
      const idx = LETTERS.indexOf(normalizedCandidate.toUpperCase());
      if (idx >= 0 && idx < options.length) return LETTERS[idx];
    }

    const letterMatch = normalizedCandidate.match(/^([A-H])\b/i);
    if (letterMatch) {
      const idx = LETTERS.indexOf(letterMatch[1].toUpperCase());
      if (idx >= 0 && idx < options.length) return LETTERS[idx];
    }

    const exactIdx = options.findIndex((opt) => opt.toLowerCase() === normalizedCandidate.toLowerCase());
    if (exactIdx >= 0) return LETTERS[exactIdx];

    const partialIdx = options.findIndex(
      (opt) =>
        opt.toLowerCase().includes(normalizedCandidate.toLowerCase()) ||
        normalizedCandidate.toLowerCase().includes(opt.toLowerCase()),
    );
    if (partialIdx >= 0) return LETTERS[partialIdx];

    const anyLetter = candidate.match(/\b([A-H])\b/i);
    if (anyLetter) {
      const idx = LETTERS.indexOf(anyLetter[1].toUpperCase());
      if (idx >= 0 && idx < options.length) return LETTERS[idx];
      if (options.length > 0) return LETTERS[0];
    }

    return null;
  }

  const normalized: GeneratedQuestion[] = [];

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const topic = String(row.topic || '').trim();
    const questionText = String(row.question_text || '').trim();
    const explanation = row.explanation ? String(row.explanation).trim() : '';
    const rawCorrect = row.correct_answer ? String(row.correct_answer).trim() : '';

    const containsMathFromAI = typeof row.contains_math === 'boolean' ? row.contains_math : false;
    const LATEX_RE = /\$[^$\n]+?\$|\$$[\s\S]+?\$$|\\(?:frac|sqrt|le|ge|leq|geq|times|div|sum|int|pm|cdot|alpha|beta|gamma|theta|pi|sigma|infty)\b/;
    const allText = [
      String(row.question_text || ''),
      ...(Array.isArray(row.options) ? row.options.map(String) : []),
      String(row.explanation || ''),
    ].join(' ');
    const containsMath = containsMathFromAI || LATEX_RE.test(allText);

    if (!topic || !questionText) continue;

    if (questionType === 'objective') {
      const options = Array.isArray(row.options)
        ? row.options.map((v) => String(v || '').trim()).filter(Boolean)
        : [];

      if (options.length < 2) continue;

      const letter = resolveLetter(options, rawCorrect);
      if (!letter) continue;

      normalized.push({
        topic,
        question_text: questionText,
        options,
        correct_answer: letter,
        explanation,
        contains_math: containsMath,
      });
      continue;
    }

    normalized.push({
      topic,
      question_text: questionText,
      options: [],
      correct_answer: rawCorrect || null,
      explanation,
      contains_math: containsMath,
    });
  }

  return normalized;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const bankId = String(body?.bankId || '').trim();
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const difficulty = body?.difficulty as 'easy' | 'medium' | 'hard';
    const questionType = body?.questionType as 'objective' | 'theory';
    const count = Number(body?.count || 5);
    const topicSetId = body?.topicSetId ? String(body.topicSetId).trim() : null;
    const explicitTopics = toTopicList(body?.topics);
    const visibility = body?.visibility === 'public_school' ? 'public_school' : 'private';

    if (!bankId || !subjectClassId || !difficulty || !questionType) {
      return NextResponse.json({ error: 'bankId, subjectClassId, difficulty, and questionType are required' }, { status: 400 });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'difficulty must be easy, medium, or hard' }, { status: 400 });
    }

    if (!['objective', 'theory'].includes(questionType)) {
      return NextResponse.json({ error: 'questionType must be objective or theory' }, { status: 400 });
    }

    const questionCount = Math.min(Math.max(Number.isFinite(count) ? Math.floor(count) : 5, 1), 30);

    const [bankResult, subjectClassResult] = await Promise.all([
      supabase
        .from('teacher_question_banks')
        .select('id, title, visibility, created_by_teacher_id')
        .eq('id', bankId)
        .eq('school_id', schoolId)
        .eq('created_by_teacher_id', teacherId)
        .maybeSingle(),
      supabase
        .from('subject_classes')
        .select(`
          id,
          teacher_id,
          subjects!subject_classes_subject_id_fkey(name),
          classes(name)
        `)
        .eq('id', subjectClassId)
        .eq('school_id', schoolId)
        .eq('teacher_id', teacherId)
        .maybeSingle(),
    ]);

    if (bankResult.error || !bankResult.data) {
      return NextResponse.json({ error: 'Question bank not found or not editable by teacher' }, { status: 403 });
    }

    if (subjectClassResult.error || !subjectClassResult.data) {
      return NextResponse.json({ error: 'Invalid subject class selection' }, { status: 403 });
    }

    let topics = explicitTopics;

    if (topicSetId) {
      const { data: topicSet } = await supabase
        .from('teacher_question_topic_sets')
        .select('topics')
        .eq('id', topicSetId)
        .eq('school_id', schoolId)
        .eq('created_by_teacher_id', teacherId)
        .maybeSingle();

      if (topicSet?.topics) {
        topics = toTopicList(topicSet.topics);
      }
    }

    if (topics.length === 0) {
      return NextResponse.json({ error: 'Provide topics or topicSetId with saved topics' }, { status: 400 });
    }

    const subjectName = (subjectClassResult.data as any)?.subjects?.name || 'the selected subject';
    const className = (subjectClassResult.data as any)?.classes?.name || 'the selected class';

    const requestPayload = {
      bankId,
      subjectClassId,
      difficulty,
      questionType,
      count: questionCount,
      topicSetId,
      topics,
      promptVersion: PROMPT_VERSION,
    };

    const groqResponse = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert teacher question author.',
            'Return ONLY valid JSON with shape {"questions": GeneratedQuestion[]}. No markdown fences, no commentary outside the JSON.',
            'GeneratedQuestion fields: topic (string), question_text (string), options (string[] — exactly 4 items for objective, empty [] for theory), correct_answer ("A"|"B"|"C"|"D" for objective OR a model-answer string for theory), explanation (string), contains_math (boolean).',
            '',
            'CHEMISTRY & SCIENCE FORMATTING RULES:',
            '- For simple chemical formulas, prefer plain-text Unicode subscripts/superscripts or just write them plainly: H2O, CO2, Fe2O3, NaOH, H2SO4, Ca(OH)2.',
            '- For chemical equations, use plain-text arrows: → for forward, ⇌ for equilibrium.',
            '- Only use LaTeX ($...$) when you truly need complex mathematical expressions like fractions, integrals, or elaborate equations.',
            '- Example good chemistry question text: "What is the product when H2SO4 reacts with NaOH?"',
            '- Example bad chemistry question text: "What is the product when $\\text{H}_2\\text{SO}_4$ reacts with $\\text{NaOH}$?"',
            '',
            'CRITICAL JSON RULES:',
            '1. All backslashes in JSON string values MUST be double-escaped: use \\\\ not \\.',
            '2. Do NOT include trailing commas before ] or }.',
            '3. Ensure all strings are properly terminated with closing quotes.',
            '4. contains_math MUST be true if ANY field contains $...$ LaTeX. Otherwise false.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Generate ${questionCount} ${questionType} questions for subject ${subjectName} and class ${className}.`,
            `Difficulty level: ${difficulty}.`,
            `Topics to cover: ${topics.join(', ')}.`,
            questionType === 'objective'
              ? 'Each objective question must include exactly 4 options. The correct_answer must strictly be only the letter index of the correct option: "A", "B", "C", or "D".'
              : 'For theory questions include a concise model answer in correct_answer and marking guidance in explanation.',
            'Use plain text for chemical formulas (H2O, CO2, NaOH) — do NOT use LaTeX for simple chemistry notation.',
            'Output valid JSON only.',
          ].join('\n'),
        },
      ],
    });

    if (!groqResponse.ok) {
      await supabase.from('teacher_question_generation_logs').insert({
        school_id: schoolId,
        teacher_id: teacherId,
        subject_class_id: subjectClassId,
        bank_id: bankId,
        topic_set_id: topicSetId,
        question_type: questionType,
        difficulty,
        requested_count: questionCount,
        generated_count: 0,
        model: GROQ_MODEL,
        prompt_version: PROMPT_VERSION,
        status: 'failed',
        error_message: groqResponse.error,
        request_payload: requestPayload,
      });

      return NextResponse.json({ error: groqResponse.error }, { status: groqResponse.status || 400 });
    }

    const rawContent = groqResponse.data?.choices?.[0]?.message?.content;
    const parsed = parseGroqJsonPayload(rawContent);
    const generatedQuestions = normalizeGeneratedQuestions(parsed?.questions, questionType);

    if (generatedQuestions.length === 0) {
      await supabase.from('teacher_question_generation_logs').insert({
        school_id: schoolId,
        teacher_id: teacherId,
        subject_class_id: subjectClassId,
        bank_id: bankId,
        topic_set_id: topicSetId,
        question_type: questionType,
        difficulty,
        requested_count: questionCount,
        generated_count: 0,
        model: GROQ_MODEL,
        prompt_version: PROMPT_VERSION,
        status: 'failed',
        error_message: 'AI payload could not be validated due to structure or parse failure',
        request_payload: requestPayload,
        response_payload: { rawContent },
      });

      return NextResponse.json({ error: 'AI payload could not be validated' }, { status: 422 });
    }

    const rowsToInsert = generatedQuestions.map((question) => ({
      school_id: schoolId,
      bank_id: bankId,
      subject_class_id: subjectClassId,
      topic_set_id: topicSetId,
      created_by_teacher_id: teacherId,
      question_type: questionType,
      difficulty,
      visibility,
      topic: question.topic,
      question_text: question.question_text,
      options: questionType === 'objective' ? question.options || [] : [],
      correct_answer: question.correct_answer || null,
      explanation: question.explanation || null,
      metadata: {
        generatedBy: 'groq',
        model: GROQ_MODEL,
        promptVersion: PROMPT_VERSION,
        containsMath: question.contains_math,
      },
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from('teacher_questions')
      .insert(rowsToInsert)
      .select(`
        id,
        topic,
        question_text,
        options,
        correct_answer,
        explanation,
        question_type,
        difficulty,
        visibility,
        created_by_teacher_id,
        created_at,
        updated_at,
        metadata
      `);

    if (insertError) {
      await supabase.from('teacher_question_generation_logs').insert({
        school_id: schoolId,
        teacher_id: teacherId,
        subject_class_id: subjectClassId,
        bank_id: bankId,
        topic_set_id: topicSetId,
        question_type: questionType,
        difficulty,
        requested_count: questionCount,
        generated_count: 0,
        model: GROQ_MODEL,
        prompt_version: PROMPT_VERSION,
        status: 'failed',
        error_message: insertError.message,
        request_payload: requestPayload,
        response_payload: { rawContent },
      });

      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    await supabase.from('teacher_question_generation_logs').insert({
      school_id: schoolId,
      teacher_id: teacherId,
      subject_class_id: subjectClassId,
      bank_id: bankId,
      topic_set_id: topicSetId,
      question_type: questionType,
      difficulty,
      requested_count: questionCount,
      generated_count: insertedRows?.length || 0,
      model: GROQ_MODEL,
      prompt_version: PROMPT_VERSION,
      status: 'success',
      request_payload: requestPayload,
      response_payload: {
        rawContent,
        insertedCount: insertedRows?.length || 0,
      },
    });

    return NextResponse.json({
      questions: insertedRows || [],
      generatedCount: insertedRows?.length || 0,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }
}
