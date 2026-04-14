import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { encryptLiveSessionSecret } from "@/lib/live-session-crypto";
import { parseZoomJoinUrl } from "@/lib/zoom-deeplink";

type TeacherContext = {
  userId: string;
  schoolId: string;
  teacherId: string;
};

type SubjectClassRow = {
  id: string;
  class_id: string;
  school_id: string;
  teacher_id: string | null;
};

async function getTeacherContext(): Promise<TeacherContext | null> {
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
    userId: user.id,
    schoolId,
    teacherId: teacher.id,
  };
}

export async function GET(req: Request) {
  try {
    const context = await getTeacherContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const classId = url.searchParams.get("classId");
    const subjectClassId = url.searchParams.get("subjectClassId");

    const supabase = createRouteHandlerClient({ cookies });
    const { data: assignedSubjects } = await supabase
      .from("subject_classes")
      .select("id")
      .eq("school_id", context.schoolId)
      .eq("teacher_id", context.teacherId);

    const { data: fallbackClasses } = await supabase
      .from("classes")
      .select("id")
      .eq("school_id", context.schoolId)
      .eq("class_teacher_id", context.teacherId);

    const teacherSubjectIds = (assignedSubjects ?? []).map((item: any) => item.id);
    const teacherClassIds = (fallbackClasses ?? []).map((item: any) => item.id);

    let query = supabase
      .from("live_sessions")
      .select("id, title, class_id, subject_class_id, status, scheduled_for, started_at, ended_at, created_at")
      .eq("school_id", context.schoolId)
      .order("created_at", { ascending: false });

    if (classId) {
      query = query.eq("class_id", classId);
    }

    if (subjectClassId) {
      query = query.eq("subject_class_id", subjectClassId);
    }

    const accessFilters: string[] = [`teacher_id.eq.${context.teacherId}`];
    if (teacherClassIds.length > 0) {
      accessFilters.push(`class_id.in.(${teacherClassIds.join(",")})`);
    }
    if (teacherSubjectIds.length > 0) {
      accessFilters.push(`subject_class_id.in.(${teacherSubjectIds.join(",")})`);
    }

    const { data, error } = await query.or(accessFilters.join(","));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await getTeacherContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const classId = String(body.classId || "").trim();
    const subjectClassId = String(body.subjectClassId || "").trim();
    const title = String(body.title || "Live Class").trim();
    const zoomUrl = String(body.zoomUrl || "").trim();
    const scheduledForRaw = body.scheduledFor ? String(body.scheduledFor) : null;

    if (!zoomUrl || (!classId && !subjectClassId)) {
      return NextResponse.json({ error: "zoomUrl and either subjectClassId or classId are required" }, { status: 400 });
    }

    const { meetingId, password, webUrl } = parseZoomJoinUrl(zoomUrl);
    const encryptedPassword = password ? encryptLiveSessionSecret(password) : null;

    const supabase = createRouteHandlerClient({ cookies });

    let resolvedClassId = classId;
    let resolvedSubjectClassId = subjectClassId || null;

    let subjectClassRow: SubjectClassRow | null = null;

    if (resolvedSubjectClassId) {
      const { data: subjectRow, error: subjectError } = await supabase
        .from("subject_classes")
        .select("id, class_id, school_id, teacher_id")
        .eq("id", resolvedSubjectClassId)
        .eq("school_id", context.schoolId)
        .single();

      if (subjectError || !subjectRow) {
        return NextResponse.json({ error: "Subject assignment not found" }, { status: 404 });
      }

      subjectClassRow = subjectRow;
      resolvedClassId = subjectRow.class_id;
    }

    if (!resolvedClassId) {
      return NextResponse.json({ error: "Unable to resolve class for live session" }, { status: 400 });
    }

    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id, school_id, class_teacher_id")
      .eq("id", resolvedClassId)
      .eq("school_id", context.schoolId)
      .single();

    if (classError || !classRow) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const isSubjectTeacher = !!subjectClassRow && subjectClassRow.teacher_id === context.teacherId;
    const isClassTeacher = classRow.class_teacher_id === context.teacherId;

    if (!isSubjectTeacher && !isClassTeacher) {
      return NextResponse.json({ error: "Forbidden: You are not assigned to this timetable subject" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const status = scheduledForRaw ? "scheduled" : "live";

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        school_id: context.schoolId,
        class_id: resolvedClassId,
        subject_class_id: resolvedSubjectClassId,
        teacher_id: context.teacherId,
        title: title || "Live Class",
        zoom_join_url_original: webUrl,
        meeting_id: meetingId,
        meeting_password_encrypted: encryptedPassword,
        scheduled_for: scheduledForRaw,
        started_at: status === "live" ? now : null,
        status,
        created_by_user_id: context.userId,
      })
      .select("id, title, class_id, subject_class_id, status, scheduled_for, started_at, ended_at, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create live session" }, { status: 500 });
  }
}
