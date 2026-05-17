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

/**
 * POST /api/student/jamb/session/validate
 * Validates session and marks it as submitted
 * Enforces time limit and prevents resubmission
 */
export async function POST(req: NextRequest) {
  try {
    const currentStudent = await getCurrentStudent();
    if ("error" in currentStudent) {
      return NextResponse.json(
        { error: currentStudent.error },
        { status: currentStudent.status }
      );
    }

    const { student } = currentStudent;
    const body = await req.json();
    const { sessionToken, elapsedSeconds } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: "sessionToken is required" },
        { status: 400 }
      );
    }

    if (typeof elapsedSeconds !== "number" || elapsedSeconds < 0) {
      return NextResponse.json(
        { error: "elapsedSeconds must be a non-negative number" },
        { status: 400 }
      );
    }

    // Get the session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("jamb_exam_sessions")
      .select("*")
      .eq("session_token", sessionToken)
      .eq("student_id", student.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Invalid or expired session token" },
        { status: 403 }
      );
    }

    // Check if already submitted
    if (session.status === "submitted") {
      return NextResponse.json(
        { error: "Attempt already submitted for this session" },
        { status: 409 }
      );
    }

    // Check if session is still active
    if (session.status !== "active") {
      return NextResponse.json(
        { error: `Session is ${session.status}` },
        { status: 410 }
      );
    }

    // Validate timing
    const serverNow = new Date();
    const startedAt = new Date(session.started_at);
    const expiresAt = new Date(session.expires_at);
    const maxDurationSeconds = session.duration_minutes * 60;

    // Server-calculated elapsed time
    const serverElapsedSeconds = Math.floor(
      (serverNow.getTime() - startedAt.getTime()) / 1000
    );

    // Check if expired on server (with 5-second tolerance for network latency)
    if (serverElapsedSeconds > maxDurationSeconds + 5) {
      // Mark as expired
      await supabaseAdmin
        .from("jamb_exam_sessions")
        .update({ status: "expired", submitted_at: serverNow.toISOString() })
        .eq("id", session.id);

      return NextResponse.json(
        { error: "Exam time has expired" },
        { status: 408 }
      );
    }

    // Log the client-server time offset
    const clientServerOffset = elapsedSeconds - serverElapsedSeconds;
    
    // If client claims less time elapsed than server, that's suspicious but we allow it
    // If client claims MORE time elapsed, reject (tampering attempt)
    const timeTamperingThreshold = 30; // 30 second threshold
    if (clientServerOffset > timeTamperingThreshold) {
      console.warn(
        `[SUSPICIOUS] Student ${student.id} claimed ${elapsedSeconds}s elapsed, server calculated ${serverElapsedSeconds}s (offset: ${clientServerOffset}s)`
      );
      // We could reject here, but for now we'll proceed and log it
    }

    // Mark session as submitted
    const { error: updateError } = await supabaseAdmin
      .from("jamb_exam_sessions")
      .update({
        status: "submitted",
        submitted_at: serverNow.toISOString(),
        client_clock_offset_ms: (clientServerOffset * 1000),
      })
      .eq("id", session.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to mark session as submitted" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        valid: true,
        sessionId: session.id,
        serverElapsedSeconds,
        maxDurationSeconds,
        withinTimeLimit: serverElapsedSeconds <= maxDurationSeconds,
      },
    });
  } catch (error: any) {
    console.error("Session validation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to validate session" },
      { status: 500 }
    );
  }
}
