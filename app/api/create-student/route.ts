import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only key
);

export async function POST(req: Request) {
  try {
    const { email, student_id } = await req.json();

    // 1️⃣ Create user (unconfirmed)
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
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

    // 2️⃣ Generate magic invite link
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/student/set-password`,
        },
      });

    if (linkError) {
      return NextResponse.json(
        { error: linkError.message },
        { status: 400 }
      );
    }

    const magicLink = linkData?.properties?.action_link;

    // 3️⃣ Send email using Nodemailer (Gmail)
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
      subject: "Your Student Account Invitation",
      html: `
        <p>Hello,</p>
        <p>You have been invited to <strong>School Hub</strong>.</p>
        <p>Click the link below to activate your account:</p>
        <p>
          <a href="${magicLink}" style="color:#2563eb;">
            Activate Account
          </a>
        </p>
        <p>If you did not request this, please ignore this email.</p>
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
