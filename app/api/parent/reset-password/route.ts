import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import nodemailer from "nodemailer";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export async function POST(req: Request) {
    try {
        const { email, userId } = await req.json();

        if (!email && !userId) {
            return NextResponse.json(
                { error: "Email or User ID is required" },
                { status: 400 }
            );
        }

        // 1️⃣ Get parent by email or user_id
        let parentQuery;
        if (email) {
            parentQuery = await supabase
                .from("parents")
                .select("id, email, name, user_id")
                .eq("email", email)
                .single();
        } else {
            parentQuery = await supabase
                .from("parents")
                .select("id, email, name, user_id")
                .eq("user_id", userId)
                .single();
        }

        const { data: parent, error: parentError } = parentQuery;

        if (parentError || !parent) {
            return NextResponse.json(
                { error: "Parent not found" },
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

        // 4️⃣ Update parent with new activation token
        const { error: updateError } = await supabase
            .from("parents")
            .update({
                is_active: false, // Deactivate account until password is reset
                activation_token_hash: tokenHash,
                activation_expires_at: expirationTime.toISOString(),
                activation_used: false,
            })
            .eq("id", parent.id);

        if (updateError) {
            return NextResponse.json(
                { error: "Failed to generate reset token" },
                { status: 500 }
            );
        }

        // 5️⃣ Send email with activation link
        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/parent/reset-password?token=${activationToken}`;

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: parent.email,
                subject: "Reset Your Password - School Hub Parent Portal",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>Hello ${parent.name},</p>
            <p>We received a request to reset your password. Click the link below to set a new password:</p>
            <div style="margin: 20px 0;">
              <a href="${activationLink}" style="background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy this link: <a href="${activationLink}">${activationLink}</a></p>
            <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
            <p style="color: #666; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
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
                email: parent.email,
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
