import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { initializeAdminSDK, sendNotificationsToMultiple } from "@/lib/firebase-admin";
import { deactivateToken } from "@/lib/notification-utils";

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

async function notifyStudentsForLiveSessionStart(params: {
  schoolId: string;
  classId: string | null;
  subjectClassId: string | null;
  sessionId: string;
  title: string;
  sentBy: string;
}) {
  const logPrefix = `[LIVE_START] SessionId: ${params.sessionId}`;
  console.log(`${logPrefix} [START] Session started notification process initiated`);
  console.log(`${logPrefix} Action: "Class is now live. Join now!" | Title: "${params.title}"`);

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
      console.warn(`${logPrefix} [WARNING] No enrolled students found`);
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
      console.warn(`${logPrefix} [WARNING] No students found in class`);
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
    console.error(`${logPrefix} [ERROR] Failed to fetch user IDs:`, studentsError);
    return;
  }

  if (!studentRows || studentRows.length === 0) {
    console.warn(`${logPrefix} [WARNING] No students with valid user IDs found`);
    return;
  }

  console.log(`${logPrefix} [STEP 2] Found ${studentRows.length} students with user IDs`);

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
    console.warn(`${logPrefix} [WARNING] No active tokens - skipping Firebase send`);
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
      
      console.log(`${logPrefix} [STEP 6] Sending ${tokens.length} "live now" notifications via Firebase...`);
      const sendResult = await sendNotificationsToMultiple(
        tokens,
        {
          title: params.title,
          body: "Class is now live. Join now!",
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
    body: "Class is now live. Join now!",
    link: "/student/live-classes",
    target: "user",
    target_value: userId,
    target_name: "Live Class Started",
    success_count: tokenUserSet.has(userId) ? 1 : 0,
    failure_count: tokenUserSet.has(userId) ? 0 : 1,
    total_recipients: 1,
    sent_by: params.sentBy,
    school_id: params.schoolId,
    created_at: new Date().toISOString(),
    metadata: {
      source: "live_class_started",
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

  console.log(`${logPrefix} [COMPLETE] Session start notification process finished ✓`);
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
    userId: user.id,
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
    console.log(`\\n=== SESSION ACTION: ${action.toUpperCase()} ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`New Status: ${updates.status}`);
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

    // Send notification when session is started
    if (action === "start" && (data.subject_class_id || data.class_id)) {
      try {
        console.log(`\n=== SESSION STARTED ACTION ===`);
        console.log(`Session ID: ${data.id}`);
        console.log(`Title: ${data.title}`);
        console.log(`Action: start`);
        console.log(`Initiating 'class is now live' notification dispatch...\n`);

        await notifyStudentsForLiveSessionStart({
          schoolId: context.schoolId,
          classId: data.class_id,
          subjectClassId: data.subject_class_id,
          sessionId: data.id,
          title: data.title || "Live Class",
          sentBy: context.userId,
        });

        console.log(`\n=== 'LIVE NOW' NOTIFICATION DISPATCH COMPLETE ===\n`);
      } catch (notificationError) {
        console.error("Failed to send session start notification", notificationError);
      }
    }
    console.log(`=== SESSION UPDATE COMPLETE ===\\n`);
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update session" }, { status: 500 });
  }
}
