import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only key
);

export async function POST(req: Request) {
  try {
    const { email, student_id } = await req.json();

    // 1️⃣ Create user (unconfirmed)
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        role: "student",
        student_id,
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    // 2️⃣ Generate magic invite link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/student/set-password`
      }
    });

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 });
    }

    const magicLink = linkData?.properties?.action_link;

    // 3️⃣ Send email using Resend
    await resend.emails.send({
      from: "School Hub <noreply@yourdomain.com>",
      to: email,
      subject: "Your Student Account Invitation",
      html: `
        <p>Hello,</p>
        <p>You have been invited to School Hub.</p>
        <p>Click the link below to activate your account:</p>
        <p><a href="${magicLink}">Activate Account</a></p>
        <p>If you did not request this, ignore this email.</p>
      `,
    });

    return NextResponse.json({ success: true });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
