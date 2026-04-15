import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

async function autoCloseExpiredSessions(supabase: any, schoolId: string) {
  const nowIso = new Date().toISOString();

  const { data: expiredRows } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("school_id", schoolId)
    .in("status", ["scheduled", "live"])
    .not("scheduled_end_at", "is", null)
    .lte("scheduled_end_at", nowIso);

  if (!expiredRows || expiredRows.length === 0) {
    return;
  }

  await supabase
    .from("live_sessions")
    .update({
      status: "ended",
      ended_at: nowIso,
      updated_at: nowIso,
    })
    .in("id", expiredRows.map((row: any) => row.id))
    .eq("school_id", schoolId);
}

async function getTeacherContext() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: schoolId } = await supabase.rpc("get_my_school_id");
  if (!schoolId) return null;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!teacher) return null;

  return {
    schoolId,
    teacherId: teacher.id,
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const context = await getTeacherContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = params.sessionId;
    const body = await req.json();
    const action = String(body.action || "").trim();

    if (!sessionId || !["start", "end", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    await autoCloseExpiredSessions(supabase, context.schoolId);

    const { data: sessionRow, error: sessionError } = await supabase
      .from("live_sessions")
      .select("id, teacher_id, school_id, class_id, subject_class_id, scheduled_for, scheduled_end_at")
      .eq("id", sessionId)
      .eq("school_id", context.schoolId)
      .single();

    if (sessionError || !sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: classRow } = await supabase
      .from("classes")
      .select("id, class_teacher_id")
      .eq("id", sessionRow.class_id)
      .eq("school_id", context.schoolId)
      .maybeSingle();

    let isSubjectTeacher = false;
    if (sessionRow.subject_class_id) {
      const { data: subjectClassRow } = await supabase
        .from("subject_classes")
        .select("id, teacher_id")
        .eq("id", sessionRow.subject_class_id)
        .eq("school_id", context.schoolId)
        .maybeSingle();
      isSubjectTeacher = subjectClassRow?.teacher_id === context.teacherId;
    }

    const isClassTeacher = classRow?.class_teacher_id === context.teacherId;
    const isSessionOwner = sessionRow.teacher_id === context.teacherId;

    if (!isSessionOwner && !isSubjectTeacher && !isClassTeacher) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (action === "start") {
      const now = Date.now();
      const windowStart = sessionRow.scheduled_for ? new Date(sessionRow.scheduled_for).getTime() : null;
      const windowEnd = sessionRow.scheduled_end_at ? new Date(sessionRow.scheduled_end_at).getTime() : null;

      if (windowStart && now < windowStart) {
        return NextResponse.json({ error: "This session cannot start before its scheduled time" }, { status: 400 });
      }

      if (windowEnd && now >= windowEnd) {
        return NextResponse.json({ error: "This period has ended. Create a new live class or extend duration." }, { status: 400 });
      }

      updates.status = "live";
      updates.started_at = new Date().toISOString();
    }

    if (action === "end") {
      updates.status = "ended";
      updates.ended_at = new Date().toISOString();
    }

    if (action === "cancel") {
      updates.status = "cancelled";
      updates.ended_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("live_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("school_id", context.schoolId)
      .select("id, title, class_id, subject_class_id, status, scheduled_for, scheduled_end_at, started_at, ended_at, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update session" }, { status: 500 });
  }
}
