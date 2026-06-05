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
  contains_math: boolean; // 👈 Explicit metadata flag for the frontend
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

    const partialIdx = options.findIndex((opt) => opt.toLowerCase().includes(normalizedCandidate.toLowerCase()) || normalizedCandidate.toLowerCase().includes(opt.toLowerCase()));
    if (partialIdx >= 0) return LETTERS[partialIdx];

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

    // Read the boolean flag safely from the AI output, default to false if omitted
    const containsMath = typeof row.contains_math === 'boolean' ? row.contains_math : false;

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

    // theory
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
      temperature: 0.5,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: [
            'You are an expert teacher question author.',
            'Return only valid JSON with shape {"questions": GeneratedQuestion[]}.',
            'GeneratedQuestion fields: topic, question_text, options (string[] for objective), correct_answer (the letter A, B, C, or D for objective, or the model answer string for theory), explanation, contains_math (boolean).',
            'CRITICAL FORMATTING DIRECTIONS FOR MATH & SCIENCE: You are completely free to output mathematical symbols, formulas, variables, and fractions when relevant.',
            'CRITICAL ESCAPING RULE FOR JSON: Because you are returning raw JSON text, you MUST double-escape all LaTeX backslashes. For example, write "\\\\frac" instead of "\\frac", and "\\\\rightarrow" instead of "\\rightarrow". If you fail to double-escape backslashes, the JSON will fail parsing.',
            'CRITICAL MATH FORMATTING RULES:',
            '1. Wrap ALL mathematical expressions, equations, single letter variables (e.g., $x$, $y$), and fractions strictly in standard LaTeX markdown delimiters using single dollar signs for inline ($...$) or double dollar signs for blocks ($$...$$). Do not use parentheses like `(\\\\frac...)`.',
            '2. Example of correct double-escaped output: "Multiply the fractions $\\\\frac{3}{x+1}$ and $\\\\frac{x-1}{2}$."',
            'CRITICAL CHEMISTRY FORMATTING RULES:',
            '1. DO NOT use the \\\\ce{...} macro for chemical expressions under any circumstances.',
            '2. Instead, wrap all chemical equations strictly using standard math mode dollar signs ($...$) along with subscripts (\\\\_).',
            '3. Always use standard arrows like \\\\rightarrow or \\\\longrightarrow for reactions.',
            '4. Examples of correct chemistry escaping:',
            '   - For methane combustion, output: $CH\\\\_4 + 2O\\\\_2 \\\\rightarrow CO\\\\_2 + 2H\\\\_2O$',
            '   - For an ion, output: $H^+$ or $SO\\\\_4^{2-}$',
            'CRITICAL EDGE CASE DEFENSES:',
            '1. TEXT INSIDE MATH: If you must write standard text units inside math mode, wrap them in the text macro. Example: "$\\\\frac{10\\\\ \\\\text{meters}}{2\\\\ \\\\text{seconds}}$".',
            '2. ECONOMICS & MONETARY SYMBOLS: If writing plain text monetary values, escape them with a backslash (e.g., "\\\\$50") or use text codes ("50 USD") so they do not accidentally trigger mathematical formatting mode.',
            '3. INEQUALITIES: Never write standalone inequality tags in plain text like "x < y" or tags like "<Array>" because they break HTML/Markdown parsers. Always wrap inequalities inside math formatting delimiters (e.g., "$x < y$").',
            'METADATA REQUIREMENT: If a question object contains any LaTeX notations, formulas, chemical equations, or single variables anywhere within its topic, question_text, options, or explanation fields, you MUST set "contains_math" strictly to true. Otherwise, if the question object is completely normal plain conversational text, set it to false.',
            'Do not include markdown blocks like ```json or any extra commentary outside the JSON object.',
          ].join(' '),
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
        error_message: 'AI payload could not be validated',
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
        containsMath: question.contains_math, // 👈 Saved inside your Supabase JSONB metadata column
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