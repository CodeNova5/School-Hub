import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCurrentStudent() {
  const supabase = await createServerSupabaseClient();
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

export async function GET(req: NextRequest) {
  try {
    const currentStudent = await getCurrentStudent();
    if ("error" in currentStudent) {
      return NextResponse.json(
        { error: currentStudent.error },
        { status: currentStudent.status }
      );
    }

    const { student } = currentStudent;
    const url = new URL(req.url);
    const subject = url.searchParams.get("subject") || "";
    const year = url.searchParams.get("year") || "";
    const topic = url.searchParams.get("topic") || "";

    if (!subject || !year) {
      return NextResponse.json(
        { error: "subject and year are required" },
        { status: 400 }
      );
    }

    // Query for most recent attempt before the current one
    const { data: previousAttempts, error } = await supabaseAdmin
      .from("jamb_attempts")
      .select("score, correct_count, total_questions")
      .eq("student_id", student.id)
      .eq("school_id", student.school_id)
      .eq("subject_slug", subject)
      .eq("exam_year", Number(year))
      .eq("topic", topic || null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const previousAttempt = previousAttempts?.[0];

    if (!previousAttempt) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({
      data: {
        score: previousAttempt.score,
        correctCount: previousAttempt.correct_count,
        totalQuestions: previousAttempt.total_questions,
      },
    });
  } catch (error: any) {
    console.error("[student/jamb/previous-attempt] error", {
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: error?.message || "Failed to load previous attempt" },
      { status: 500 }
    );
  }
}
