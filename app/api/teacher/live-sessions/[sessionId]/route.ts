import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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

    const { data: sessionRow, error: sessionError } = await supabase
      .from("live_sessions")
      .select("id, teacher_id, school_id")
      .eq("id", sessionId)
      .eq("school_id", context.schoolId)
      .single();

    if (sessionError || !sessionRow) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (sessionRow.teacher_id !== context.teacherId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (action === "start") {
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
      .select("id, title, class_id, status, scheduled_for, started_at, ended_at, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update session" }, { status: 500 });
  }
}
