import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { decryptLiveSessionSecret } from "@/lib/live-session-crypto";
import { buildZoomJoinLinks } from "@/lib/zoom-deeplink";

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

async function getStudentContext() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: student } = await supabase
    .from("students")
    .select("id, school_id, class_id, department_id, religion_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student?.school_id || !student.class_id) return null;

  // Get required subjects for this student based on subject_classes filters
  const { data: subjectClasses } = await supabase
    .from("subject_classes")
    .select("id")
    .eq("class_id", student.class_id)
    .eq("school_id", student.school_id)
    .eq("is_optional", false);

  // Filter subjects based on student's department and religion
  const validSubjectIds: string[] = [];
  if (subjectClasses) {
    for (const sc of subjectClasses) {
      const { data: subjectData } = await supabase
        .from("subject_classes")
        .select("department_id, religion_id")
        .eq("id", sc.id)
        .single();

      if (subjectData) {
        // Include if no department filter or student matches
        if (!subjectData.department_id || subjectData.department_id === student.department_id) {
          // Include if no religion filter or student matches
          if (!subjectData.religion_id || subjectData.religion_id === student.religion_id) {
            validSubjectIds.push(sc.id);
          }
        }
      }
    }
  }

  return {
    schoolId: student.school_id,
    classId: student.class_id,
    subjectClassIds: validSubjectIds,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const context = await getStudentContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    await autoCloseExpiredSessions(supabase, context.schoolId);

    const { data: sessionData, error } = await supabase
      .from("live_sessions")
      .select("id, class_id, school_id, subject_class_id, status, scheduled_end_at, meeting_id, meeting_password_encrypted")
      .eq("id", params.sessionId)
      .eq("school_id", context.schoolId)
      .eq("class_id", context.classId)
      .in("status", ["scheduled", "live"])
      .single();

    if (error || !sessionData) {
      return NextResponse.json({ error: "Live session not found" }, { status: 404 });
    }

    if (
      sessionData.subject_class_id &&
      !context.subjectClassIds.includes(sessionData.subject_class_id)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const decryptedPassword = decryptLiveSessionSecret(sessionData.meeting_password_encrypted);
    const links = buildZoomJoinLinks(sessionData.meeting_id, decryptedPassword);

    return NextResponse.json({
      data: {
        sessionId: sessionData.id,
        links,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to build join link" }, { status: 500 });
  }
}
