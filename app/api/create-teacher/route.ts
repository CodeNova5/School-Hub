import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // IMPORTANT
);

export async function POST(req: Request) {
  const body = await req.json();

  const { email, password, teacherData, selectedClasses } = body;

  try {
    // 1. Create user 
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (authError) throw authError;

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
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw teacherError;
    }

    // 3. Insert class assignments
    if (selectedClasses.length > 0) {
      await supabase.from("teacher_classes").insert(
        selectedClasses.map((id: number) => ({
          teacher_id: teacher.id,
          class_id: id,
          session_id: null,
        }))
      );
    }

    return NextResponse.json({ success: true, teacher });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
