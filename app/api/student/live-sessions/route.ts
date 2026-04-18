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

  return {
    userId: user.id,
    studentId: student.id,
    schoolId: student.school_id,
    classId: student.class_id,
    departmentId: student.department_id,
    religionId: student.religion_id,
  };
}

export async function GET() {
  try {
    const context = await getStudentContext();

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    await autoCloseExpiredSessions(supabase, context.schoolId);

    // Students can see all live sessions from their class (both timetable and custom)
    const { data, error } = await supabase
      .from("live_sessions")
      .select(`
        id,
        title,
        class_id,
        subject_class_id,
        status,
        scheduled_for,
        scheduled_end_at,
        started_at,
        ended_at,
        created_at,
        subject_classes (
          id,
          subject_code,
          department_id,
          religion_id,
          subjects!subject_classes_subject_id_fkey ( name ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("school_id", context.schoolId)
      .eq("class_id", context.classId)
      .in("status", ["scheduled", "live"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching live sessions:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Filter sessions by department_id and religion_id to match student's profile
    const filteredData = (data ?? []).filter((session: any) => {
      if (!session.subject_class_id || !session.subject_classes) return true; // Include sessions without subject_class

      const subjectClass = session.subject_classes;
      
      // If subject_class has department_id set, student must match
      if (subjectClass.department_id && context.departmentId !== subjectClass.department_id) {
        return false;
      }
      
      // If subject_class has religion_id set, student must match
      if (subjectClass.religion_id && context.religionId !== subjectClass.religion_id) {
        return false;
      }
      
      return true;
    });

    return NextResponse.json({ data: filteredData });
  } catch (error: any) {
    console.error("Error in live sessions endpoint:", error);
    return NextResponse.json({ error: error.message || "Failed to load live sessions" }, { status: 500 });
  }
}
