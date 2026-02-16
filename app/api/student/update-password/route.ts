// =============================
// /api/student/update-password/route.ts
// =============================
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newPassword, token } = body;

    if (!newPassword || !token) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the token to verify it
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Verify the token exists and hasn't been used
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, user_id")
      .eq("activation_token_hash", tokenHash)
      .eq("activation_used", false)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Invalid or already used reset token" },
        { status: 400 }
      );
    }

    // Check token expiration
    const { data: studentData, error: checkError } = await supabase
      .from("students")
      .select("activation_expires_at")
      .eq("id", student.id)
      .single();

    if (checkError || !studentData) {
      return NextResponse.json(
        { error: "Failed to verify token" },
        { status: 400 }
      );
    }

    const expirationTime = new Date(studentData.activation_expires_at);
    if (new Date() > expirationTime) {
      return NextResponse.json(
        { error: "Reset token has expired" },
        { status: 400 }
      );
    }

    // Update the user's password in Auth using the user_id from student record
    const { error: updateError } = await supabase.auth.admin.updateUserById(student.user_id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Password update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    // Mark token as used
    const { error: markError } = await supabase
      .from("students")
      .update({
        activation_used: true,
        is_active: true, // Reactivate the account
      })
      .eq("id", student.id);

    if (markError) {
      console.error("Error marking token as used:", markError);
      // Password was updated but token marking failed - still consider it successful
    }

    return NextResponse.json(
      { message: "Password updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
