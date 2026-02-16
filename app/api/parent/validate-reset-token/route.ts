import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Invalid or missing reset token" },
        { status: 400 }
      );
    }

    // Hash the token to match what's stored in the database
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Verify token in database (using service role to bypass RLS)
    const { data: parent, error } = await supabase
      .from("parents")
      .select("id, activation_expires_at, activation_used")
      .eq("activation_token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      console.error("Token validation error:", error);
      return NextResponse.json(
        { valid: false, error: "Failed to validate reset token" },
        { status: 500 }
      );
    }

    if (!parent) {
      console.warn("No parent found with token hash:", tokenHash.substring(0, 8) + "...");
      return NextResponse.json(
        { valid: false, error: "Invalid or expired reset token" },
        { status: 404 }
      );
    }

    // Check if token has expired
    const expirationTime = new Date(parent.activation_expires_at);
    if (new Date() > expirationTime) {
      return NextResponse.json(
        { valid: false, error: "Reset token has expired" },
        { status: 400 }
      );
    }

    // Check if token was already used
    if (parent.activation_used) {
      return NextResponse.json(
        { valid: false, error: "This reset token has already been used" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      parentId: parent.id,
    });
  } catch (error: any) {
    console.error("Token validation error:", error);
    return NextResponse.json(
      { valid: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
