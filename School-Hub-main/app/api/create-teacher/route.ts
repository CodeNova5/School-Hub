import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, teacherData, selectedClasses } = body;

    // Server-side Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST BE SERVICE KEY
    );

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 2. Insert into teachers table
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .insert({
        ...teacherData,
        user_id: authData.user.id,
      })
      .select()
      .single();

    if (teacherError) {
      // Rollback auth user if teacher insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: teacherError.message }, { status: 400 });
    }

    // 3. Insert class assignments
    if (selectedClasses?.length > 0) {
      const assignments = selectedClasses.map((classId: string) => ({
        teacher_id: teacher.id,
        class_id: classId,
        session_id: null,
      }));

      await supabase.from("teacher_classes").insert(assignments);
    }

    return NextResponse.json({ success: true, teacher });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
