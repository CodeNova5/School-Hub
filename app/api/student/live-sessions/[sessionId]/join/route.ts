import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { decryptLiveSessionSecret } from "@/lib/live-session-crypto";
import { buildZoomJoinLinks } from "@/lib/zoom-deeplink";

async function getStudentContext() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: student } = await supabase
    .from("students")
    .select("id, school_id, class_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student?.school_id || !student.class_id) return null;

  const { data: studentSubjects } = await supabase
    .from("student_subjects")
    .select("subject_class_id")
    .eq("student_id", student.id);

  return {
    schoolId: student.school_id,
    classId: student.class_id,
    subjectClassIds: (studentSubjects ?? []).map((item: any) => item.subject_class_id),
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

    const { data: sessionData, error } = await supabase
      .from("live_sessions")
      .select("id, class_id, school_id, subject_class_id, status, meeting_id, meeting_password_encrypted")
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
