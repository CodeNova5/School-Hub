import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true, userId: user.id };
}

async function getSchoolId() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_my_school_id");

  if (error || !data) {
    return null;
  }

  return data as string;
}

export async function GET() {
  const permission = await checkIsAdmin();
  if (!permission.authorized) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.status }
    );
  }

  const schoolId = await getSchoolId();
  if (!schoolId) {
    return NextResponse.json({ error: "School not found" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .select(`
      id,
      first_name,
      last_name,
      student_id,
      class_id,
      classes ( name ),
      jamb_student_access (
        id,
        is_active,
        granted_at,
        revoked_at,
        notes
      )
    `)
    .eq("school_id", schoolId)
    .order("first_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const students = (data || []).map((student: any) => ({
    id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    student_id: student.student_id,
    class_name: Array.isArray(student.classes)
      ? student.classes[0]?.name || "No class"
      : student.classes?.name || "No class",
    jamb_access: Array.isArray(student.jamb_student_access)
      ? student.jamb_student_access[0] || null
      : student.jamb_student_access || null,
  }));

  return NextResponse.json({ data: students });
}

export async function POST(req: NextRequest) {
  const permission = await checkIsAdmin();
  if (!permission.authorized) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.status }
    );
  }

  const schoolId = await getSchoolId();
  if (!schoolId) {
    return NextResponse.json({ error: "School not found" }, { status: 400 });
  }

  const { studentId, active, notes } = await req.json();

  if (!studentId) {
    return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .single();

  if (studentError || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const { data: existingAccess } = await supabaseAdmin
    .from("jamb_student_access")
    .select("id")
    .eq("student_id", studentId)
    .single();

  let mutation;

  if (existingAccess) {
    // Update existing record — only touch fields that changed
    mutation = await supabaseAdmin
      .from("jamb_student_access")
      .update(
        active
          ? {
              granted_at: new Date().toISOString(),
              revoked_at: null,
              is_active: true,
              notes: notes || null,
              updated_at: new Date().toISOString(),
            }
          : {
              revoked_at: new Date().toISOString(),
              is_active: false,
              notes: notes || null,
              updated_at: new Date().toISOString(),
            }
      )
      .eq("id", existingAccess.id)
      .select()
      .single();
  } else {
    // Insert new record — all required fields
    mutation = await supabaseAdmin
      .from("jamb_student_access")
      .insert(
        active
          ? {
              school_id: schoolId,
              student_id: studentId,
              granted_by_user_id: permission.userId,
              granted_at: new Date().toISOString(),
              revoked_at: null,
              is_active: true,
              notes: notes || null,
              updated_at: new Date().toISOString(),
            }
          : {
              school_id: schoolId,
              student_id: studentId,
              granted_by_user_id: permission.userId,
              granted_at: new Date().toISOString(),
              revoked_at: new Date().toISOString(),
              is_active: false,
              notes: notes || null,
              updated_at: new Date().toISOString(),
            }
      )
      .select()
      .single();
  }

  if (mutation.error) {
    return NextResponse.json({ error: mutation.error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mutation.data });
}