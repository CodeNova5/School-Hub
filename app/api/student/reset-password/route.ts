import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { email, userId } = await req.json();

        if (!email && !userId) {
            return NextResponse.json(
                { error: "Email or User ID is required" },
                { status: 400 }
            );
        }

        // 1️⃣ Get student by email or user_id
        let query = supabase
            .from("students")
            .select("id, email, first_name, last_name, user_id, school_id");
        
        let result;
        if (email) {
            result = await query.eq("email", email).maybeSingle();
        } else {
            result = await query.eq("user_id", userId).maybeSingle();
        }

        const { data: student, error: studentError } = result;

        if (studentError || !student) {
            return NextResponse.json(
                { error: "Student not found" },
                { status: 404 }
            );
        }

        // 3️⃣ Generate new activation token
        const activationToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
            .createHash("sha256")
            .update(activationToken)
            .digest("hex");

        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 24); // Token valid for 24 hours

        // 4️⃣ Update student with new activation token
        const { error: updateError } = await supabase
            .from("students")
            .update({
                is_active: false, // Deactivate account until password is reset
                activation_token_hash: tokenHash,
                activation_expires_at: expirationTime.toISOString(),
                activation_used: false,
            })
            .eq("id", student.id);

        if (updateError) {
            return NextResponse.json(
                { error: "Failed to generate reset token" },
                { status: 500 }
            );
        }

        // 5️⃣ Send email with activation link
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
            // Email service might not be configured, but we still succeed the token generation
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
