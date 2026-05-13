import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import crypto from "crypto";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsAdmin() {
  const client = createRouteHandlerClient({ cookies });
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin } = await client.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}

async function getCallerSchoolId(): Promise<string | null> {
  const client = createRouteHandlerClient({ cookies });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.rpc("get_my_school_id");
  return data ?? null;
}

export async function POST(req: Request) {
  try {
    const adminCheck = await checkIsAdmin();
    if (!adminCheck.authorized) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status }
      );
    }

    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const schoolId = await getCallerSchoolId();
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school context" }, { status: 400 });
    }

    const schoolName = await resolveSchoolName(supabase, schoolId);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from("student_email_verifications")
      .upsert({
        school_id: schoolId,
        email: normalizedEmail,
        code_hash: codeHash,
        expires_at: expiresAt,
        used: false,
        used_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_id,email" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const mailError = await sendEmailSafe({
      to: normalizedEmail,
      fromName: buildSchoolSenderName(schoolName),
      subject: `Verify Student Email - ${schoolName}`,
      html: `
        <p>Hello,</p>
        <p>Use the 6-digit code below to verify the student email for <strong>${schoolName}</strong>:</p>
        <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, you can ignore this message.</p>
      `,
    });

    if (mailError) {
      return NextResponse.json({ error: mailError }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
