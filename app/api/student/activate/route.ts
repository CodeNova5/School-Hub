import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
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

    // 2️⃣ Find activation record
    const { data: activation, error: activationError } =
      await supabase
        .from("students")
        .select("*")
        .eq("token_hash", tokenHash)
        .single();

    if (
      activationError ||
      !activation ||
      activation.used ||
      new Date(activation.expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired activation link" },
        { status: 400 }
      );
    }

    // 3️⃣ Get user by email
    const { data: users, error: userError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (userError) {
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }

    const user = users.users.find(
      (u) => u.email === activation.email
    );

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 4️⃣ Update password
    const { error: updateError } =
      await supabase.auth.admin.updateUserById(
        user.id,
        { password }
      );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // 5️⃣ Mark activation as used
    await supabase
      .from("students")
      .update({ used: true })
      .eq("id", activation.id);

    // 6️⃣ (Optional) mark user active in your profile table
    // await supabase
    //   .from("students")
    //   .update({ is_active: true })
    //   .eq("email", activation.email);

    return NextResponse.json({
      success: true,
      message: "Account activated successfully",
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
