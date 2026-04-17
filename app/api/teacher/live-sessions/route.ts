import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { encryptLiveSessionSecret } from "@/lib/live-session-crypto";
import { parseZoomJoinUrl } from "@/lib/zoom-deeplink";
import { createClient } from "@supabase/supabase-js";
import { initializeAdminSDK, sendNotificationsToMultiple } from "@/lib/firebase-admin";
import { deactivateToken } from "@/lib/notification-utils";

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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  const expiredIds = expiredRows.map((row: any) => row.id);

  await supabase
    .from("live_sessions")
    .update({
      status: "ended",
      ended_at: nowIso,
      updated_at: nowIso,
    })
    .in("id", expiredIds)
    .eq("school_id", schoolId);
}

async function notifyStudentsForLiveClassCreation(params: {
  schoolId: string;
  classId: string | null;
  subjectClassId: string | null;
  sessionId: string;
  title: string;
  body: string;
  sentBy: string;
}) {
  const logPrefix = `[NOTIFICATION] SessionId: ${params.sessionId}`;
  console.log(`${logPrefix} [START] Notification process initiated`);
  console.log(`${logPrefix} Target: ${params.subjectClassId ? 'Subject' : 'Class'} | Title: "${params.title}"`);

  let studentIds: string[] = [];

  // For timetable subjects: get enrolled students
  if (params.subjectClassId) {
    console.log(`${logPrefix} [STEP 1] Fetching enrolled students for subject: ${params.subjectClassId}`);
    const { data: enrolledRows, error: enrolledError } = await supabaseAdmin
      .from("student_subjects")
      .select("student_id")
      .eq("subject_class_id", params.subjectClassId);

    if (enrolledError) {
      console.error(`${logPrefix} [ERROR] Failed to fetch enrolled students:`, enrolledError);
      return;
    }

    if (!enrolledRows || enrolledRows.length === 0) {
      console.warn(`${logPrefix} [WARNING] No enrolled students found for this subject`);
      return;
    }

    studentIds = enrolledRows.map((row: any) => row.student_id);
    console.log(`${logPrefix} [STEP 1] Found ${studentIds.length} enrolled students`);
  } 
  // For custom classes: get all students in the class
  else if (params.classId) {
    console.log(`${logPrefix} [STEP 1] Fetching students for class: ${params.classId}`);
    const { data: classStudentRows, error: classStudentError } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("class_id", params.classId)
      .eq("school_id", params.schoolId);

    if (classStudentError) {
      console.error(`${logPrefix} [ERROR] Failed to fetch class students:`, classStudentError);
      return;
    }

    if (!classStudentRows || classStudentRows.length === 0) {
      console.warn(`${logPrefix} [WARNING] No students found in this class`);
      return;
    }

    studentIds = classStudentRows.map((row: any) => row.id);
    console.log(`${logPrefix} [STEP 1] Found ${studentIds.length} students in class`);
  } 
  else {
    console.warn(`${logPrefix} [WARNING] No class or subject ID provided`);
    return;
  }

  console.log(`${logPrefix} [STEP 2] Fetching user IDs for ${studentIds.length} students`);
  const { data: studentRows, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, user_id")
    .eq("school_id", params.schoolId)
    .in("id", studentIds)
    .not("user_id", "is", null);

  if (studentsError) {
    console.error(`${logPrefix} [ERROR] Failed to fetch student user IDs:`, studentsError);
    return;
  }

  if (!studentRows || studentRows.length === 0) {
    console.warn(`${logPrefix} [WARNING] No students with valid user IDs found`);
    return;
  }

  console.log(`${logPrefix} [STEP 2] Found ${studentRows.length} students with valid user IDs`);

  const recipientUserIds = Array.from(new Set(studentRows.map((row: any) => row.user_id)));
  console.log(`${logPrefix} [STEP 3] Found ${recipientUserIds.length} unique user IDs to notify`);

  console.log(`${logPrefix} [STEP 4] Fetching notification tokens for ${recipientUserIds.length} users`);
  const { data: tokenRows } = await supabaseAdmin
    .from("notification_tokens")
    .select("token, user_id")
    .eq("school_id", params.schoolId)
    .eq("is_active", true)
    .in("user_id", recipientUserIds);

  const tokens = tokenRows?.map((row: any) => row.token) || [];
  const tokenUserSet = new Set((tokenRows || []).map((row: any) => row.user_id));

  console.log(`${logPrefix} [STEP 4] Found ${tokens.length} active notification tokens`);
  console.log(`${logPrefix} [STEP 4] Users with tokens: ${tokenUserSet.size} / ${recipientUserIds.length}`);

  if (tokens.length === 0) {
    console.warn(`${logPrefix} [WARNING] No active notification tokens found - skipping Firebase send`);
  } else {
    try {
      console.log(`${logPrefix} [STEP 5] Initializing Firebase Admin SDK`);
      initializeAdminSDK();
      
      const notificationData: any = {
        type: "live_class",
        link: "/student/live-classes",
        liveSessionId: params.sessionId,
      };
      if (params.subjectClassId) {
        notificationData.subjectClassId = params.subjectClassId;
      }
      
      console.log(`${logPrefix} [STEP 6] Sending ${tokens.length} notifications via Firebase...`);
      const sendResult = await sendNotificationsToMultiple(
        tokens,
        {
          title: params.title,
          body: params.body,
        },
        notificationData
      );

      console.log(`${logPrefix} [STEP 6] Firebase send completed`);
      console.log(`${logPrefix} [RESULT] Success: ${sendResult.successCount || tokens.length - (sendResult.failedTokens?.length || 0)} | Failed: ${sendResult.failedTokens?.length || 0}`);

      if (sendResult.failedTokens?.length) {
        console.log(`${logPrefix} [CLEANUP] Deactivating ${sendResult.failedTokens.length} failed tokens`);
        for (const token of sendResult.failedTokens) {
          await deactivateToken(token);
        }
        console.log(`${logPrefix} [CLEANUP] Failed tokens deactivated`);
      }
    } catch (error) {
      console.error(`${logPrefix} [ERROR] Firebase notification failed:`, error);
    }
  }

  console.log(`${logPrefix} [STEP 7] Creating notification logs for database`);
  const logs = recipientUserIds.map((userId) => ({
    title: params.title,
    body: params.body,
    link: "/student/live-classes",
    target: "user",
    target_value: userId,
    target_name: params.subjectClassId ? "Subject Live Class" : "Class Live Class",
    success_count: tokenUserSet.has(userId) ? 1 : 0,
    failure_count: tokenUserSet.has(userId) ? 0 : 1,
    total_recipients: 1,
    sent_by: params.sentBy,
    school_id: params.schoolId,
    created_at: new Date().toISOString(),
    metadata: {
      source: "live_class",
      live_session_id: params.sessionId,
      subject_class_id: params.subjectClassId,
      class_id: params.classId,
      total_students_targeted: studentIds.length,
      total_tokens_used: tokens.length,
    },
  }));

  console.log(`${logPrefix} [STEP 7] Inserting ${logs.length} notification logs into database`);
  if (logs.length > 0) {
    const { error: logError } = await supabaseAdmin
      .from("notification_logs")
      .insert(logs);

    if (logError) {
      console.error(`${logPrefix} [ERROR] Failed to insert logs:`, logError);
    } else {
      console.log(`${logPrefix} [SUCCESS] Notification logs saved to database`);
    }
  }

  console.log(`${logPrefix} [COMPLETE] Notification process finished ✓`);
}

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
    await autoCloseExpiredSessions(supabase, context.schoolId);
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
      .select("id, title, class_id, subject_class_id, status, scheduled_for, scheduled_end_at, started_at, ended_at, created_at")
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
    const scheduledEndRaw = body.scheduledEndAt ? String(body.scheduledEndAt) : null;

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
    const scheduledStartIso = scheduledForRaw ? new Date(scheduledForRaw).toISOString() : now;
    const scheduledEndIso = scheduledEndRaw
      ? new Date(scheduledEndRaw).toISOString()
      : new Date(new Date(scheduledStartIso).getTime() + 40 * 60 * 1000).toISOString();

    if (new Date(scheduledEndIso).getTime() <= new Date(scheduledStartIso).getTime()) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const status = new Date(scheduledStartIso).getTime() <= Date.now() ? "live" : "scheduled";

    let subjectName = "Live Class";
    if (resolvedSubjectClassId) {
      const { data: subjectMeta } = await supabase
        .from("subject_classes")
        .select("subjects!subject_classes_subject_id_fkey(name)")
        .eq("id", resolvedSubjectClassId)
        .eq("school_id", context.schoolId)
        .maybeSingle();

      const subjectObj = Array.isArray((subjectMeta as any)?.subjects)
        ? (subjectMeta as any).subjects[0]
        : (subjectMeta as any)?.subjects;
      if (subjectObj?.name) {
        subjectName = subjectObj.name;
      }
    }

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
        scheduled_for: scheduledStartIso,
        scheduled_end_at: scheduledEndIso,
        started_at: status === "live" ? now : null,
        status,
        created_by_user_id: context.userId,
      })
      .select("id, title, class_id, subject_class_id, status, scheduled_for, scheduled_end_at, started_at, ended_at, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const notificationBody =
      status === "live"
        ? `${subjectName} class is now live. Join now.`
        : `${subjectName} class has been scheduled. Check Live Classes for details.`;

    console.log(`\n=== LIVE SESSION CREATED ===`);
    console.log(`Session ID: ${data.id}`);
    console.log(`Title: ${title}`);
    console.log(`Status: ${status}`);
    console.log(`Scheduled: ${scheduledStartIso} to ${scheduledEndIso}`);
    console.log(`Initiating notification dispatch...\n`);

    await notifyStudentsForLiveClassCreation({
      schoolId: context.schoolId,
      classId: resolvedClassId,
      subjectClassId: resolvedSubjectClassId,
      sessionId: data.id,
      title: title || `${subjectName} Class`,
      body: notificationBody,
      sentBy: context.userId,
    });

    console.log(`\n=== NOTIFICATION DISPATCH COMPLETE ===\n`);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create live session" }, { status: 500 });
  }
}
