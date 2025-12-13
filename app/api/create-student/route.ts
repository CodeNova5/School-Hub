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
    const { email, student_id } = await req.json();

    // 1️⃣ Create user (email + password auth)
    const { error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(), // temp password
        email_confirm: true,
        user_metadata: {
          role: "student",
          student_id,
        },
      });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    // 2️⃣ Generate activation token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 3️⃣ Store activation record
    await supabase.from("students").insert({
      email,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    // 4️⃣ Send activation email
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
      to: email,
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
