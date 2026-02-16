// =============================
// /api/parent/update-password/route.ts
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
    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("id, user_id, activation_expires_at")
      .eq("activation_token_hash", tokenHash)
      .eq("activation_used", false)
      .maybeSingle();

    if (parentError) {
      console.error("Token validation error:", parentError);
      return NextResponse.json(
        { error: "Failed to validate reset token" },
        { status: 500 }
      );
    }

    if (!parent) {
      console.warn("No parent found with valid token hash");
      return NextResponse.json(
        { error: "Invalid or already used reset token" },
        { status: 400 }
      );
    }

    // Check token expiration
    const expirationTime = new Date(parent.activation_expires_at);
    if (new Date() > expirationTime) {
      return NextResponse.json(
        { error: "Reset token has expired" },
        { status: 400 }
      );
    }

    // Update the user's password in Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(parent.user_id, {
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
      .from("parents")
      .update({
        activation_used: true,
        is_active: true, // Reactivate the account
      })
      .eq("id", parent.id);

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
