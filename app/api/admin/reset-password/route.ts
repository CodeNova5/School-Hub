import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
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

    const { studentId, email, userId } = await req.json();

    if (!studentId && !email && !userId) {
      return NextResponse.json(
        { error: "Student ID, email, or User ID is required" },
        { status: 400 }
      );
    }

    const schoolId = await getCallerSchoolId();
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school context" }, { status: 400 });
    }

    let query = supabase
      .from("students")
      .select("id, email, first_name, last_name, user_id, school_id")
      .eq("school_id", schoolId);

    if (studentId) {
      query = query.eq("id", studentId);
    } else if (email) {
      query = query.eq("email", String(email).trim().toLowerCase());
    } else if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data: student, error: studentError } = await query.maybeSingle();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    if (!student.email) {
      return NextResponse.json(
        { error: "Student email is missing" },
        { status: 400 }
      );
    }

    const activationToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(activationToken)
      .digest("hex");

    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 24);

    const { error: updateError } = await supabase
      .from("students")
      .update({
        is_active: false,
        activation_token_hash: tokenHash,
        activation_expires_at: expirationTime.toISOString(),
        activation_used: false,
      })
      .eq("id", student.id)
      .eq("school_id", schoolId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to generate reset token" },
        { status: 500 }
      );
    }

    const activationLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/student/reset-password?token=${activationToken}`;
    const schoolName = await resolveSchoolName(supabase, student.school_id);

    try {
      await sendEmailSafe({
        to: student.email,
        fromName: buildSchoolSenderName(schoolName),
        subject: `Reset Your Password - ${schoolName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hello ${student.first_name} ${student.last_name},</p>
            <p>We received a request to reset your ${schoolName} account password. Click the link below to set a new password:</p>
            <div style="margin: 20px 0;">
              <a href="${activationLink}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy this link: <a href="${activationLink}">${activationLink}</a></p>
            <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
            <p style="color: #666; font-size: 12px;">Powered by School Deck.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
    }

    return NextResponse.json(
      {
        message: "Password reset email sent successfully.",
        email: student.email,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
