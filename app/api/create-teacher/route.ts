// app/api/create-teacher/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email, teacherData, selectedClasses } = await req.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1️⃣ Create auth user (password-based, inactive)
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(), // temp password
        email_confirm: true,
        user_metadata: {
          role: "teacher",
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth user" },
        { status: 400 }
      );
    }

    // 2️⃣ Insert teacher record
    const { data: teacher, error: teacherError } =
      await supabase
        .from("teachers")
        .insert({
          ...teacherData,
          email,
          user_id: authData.user.id,
          is_active: false,
          status: "pending",
        })
        .select()
        .single();

    if (teacherError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: teacherError.message },
        { status: 400 }
      );
    }

    // 3️⃣ Assign classes
    if (selectedClasses?.length > 0) {
      const assignments = selectedClasses.map((classId: string) => ({
        teacher_id: teacher.id,
        class_id: classId,
        session_id: null,
      }));

      await supabase.from("teacher_classes").insert(assignments);
    }

    // 4️⃣ Generate activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 5️⃣ Save activation data into teachers table
    await supabase
      .from("teachers")
      .update({
        activation_token_hash: tokenHash,
        activation_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24h
        activation_used: false,
      })
      .eq("id", teacher.id);

    // 6️⃣ Send activation email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const activationLink =
      `${process.env.NEXT_PUBLIC_APP_URL}/teacher/activate?token=${rawToken}`;

    await transporter.sendMail({
      from: `"School Hub" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Activate Your Teacher Account",
      html: `
        <p>Hello,</p>
        <p>Your teacher account has been created.</p>
        <p>Click the link below to activate your account and set your password:</p>
        <p>
          <a href="${activationLink}" style="color:#2563eb;">
            Activate Account
          </a>
        </p>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return NextResponse.json({ success: true, teacher });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
