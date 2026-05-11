import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentStudent() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("id, school_id")
    .eq("user_id", user.id)
    .single();

  if (error || !student) {
    return { error: "Student profile not found", status: 404 };
  }

  return { student, userId: user.id };
}

export async function POST(req: NextRequest) {
  const currentStudent = await getCurrentStudent();
  if ("error" in currentStudent) {
    return NextResponse.json(
      { error: currentStudent.error },
      { status: currentStudent.status }
    );
  }

  const { student, userId } = currentStudent;
  const body = await req.json();
  const { subjectSlug, subjectName, examYear, topic, answers, totalQuestions } = body;

  if (!subjectSlug || !subjectName || !examYear || !Array.isArray(answers)) {
    return NextResponse.json(
      { error: "subjectSlug, subjectName, examYear and answers are required" },
      { status: 400 }
    );
  }

  const { data: access } = await supabaseAdmin
    .from("jamb_student_access")
    .select("id")
    .eq("student_id", student.id)
    .eq("school_id", student.school_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!access) {
    return NextResponse.json({ error: "JAMB CBT access not granted" }, { status: 403 });
  }

  const questionIds = answers.map((answer: any) => answer.questionId).filter(Boolean);
  if (questionIds.length === 0) {
    return NextResponse.json({ error: "No answers were submitted" }, { status: 400 });
  }

  const { data: questions, error: questionError } = await supabaseAdmin
    .from("jamb_questions")
    .select("id, correct_option, question_text, options, explanation")
    .in("id", questionIds);

  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 });
  }

  const questionMap = new Map((questions || []).map((question: any) => [question.id, question.correct_option]));
  let correctCount = 0;
  const missedQuestions: any[] = [];
  const unansweredQuestions: any[] = [];
  let answeredCount = 0;

  const normalizedAnswers = answers.map((answer: any, index: number) => {
    const questionId = answer.questionId;
    const selectedOption = answer.selectedOption || null;
    const question = (questions || []).find((q: any) => q.id === questionId);
    const correctOption = question?.correct_option || null;
    const isCorrect = correctOption && selectedOption && String(selectedOption).toUpperCase() === String(correctOption).toUpperCase();

    if (isCorrect) {
      correctCount += 1;
    }

    if (selectedOption) {
      answeredCount += 1;
      if (!isCorrect && question) {
        missedQuestions.push({
          questionId,
          questionNumber: index + 1,
          questionText: question.question_text,
          userAnswer: selectedOption,
          correctAnswer: correctOption,
          explanation: question.explanation,
        });
      }
    } else {
      unansweredQuestions.push({
        questionId,
        questionNumber: index + 1,
      });
    }

    return {
      questionId,
      selectedOption,
      correctOption,
    };
  });

  const submittedTotal = questionIds.length;
  const providedTotal = Number(totalQuestions || 0);
  const normalizedTotal = Number.isFinite(providedTotal) && providedTotal >= submittedTotal
    ? providedTotal
    : submittedTotal;
  const score = normalizedTotal > 0 ? Number(((correctCount / normalizedTotal) * 100).toFixed(2)) : 0;

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from("jamb_attempts")
    .insert({
      school_id: student.school_id,
      student_id: student.id,
      subject_slug: subjectSlug,
      subject_name: subjectName,
      exam_type: "jamb",
      exam_year: Number(examYear),
      topic: topic || null,
      total_questions: normalizedTotal,
      correct_count: correctCount,
      score,
      answers: normalizedAnswers,
    })
    .select()
    .single();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      attempt,
      correctCount,
      totalQuestions: normalizedTotal,
      score,
      answeredCount,
      unansweredCount: Math.max(normalizedTotal - answeredCount, 0),
      missedCount: missedQuestions.length,
      unansweredQuestions: unansweredQuestions.map((q) => q.questionNumber),
      missedQuestions,
      userId,
    },
  });
}