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
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Hash the token to match stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Find parent by token
    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("*, students!students_parent_email_fkey(first_name, last_name, student_id)")
      .eq("activation_token_hash", tokenHash)
      .eq("activation_used", false)
      .single();

    if (parentError || !parent) {
      return NextResponse.json(
        { error: "Invalid or expired activation link" },
        { status: 400 }
      );
    }

    // Check if token expired
    if (new Date(parent.activation_expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Activation link has expired" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      parent: {
        name: parent.name,
        email: parent.email,
        students: parent.students || [],
      },
    });
  } catch (error: any) {
    console.error("Validation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to validate token" },
      { status: 500 }
    );
  }
}
