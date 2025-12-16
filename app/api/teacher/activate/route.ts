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
    // 2️⃣ Find teacher by activation token
    const { data: teacher, error } = await supabase
      .from("teachers")
      .select("id, email, activation_used, activation_expires_at")
      .eq("activation_token_hash", tokenHash)
      .single();
    if (
      error ||
      !teacher ||
        teacher.activation_used ||
        new Date(teacher.activation_expires_at) < new Date()
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
    const user = users.users.find((u:any) => u.email === teacher.email);
    if (!user) {
      return NextResponse.json(
        { error: "Auth user not found" },
        { status: 404 }
      );
    }(u:any) => u.email === teacher.email;
    if (!user) {
      return NextResponse.json(
        { error: "Auth user not found" },
        { status: 404 }
      );
    }
    // 4️⃣ Update auth user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password,
      }
    );
    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }
    // 5️⃣ Mark activation as used
    await supabase
      .from("teachers")
      .update({ 
        activation_used: true,
        is_active: true,
        
       })
      .eq("id", teacher.id);
    return NextResponse.json(
      { message: "Account activated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
