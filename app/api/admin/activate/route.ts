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
        { error: "Missing token or password" },
        { status: 400 }
      );
    }

    // 1️⃣ Hash token
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 2️⃣ Find admin by activation token
    const { data: admin, error } = await supabase
      .from("admins")
      .select("id, user_id, email, activation_used, activation_expires_at")
      .eq("activation_token_hash", tokenHash)
      .single();

    if (
      error ||
      !admin ||
      admin.activation_used ||
      new Date(admin.activation_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired activation link" },
        { status: 400 }
      );
    }

    // 3️⃣ Update auth user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      admin.user_id,
      {
        password,
        email_confirm: true,
      }
    );

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    // 4️⃣ Mark activation as used
    await supabase
      .from("admins")
      .update({
        activation_used: true,
        is_active: true,
        status: "active",
      })
      .eq("id", admin.id);

    return NextResponse.json(
      { message: "Admin account activated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
