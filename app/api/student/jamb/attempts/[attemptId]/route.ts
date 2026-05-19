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

export async function GET(
  _req: NextRequest,
  { params }: { params: { attemptId: string } }
) {
  try {
    const currentStudent = await getCurrentStudent();
    if ("error" in currentStudent) {
      return NextResponse.json(
        { error: currentStudent.error },
        { status: currentStudent.status }
      );
    }

    const { student } = currentStudent;
    const { attemptId } = params;

    if (!attemptId) {
      return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
    }

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from("jamb_attempts")
      .select("*")
      .eq("id", attemptId)
      .eq("student_id", student.id)
      .eq("school_id", student.school_id)
      .eq("exam_type", "jamb")
      .maybeSingle();

    if (attemptError) {
      return NextResponse.json({ error: attemptError.message }, { status: 500 });
    }

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
    const questionIds = answers.map((answer: any) => answer?.questionId).filter(Boolean);

    const { data: questions, error: questionError } = questionIds.length
      ? await supabaseAdmin
          .from("jamb_questions")
          .select("id, question_text, correct_option, explanation")
          .in("id", questionIds)
      : { data: [], error: null };

    if (questionError) {
      return NextResponse.json({ error: questionError.message }, { status: 500 });
    }

    const questionMap = new Map((questions || []).map((question: any) => [question.id, question]));
    let correctCount = 0;
    let answeredCount = 0;
    const unansweredQuestions: number[] = [];
    const missedQuestions: Array<{
      questionId: string;
      questionNumber: number;
      questionText: string;
      userAnswer: string;
      correctOption: string;
      explanation?: string;
    }> = [];

    const normalizedAnswers = answers.map((answer: any, index: number) => {
      const questionId = answer?.questionId;
      const selectedOption = answer?.selectedOption || null;
      const question = questionMap.get(questionId);
      const correctOption = question?.correct_option || null;
      const isCorrect =
        correctOption &&
        selectedOption &&
        String(selectedOption).toUpperCase() === String(correctOption).toUpperCase();

      if (selectedOption) {
        answeredCount += 1;
      } else {
        unansweredQuestions.push(index + 1);
      }

      if (isCorrect) {
        correctCount += 1;
      } else if (selectedOption && question) {
        missedQuestions.push({
          questionId,
          questionNumber: index + 1,
          questionText: question.question_text,
          userAnswer: selectedOption,
          correctOption,
          explanation: question.explanation,
        });
      }

      return {
        questionId,
        selectedOption,
        correctOption,
      };
    });

    const totalQuestions = Number(attempt.total_questions || answers.length || 0);
    const score = Number(attempt.score || 0);

    const { data: previousAttempt } = await supabaseAdmin
      .from("jamb_attempts")
      .select("score, correct_count, total_questions")
      .eq("student_id", student.id)
      .eq("school_id", student.school_id)
      .eq("subject_slug", attempt.subject_slug)
      .eq("exam_year", attempt.exam_year)
      .eq("exam_type", "jamb")
      .lt("created_at", attempt.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      data: {
        attempt: {
          ...attempt,
          answers: normalizedAnswers,
        },
        attemptId: attempt.id,
        subjectSlug: attempt.subject_slug,
        subjectName: attempt.subject_name,
        examYear: attempt.exam_year,
        correctCount,
        totalQuestions,
        score,
        answeredCount,
        unansweredCount: Math.max(totalQuestions - answeredCount, 0),
        missedCount: missedQuestions.length,
        unansweredQuestions,
        missedQuestions,
        previousAttempt: previousAttempt || null,
      },
    });
  } catch (error: any) {
    console.error("[student/jamb/attempts/[attemptId]] error", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Failed to load attempt" },
      { status: 500 }
    );
  }
}