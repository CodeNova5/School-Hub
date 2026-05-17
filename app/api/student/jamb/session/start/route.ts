import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

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

/**
 * GET /api/student/jamb/session/start
 * Starts a new exam session or returns existing active session
 * Query params: subject_slug, exam_year
 */
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
    const subjectSlug = url.searchParams.get("subject_slug");
    const examYear = url.searchParams.get("exam_year");

    if (!subjectSlug || !examYear) {
      return NextResponse.json(
        { error: "subject_slug and exam_year are required" },
        { status: 400 }
      );
    }

    // Check JAMB access
    const { data: access } = await supabaseAdmin
      .from("jamb_student_access")
      .select("id")
      .eq("student_id", student.id)
      .eq("school_id", student.school_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!access) {
      return NextResponse.json(
        { error: "JAMB CBT access not granted" },
        { status: 403 }
      );
    }

    // Get or create exam session
    // First, cancel any other active sessions for this student
    await supabaseAdmin
      .from("jamb_exam_sessions")
      .update({ status: "cancelled" })
      .eq("student_id", student.id)
      .eq("school_id", student.school_id)
      .eq("status", "active")
      .not("subject_slug", "eq", subjectSlug)
      .or(`exam_year.neq.${examYear}`);

    // Check for existing active session
    const { data: existingSession } = await supabaseAdmin
      .from("jamb_exam_sessions")
      .select("*")
      .eq("student_id", student.id)
      .eq("school_id", student.school_id)
      .eq("subject_slug", subjectSlug)
      .eq("exam_year", Number(examYear))
      .eq("status", "active")
      .single();

    if (existingSession) {
      // Return existing session
      const serverNow = new Date();
      const startedAt = new Date(existingSession.started_at);
      const expiresAt = new Date(existingSession.expires_at);
      const elapsedSeconds = Math.floor(
        (serverNow.getTime() - startedAt.getTime()) / 1000
      );
      const remainingSeconds = Math.max(
        0,
        Math.floor((expiresAt.getTime() - serverNow.getTime()) / 1000)
      );
      const isExpired = remainingSeconds <= 0;

      return NextResponse.json({
        data: {
          sessionId: existingSession.id,
          sessionToken: existingSession.session_token,
          startedAt: existingSession.started_at,
          durationSeconds: existingSession.duration_minutes * 60,
          elapsedSeconds,
          remainingSeconds,
          isExpired,
          isResume: true,
          serverTime: serverNow.toISOString(),
        },
      });
    }

    // Create new session
    const sessionToken = randomBytes(32).toString("hex");

    // Get duration from jamb_subjects table
    let durationMinutes = 40;
    try {
      const { data: subjectData } = await supabaseAdmin
        .from("jamb_subjects")
        .select("duration_minutes")
        .eq("slug", subjectSlug)
        .single();

      if (subjectData?.duration_minutes) {
        durationMinutes = subjectData.duration_minutes;
      }
    } catch (e) {
      // Fallback to default if query fails
    }

    const serverNow = new Date();
    const { data: newSession, error: sessionError } = await supabaseAdmin
      .from("jamb_exam_sessions")
      .insert([
        {
          student_id: student.id,
          school_id: student.school_id,
          subject_slug: subjectSlug,
          exam_year: Number(examYear),
          duration_minutes: durationMinutes,
          session_token: sessionToken,
          started_at: serverNow.toISOString(),
          status: "active",
        },
      ])
      .select()
      .single();

    if (sessionError || !newSession) {
      return NextResponse.json(
        { error: "Failed to create exam session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        sessionId: newSession.id,
        sessionToken: newSession.session_token,
        startedAt: newSession.started_at,
        durationSeconds: durationMinutes * 60,
        elapsedSeconds: 0,
        remainingSeconds: durationMinutes * 60,
        isExpired: false,
        isResume: false,
        serverTime: serverNow.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("Session start error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start session" },
      { status: 500 }
    );
  }
}
