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

    // 2️⃣ Find student by activation token
    const { data: student, error } = await supabase
      .from("students")
      .select("id, email, activation_used, activation_expires_at")
      .eq("activation_token_hash", tokenHash)
      .single();

    if (
      error ||
      !student ||
      student.activation_used ||
      new Date(student.activation_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired activation link" },
        { status: 400 }
      );
    }

    // 3️⃣ Get auth user
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
      (u) => u.email === student.email
    );

    if (!user) {
      return NextResponse.json(
        { error: "Auth user not found" },
        { status: 404 }
      );
    }

    // 4️⃣ Set password
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

    // 5️⃣ Mark student as activated
    await supabase
      .from("students")
      .update({
        activation_used: true,
        is_active: true,
        status: "active",
      })
      .eq("id", student.id);

    return NextResponse.json({
      success: true,
      message: "Account activated successfully",
    });

  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
