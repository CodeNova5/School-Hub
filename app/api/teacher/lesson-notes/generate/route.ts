import { NextRequest, NextResponse } from 'next/server';
import { getTeacherQuestionBankContext, parseGroqJsonPayload } from '@/lib/teacher-question-bank/server';
import { fetchGroqChatCompletion } from '@/lib/ai-assistant/groq-client';

export const dynamic = 'force-dynamic';

const GROQ_MODEL = process.env.LESSON_NOTE_MODEL || 'openai/gpt-oss-20b';

export async function POST(request: NextRequest) {
  const ctxResult = await getTeacherQuestionBankContext();
  if (!ctxResult.ok) {
    return NextResponse.json({ error: ctxResult.error }, { status: ctxResult.status });
  }

  const { supabase, teacherId, schoolId } = ctxResult.context;

  try {
    const body = await request.json();
    const subjectClassId = String(body?.subjectClassId || '').trim();
    const topic = String(body?.topic || '').trim();
    const classLevel = String(body?.classLevel || '').trim();
    const subjectName = String(body?.subjectName || '').trim();
    const className = String(body?.className || '').trim();

    if (!subjectClassId || !topic) {
      return NextResponse.json({ error: 'subjectClassId and topic are required' }, { status: 400 });
    }

    // Build a rich prompt for the AI to generate a comprehensive lesson note
    const systemPrompt = [
      'You are an expert Nigerian secondary school teacher creating detailed lesson notes.',
      'You must return ONLY valid JSON with this exact structure:',
      JSON.stringify({
        title: 'Lesson title string',
        topic: 'The topic',
        subject: 'Subject name',
        class: 'Class name',
        duration: 'Recommended lesson duration e.g. 40 minutes',
        objectives: ['Objective 1', 'Objective 2', 'Objective 3'],
        instructional_materials: ['Material 1', 'Material 2'],
        previous_knowledge: 'What students are expected to already know',
        introduction: 'Engaging introduction to capture student interest',
        content: 'The main lesson content. Use markdown with paragraphs, bullet lists, numbered lists, tables, bold text, and code blocks as appropriate. Make it comprehensive and detailed.',
        evaluation: ['Question 1', 'Question 2', 'Question 3'],
        conclusion: 'Brief summary and connection to next lesson',
        assignment: 'Homework or take-home task',
        summary: 'One-paragraph summary of the entire lesson',
      }),
      'Fill every field with substantial, curriculum-appropriate content for the given topic.',
      'The "content" field should be the most detailed - use markdown formatting with headings (###), bullet lists, numbered steps, and tables where appropriate.',
      'Make the lesson note practical and engaging for students.',
      'Follow the Nigerian curriculum standard.',
      'No markdown outside the JSON structure. Return ONLY valid JSON.',
    ].join('\n');

    const userPrompt = [
      `Create a comprehensive lesson note for:`,
      `Subject: ${subjectName || 'the subject'}`,
      `Class: ${className || 'the class'}`,
      `Class Level: ${classLevel || 'the appropriate level'}`,
      `Topic: ${topic}`,
      '',
      'Include objectives, instructional materials, previous knowledge, introduction, detailed content, evaluation questions, conclusion, and assignment.',
      'The content section must be thorough with multiple teaching points, examples, and illustrations.',
    ].join('\n');

    const response = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    if (!response.ok) {
      return NextResponse.json({ error: response.error }, { status: response.status || 400 });
    }

    const raw = response.data?.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'No content generated' }, { status: 500 });
    }

    // Parse the generated JSON
    let lessonNote: Record<string, unknown>;
    try {
      lessonNote = JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim());
    } catch {
      // Attempt repair via existing utility
      const parsed = parseGroqJsonPayload(raw);
      if (!parsed) {
        return NextResponse.json({ error: 'Failed to parse generated lesson note' }, { status: 500 });
      }
      lessonNote = parsed;
    }

    // Normalize and validate the generated content
    const normalized = {
      title: String(lessonNote.title || topic || '').trim(),
      topic: topic,
      subject: String(lessonNote.subject || subjectName || '').trim(),
      class: String(lessonNote.class || className || '').trim(),
      duration: String(lessonNote.duration || '40 minutes').trim(),
      objectives: Array.isArray(lessonNote.objectives)
        ? lessonNote.objectives.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
        : [],
      instructional_materials: Array.isArray(lessonNote.instructional_materials)
        ? lessonNote.instructional_materials.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
        : [],
      previous_knowledge: String(lessonNote.previous_knowledge || '').trim(),
      introduction: String(lessonNote.introduction || '').trim(),
      content: String(lessonNote.content || '').trim(),
      evaluation: Array.isArray(lessonNote.evaluation)
        ? lessonNote.evaluation.filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
        : [],
      conclusion: String(lessonNote.conclusion || '').trim(),
      assignment: String(lessonNote.assignment || '').trim(),
      summary: String(lessonNote.summary || '').trim(),
    };

    return NextResponse.json({
      success: true,
      lessonNote: normalized,
    });
  } catch (error) {
    console.error('Lesson note generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
