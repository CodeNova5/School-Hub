import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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
    userId: user.id,
    studentId: student.id,
    schoolId: student.school_id,
    classId: student.class_id,
    subjectClassIds: (studentSubjects ?? []).map((item: any) => item.subject_class_id),
  };
}

export async function GET() {
  try {
    const context = await getStudentContext();

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    let query = supabase
      .from("live_sessions")
      .select(`
        id,
        title,
        class_id,
        subject_class_id,
        status,
        scheduled_for,
        started_at,
        ended_at,
        created_at,
        subject_classes (
          id,
          subject_code,
          subjects!subject_classes_subject_id_fkey ( name ),
          teachers ( first_name, last_name )
        )
      `)
      .eq("school_id", context.schoolId)
      .eq("class_id", context.classId)
      .in("status", ["scheduled", "live"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (context.subjectClassIds.length > 0) {
      query = query.or(`subject_class_id.is.null,subject_class_id.in.(${context.subjectClassIds.join(",")})`);
    } else {
      query = query.is("subject_class_id", null);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load live sessions" }, { status: 500 });
  }
}
