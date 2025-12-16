import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const studentData = await req.json();

    // 1️⃣ Create auth user first to get user_id
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: studentData.email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: {
        role: "student",
        student_id: studentData.student_id,
      },
    });

    if (authError) throw authError;

    // 2️⃣ Create student row with user_id
    await supabase.from("students").insert({
      ...studentData,
      user_id: authData.user.id,
      is_active: false,
      status: "pending",
    });

    // 3️⃣ Generate activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 4️⃣ Save token INTO STUDENTS TABLE
    await supabase
      .from("students")
      .update({
        activation_token_hash: tokenHash,
        activation_expires_at: new Date(Date.now() + 86400000),
        activation_used: false,
      })
      .eq("email", studentData.email);

    // 5️⃣ Send activation email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const activationLink =
      `${process.env.NEXT_PUBLIC_APP_URL}/student/activate?token=${rawToken}`;

    await transporter.sendMail({
      from: `"School Hub" <${process.env.EMAIL_USER}>`,
      to: studentData.email,
      subject: "Activate Your Student Account",
      html: `
        <p>Hello,</p>
        <p>Your student account has been created.</p>
        <p>Click the link below to activate your account and set your password:</p>
        <p>
          <a href="${activationLink}" style="color:#2563eb;">
            Activate Account
          </a>
        </p>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}
