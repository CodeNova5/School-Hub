import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, teacherData, selectedClasses } = body;

    // 1️⃣ Supabase server client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2️⃣ Create user (unconfirmed)
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false, // NOT confirmed, must verify via magic link
      user_metadata: {
        role: "teacher",
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // 3️⃣ Insert teacher record
    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .insert({
        ...teacherData,
        user_id: authData.user.id,
      })
      .select()
      .single();

    if (teacherError) {
      // rollback auth if insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: teacherError.message }, { status: 400 });
    }

    // 4️⃣ Insert class assignments
    if (selectedClasses?.length > 0) {
      const assignments = selectedClasses.map((classId: string) => ({
        teacher_id: teacher.id,
        class_id: classId,
        session_id: null,
      }));

      await supabase.from("teacher_classes").insert(assignments);
    }

    // 5️⃣ Generate magic link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/teacher/set-password`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return NextResponse.json({ error: linkError?.message || "Failed to generate magic link" }, { status: 400 });
    }

    const magicLink = linkData.properties.action_link;

    // 6️⃣ Send email with magic link
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"School Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Teacher Account Invitation",
      html: `
        <p>Hello,</p>
        <p>You have been invited to join <strong>School Hub</strong> as a teacher.</p>
        <p>Click the link below to set your password and activate your account:</p>
        <p><a href="${magicLink}" style="color:#2563eb;">Set Password & Activate Account</a></p>
        <p>If you did not expect this email, please ignore it.</p>
      `,
    });

    return NextResponse.json({ success: true, teacher });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Unexpected server error" }, { status: 500 });
  }
}
