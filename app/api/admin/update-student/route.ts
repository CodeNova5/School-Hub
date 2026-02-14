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
    const { studentId, updates } = await req.json();

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 }
      );
    }

    // Fetch current student data
    const { data: currentStudent, error: fetchError } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .single();

    if (fetchError || !currentStudent) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Check if email has changed and if it's already in use by another student/parent
    let emailChanged = false;
    if (updates.email && updates.email !== currentStudent.email) {
      emailChanged = true;
      
      // Check if email is already in use
      const { data: existingStudent } = await supabase
        .from("students")
        .select("id")
        .eq("email", updates.email)
        .neq("id", studentId)
        .single();

      const { data: existingParent } = await supabase
        .from("parents")
        .select("id")
        .eq("email", updates.email)
        .single();

      if (existingStudent || existingParent) {
        return NextResponse.json(
          { error: "This email is already in use" },
          { status: 400 }
        );
      }
    }

    // Update student record
    const studentUpdateData: any = { ...updates };
    let rawToken: string | null = null;
    
    // If email changed, mark as inactive and generate activation token
    if (emailChanged) {
      rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      console.log("Generated token for student", studentId, "token hash:", tokenHash);

      studentUpdateData.is_active = false;
      studentUpdateData.activation_token_hash = tokenHash;
      studentUpdateData.activation_expires_at = new Date(Date.now() + 86400000); // 24 hours
      studentUpdateData.activation_used = false;
    }

    const { data: updatedStudent, error: updateError } = await supabase
      .from("students")
      .update(studentUpdateData)
      .eq("id", studentId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating student:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (emailChanged) {
      console.log("Successfully updated student with token. Updated data:", {
        id: updatedStudent.id,
        email: updatedStudent.email,
        is_active: updatedStudent.is_active,
        activation_used: updatedStudent.activation_used,
        has_activation_token_hash: !!updatedStudent.activation_token_hash,
        activation_expires_at: updatedStudent.activation_expires_at,
      });
    }

    // If email changed, send verification email and create/update auth user
    if (emailChanged && rawToken) {
      try {
        // Update or create auth user
        if (currentStudent.user_id) {
          // Update existing auth user email
          await supabase.auth.admin.updateUserById(currentStudent.user_id, {
            email: updates.email,
            email_confirm: false,
          });
        } else {
          // Create new auth user if one doesn't exist
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: updates.email,
            email_confirm: false,
            password: crypto.randomBytes(32).toString("hex"), // Temporary password
          });

          if (createError) {
            console.error("Error creating auth user:", createError);
          } else if (newUser) {
            // Update student with new user_id
            await supabase
              .from("students")
              .update({ user_id: newUser.user.id })
              .eq("id", studentId);
          }
        }

        // Send verification email
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
          console.warn("Email credentials not configured");
          return NextResponse.json({
            success: true,
            message: "Student updated but email configuration is missing. Please configure EMAIL_USER and EMAIL_PASS environment variables.",
            student: updatedStudent,
          });
        }

        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/student/activate?token=${rawToken}`;

        await transporter.sendMail({
          from: `"School Hub" <${process.env.EMAIL_USER}>`,
          to: updates.email,
          subject: "Verify Your New Email Address",
          html: `
            <p>Hello ${currentStudent.first_name},</p>
            <p>Your email address has been updated in the School Hub system.</p>
            <p>Click the link below to verify your new email address:</p>
            <p>
              <a href="${activationLink}" style="color:#2563eb; text-decoration:none;">
                Verify Email Address
              </a>
            </p>
            <p>This link expires in 24 hours.</p>
            <p>If you did not request this change, please contact your administrator.</p>
          `,
        });
      } catch (emailError: any) {
        console.error("Error sending verification email:", emailError);
        return NextResponse.json({
          success: true,
          message: "Student updated successfully, but verification email could not be sent. Error: " + emailError.message,
          student: updatedStudent,
          emailError: emailError.message,
        });
      }
    }


    return NextResponse.json({
      success: true,
      message: emailChanged
        ? "Student updated. Verification email sent to new email address."
        : "Student updated successfully.",
      student: updatedStudent,
    });

  } catch (e: any) {
    console.error("Error updating student:", e);
    return NextResponse.json(
      { error: e.message || "Failed to update student" },
      { status: 500 }
    );
  }
}
