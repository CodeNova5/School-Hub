import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash the token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find parent by token hash only
    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("*")
      .eq("activation_token_hash", tokenHash)
      .single();

    // Check if parent exists and token is still valid (like teacher activation)
    if (
      parentError ||
      !parent ||
      parent.activation_used ||
      new Date(parent.activation_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired activation link" },
        { status: 400 }
      );
    }

    // Update password for the parent's auth user
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      parent.user_id,
      { password }
    );

    if (updateError) {
      throw updateError;
    }

    // Mark parent as active and token as used
    await supabase
      .from("parents")
      .update({
        is_active: true,
        activation_used: true,
        activation_token_hash: null,
        activation_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parent.id);

    // Create user_role entry if it doesn't exist
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({
        user_id: parent.user_id,
        role: "parent",
      }, {
        onConflict: "user_id,role",
      });

    if (roleError) {
      console.error("Role creation error:", roleError);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Activation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to activate account" },
      { status: 500 }
    );
  }
}
