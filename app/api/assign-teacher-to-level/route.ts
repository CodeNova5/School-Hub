import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { teacher_id, subject_id, education_level, force } = await req.json();

    if (!teacher_id || !subject_id || !education_level) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1️⃣ Get all classes in this level
    const { data: classes, error: classError } = await supabase
      .from("classes")
      .select("id")
      .eq("education_level", education_level);

    if (classError || !classes?.length) {
      return NextResponse.json({ error: "No classes found for this level" }, { status: 400 });
    }

    const classIds = classes.map(c => c.id);

    // 2️⃣ Get subject_classes rows
    let query = supabase
      .from("subject_classes")
      .update({
        teacher_id,
      })
      .in("class_id", classIds)
      .eq("subject_id", subject_id);

    // 3️⃣ If not forcing overwrite, only update empty ones
    if (!force) {
      query = query.is("teacher_id", null);
    }

    const { error: updateError } = await query;

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
