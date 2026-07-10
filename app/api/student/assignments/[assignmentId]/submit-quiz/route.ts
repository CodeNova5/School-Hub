import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/* -------------------------------------------------------------------------- */
/* POST /api/student/assignments/[assignmentId]/submit-quiz                    */
/* -------------------------------------------------------------------------- */

export async function POST(
  req: NextRequest,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const { assignmentId } = params;

    // ── 1. Authenticate ──
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // ── 2. Look up student profile ──
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, school_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const { id: studentId, school_id: schoolId } = student;

    // ── 3. Parse request body ──
    const body = await req.json();
    const { answers, started_at } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Answers are required and must be a valid object" },
        { status: 400 }
      );
    }

    // ── 4. Validate assignment exists and is objective type ──
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, school_id, total_marks, submission_type, due_date, allow_late_submission")
      .eq("id", assignmentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (assignment.submission_type !== "objective") {
      return NextResponse.json(
        { error: "This assignment does not support quiz submission" },
        { status: 400 }
      );
    }

    // ── 5. Load quiz config ──
    const { data: quizConfig } = await supabaseAdmin
      .from("assignment_quiz_config")
      .select("time_limit_minutes, allow_retake")
      .eq("assignment_id", assignmentId)
      .maybeSingle();

    // ── 6. Check if retake is allowed (or if this is the first submission) ──
    if (!quizConfig?.allow_retake) {
      const { data: existingSubmission } = await supabaseAdmin
        .from("assignment_submissions")
        .select("id")
        .eq("assignment_id", assignmentId)
        .eq("student_id", studentId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (existingSubmission) {
        return NextResponse.json(
          { error: "You have already submitted this quiz and retakes are not allowed" },
          { status: 403 }
        );
      }
    }

    // ── 7. Load quiz questions with correct answers ──
    const { data: quizQuestions } = await supabaseAdmin
      .from("assignment_quiz_questions")
      .select("question_id, marks, display_order")
      .eq("assignment_id", assignmentId)
      .order("display_order", { ascending: true });

    if (!quizQuestions || quizQuestions.length === 0) {
      return NextResponse.json(
        { error: "This quiz has no questions" },
        { status: 400 }
      );
    }

    const questionIds = quizQuestions.map((q) => q.question_id);

    const { data: teacherQuestions } = await supabaseAdmin
      .from("teacher_questions")
      .select("id, correct_answer, options, explanation")
      .in("id", questionIds);

    if (!teacherQuestions || teacherQuestions.length === 0) {
      return NextResponse.json(
        { error: "Quiz questions not found in the question bank" },
        { status: 404 }
      );
    }

    // Build a map of question_id -> correct_answer (converted from value to label)
    const correctAnswerMap = new Map<string, string>();
    teacherQuestions.forEach((tq: any) => {
      const options: string[] = tq.options || [];
      const correctValue: string = tq.correct_answer || "";
      const correctIdx = options.findIndex(
        (opt: string) => opt.toUpperCase() === correctValue.toUpperCase()
      );
      const correctLabel = correctIdx >= 0
        ? String.fromCharCode(65 + correctIdx)
        : correctValue;
      correctAnswerMap.set(tq.id, correctLabel);
    });

    const marksMap = new Map<string, number>(
      quizQuestions.map((q) => [q.question_id, q.marks])
    );

    // ── 8. Grade the answers server-side ──
    let correctCount = 0;
    const totalQuestions = quizQuestions.length;
    const answerDetails: Record<string, { selected: string; correct: string; isCorrect: boolean }> = {};

    for (const q of quizQuestions) {
      const selected = (answers[q.question_id] || "").trim();
      const correct = correctAnswerMap.get(q.question_id) || "";
      const isCorrect = selected.toUpperCase() === correct.toUpperCase();
      if (isCorrect) correctCount++;
      answerDetails[q.question_id] = { selected, correct, isCorrect };
    }

    const totalMarks = quizQuestions.reduce((sum, q) => sum + q.marks, 0);
    const autoScore = totalQuestions > 0
      ? Math.round((correctCount / totalQuestions) * totalMarks)
      : 0;

    // ── 9. Determine if submitted on time ──
    const dueDate = new Date(assignment.due_date);
    const now = new Date();
    const submittedOnTime = assignment.allow_late_submission || now <= dueDate;

    // ── 10. Save the submission ──
    const submissionPayload: any = {
      assignment_id: assignmentId,
      student_id: studentId,
      school_id: schoolId,
      answers,
      auto_score: autoScore,
      auto_graded_at: now.toISOString(),
      submitted_at: now.toISOString(),
      submitted_on_time: submittedOnTime,
    };

    if (started_at) {
      submissionPayload.started_at = started_at;
    }

    // If there's an existing submission (retake), update it; otherwise insert
    const { error: upsertError } = await supabaseAdmin
      .from("assignment_submissions")
      .upsert(submissionPayload, { onConflict: "assignment_submissions_assignment_id_student_id_key" });

    if (upsertError) {
      console.error("[submit-quiz] Upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save submission" },
        { status: 500 }
      );
    }

    // ── 11. Fetch the saved submission to return ──
    const { data: savedSubmission } = await supabaseAdmin
      .from("assignment_submissions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    // ── 12. Return result ──
    return NextResponse.json({
      data: {
        submission: savedSubmission,
        result: {
          score: autoScore,
          totalMarks,
          correctCount,
          totalQuestions,
          percentage: totalMarks > 0
            ? Math.round((autoScore / totalMarks) * 100)
            : 0,
        },
        details: answerDetails,
      },
    });
  } catch (error: any) {
    console.error("[submit-quiz] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
