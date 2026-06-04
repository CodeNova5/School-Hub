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
  diagram?: string | null;
  diagram_type?: 'svg' | 'mermaid' | 'tikz' | 'chemfig' | null;
};

function parseDiagram(row: Record<string, unknown>): { diagram: string | null; diagramType: 'svg' | 'mermaid' | 'tikz' | 'chemfig' | null } {
  const rawDiagram = row.diagram ? String(row.diagram).trim() : '';
  const rawDiagramType = row.diagram_type ? String(row.diagram_type).trim().toLowerCase() : '';

  if (!rawDiagram) {
    return { diagram: null, diagramType: null };
  }

  // Clean code fences if present
  let cleaned = rawDiagram;
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
  }

  let type: 'svg' | 'mermaid' | 'tikz' | 'chemfig' | null = null;

  // 1. Check explicit type if provided
  if (rawDiagramType === 'svg' || rawDiagramType === 'mermaid' || rawDiagramType === 'tikz' || rawDiagramType === 'chemfig') {
    type = rawDiagramType;
  } else {
    // 2. Infer type from content
    if (cleaned.includes('<svg') || cleaned.startsWith('<svg') || cleaned.startsWith('<?xml')) {
      type = 'svg';
    } else if (cleaned.includes('\\chemfig')) {
      type = 'chemfig';
    } else if (cleaned.includes('\\draw') || cleaned.includes('\\tikz') || cleaned.startsWith('\\begin{tikzpicture}')) {
      type = 'tikz';
    } else if (
      cleaned.startsWith('graph') ||
      cleaned.startsWith('flowchart') ||
      cleaned.startsWith('sequenceDiagram') ||
      cleaned.startsWith('classDiagram') ||
      cleaned.startsWith('stateDiagram') ||
      cleaned.startsWith('erDiagram') ||
      cleaned.startsWith('gantt') ||
      cleaned.startsWith('pie') ||
      cleaned.startsWith('journey') ||
      cleaned.startsWith('gitGraph') ||
      /^(?:graph|sequenceDiagram|flowchart)\b/i.test(cleaned)
    ) {
      type = 'mermaid';
    }
  }

  // If we couldn't infer the type but we have content, we should default to svg if it looks like XML/HTML, else tikz/chemfig if it contains backslash, else mermaid
  if (!type) {
    if (cleaned.includes('<') && cleaned.includes('>')) {
      type = 'svg';
    } else if (cleaned.includes('\\chemfig')) {
      type = 'chemfig';
    } else if (cleaned.includes('\\')) {
      type = 'tikz';
    } else {
      type = 'mermaid';
    }
  }

  // Final validation/cleanup based on determined type
  if (type === 'svg') {
    // Ensure it contains a valid svg tag
    if (!cleaned.includes('<svg')) {
      return { diagram: null, diagramType: null };
    }
    return { diagram: cleaned, diagramType: 'svg' };
  } else if (type === 'mermaid') {
    // For mermaid, strip any leftover mermaid prefix/labels if they exist
    const finalMermaid = cleaned.replace(/^mermaid\s*[:\n]?/i, '').trim();
    return { diagram: finalMermaid, diagramType: 'mermaid' };
  } else if (type === 'tikz') {
    return { diagram: cleaned, diagramType: 'tikz' };
  } else {
    return { diagram: cleaned, diagramType: 'chemfig' };
  }
}

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

    // If already a single letter A-H
    if (/^[A-H]$/i.test(normalizedCandidate)) {
      const idx = LETTERS.indexOf(normalizedCandidate.toUpperCase());
      if (idx >= 0 && idx < options.length) return LETTERS[idx];
    }

    const letterMatch = normalizedCandidate.match(/^([A-H])\b/i);
    if (letterMatch) {
      const idx = LETTERS.indexOf(letterMatch[1].toUpperCase());
      if (idx >= 0 && idx < options.length) return LETTERS[idx];
    }

    // Exact match against option text
    const exactIdx = options.findIndex((opt) => opt.toLowerCase() === normalizedCandidate.toLowerCase());
    if (exactIdx >= 0) return LETTERS[exactIdx];

    // Partial matches
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

    if (!topic || !questionText) continue;

    const { diagram, diagramType } = parseDiagram(row);

    if (questionType === 'objective') {
      const options = Array.isArray(row.options)
        ? row.options.map((v) => String(v || '').trim()).filter(Boolean)
        : [];

      if (options.length < 2) continue;

      const letter = resolveLetter(options, rawCorrect);
      if (!letter) continue; // invalid if we can't determine a letter

      normalized.push({
        topic,
        question_text: questionText,
        options,
        correct_answer: letter,
        explanation,
        diagram,
        diagram_type: diagramType,
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
      diagram,
      diagram_type: diagramType,
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

    const includeDiagrams = body?.includeDiagrams === true;

    const requestPayload = {
      bankId,
      subjectClassId,
      difficulty,
      questionType,
      count: questionCount,
      topicSetId,
      topics,
      includeDiagrams,
      promptVersion: PROMPT_VERSION,
    };
    const systemParts: string[] = [
      'You are an expert teacher question author.',
      'Return only JSON with shape {"questions": GeneratedQuestion[]}.',
      `GeneratedQuestion fields: topic, question_text, options (string[] for objective), correct_answer (the letter A, B, C, or D for objective, or the model answer string for theory), explanation${includeDiagrams ? ', diagram (string, optional, containing diagram markup/source code), diagram_type ("svg" | "mermaid" | "tikz" | "chemfig", optional, specifying the type of diagram)' : ''}.`,
      'Do not include markdown or extra commentary.',
    ];

    const userParts: string[] = [
      `Generate ${questionCount} ${questionType} questions for subject ${subjectName} and class ${className}.`,
      `Difficulty level: ${difficulty}.`,
      `Topics to cover: ${topics.join(', ')}.`,
      questionType === 'objective'
        ? 'Each objective question must include exactly 4 options. The correct_answer must strictly be only the letter index of the correct option: "A", "B", "C", or "D".'
        : 'For theory questions include a concise model answer in correct_answer and marking guidance in explanation.',
    ];

    if (includeDiagrams) {
      systemParts.splice(
        systemParts.length - 1,
        0,
        `DIAGRAM GENERATION AND LAYOUT PROTOCOLS:
When 'includeDiagrams' is true, evaluate the exact subject area of the target topics to choose the absolute best programmatic rendering type. You must strictly avoid overlapping lines and text collisions by utilizing relative spacing rules.

SUBJECT SELECTION MATRIX:

Geometry / Calculus / Trigonometry / Physics Mechanics -> Use 'tikz'.

Flowcharts / Cycles / Interconnected Biological Systems -> Use 'mermaid'.

Organic Chemistry Structures / Chemical Equation Schemas -> Use 'chemfig'.

Simple Generic Graphic Layouts / Abstract Icons -> Use 'svg'.

STRUCTURAL LAYOUT RULES PER TYPE:

FOR 'tikz':

Always use relative node placements like node[midway, below=3mm] or node[above right=2mm].

NEVER specify an absolute coordinate for text labels directly on top of coordinates.

Keep angle arcs bounded tight and throw text entirely outside using explicit offsets.

FOR 'chemfig':

Use clean relative link structures (e.g., \\chemfig{*6(-=-=-=)}) so bonds pull text automatically without coordinate calculation.

FOR 'svg' (Fallback Only):

Implement mandatory label padding.

For bottom baselines, use a dy shift or push the Y-coordinate at least 15-20px lower than the boundary line.

For side lines, use text-anchor="end" or text-anchor="start" combined with explicit horizontal padding to prevent elements from intersecting lines.

RETURN FORMAT:
Provide the clean raw string source code containing no markdown code block backticks within the main json string field. Assign the exact identifier token ('svg' | 'mermaid' | 'tikz' | 'chemfig') to the 'diagram_type' property.


note: the ai should specify which type it created so it can be easy to reder in the frontend`
      );
      userParts.push('If a question requires a diagram, include a field "diagram" containing the raw layout/rendering code (no markdown backticks or markdown code block wrapper), and a field "diagram_type" specifying the chosen layout format ("svg", "mermaid", "tikz", or "chemfig").');
    }

    userParts.push('Output valid JSON only.');

    const groqResponse = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      temperature: 0.5,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: systemParts.join(' '),
        },
        {
          role: 'user',
          content: userParts.join('\n'),
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
      metadata: Object.assign(
        {
          generatedBy: 'groq',
          model: GROQ_MODEL,
          promptVersion: PROMPT_VERSION,
        },
        question.diagram ? { diagram: question.diagram, diagram_type: question.diagram_type } : {}
      ),
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
        metadata,
        question_type,
        difficulty,
        visibility,
        created_by_teacher_id,
        created_at,
        updated_at
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
