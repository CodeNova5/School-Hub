import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Request body:", body);
    const { token } = body;

    if (!token) {
      console.log("No token provided");
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Hash the token to match stored hash
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    console.log("Token hash:", tokenHash);

    // Find parent by token hash only
    const { data: parent, error: parentError } = await supabase
      .from("parents")
      .select("*")
      .eq("activation_token_hash", tokenHash)
      .single();
    console.log("Supabase parent fetch result:", { parent, parentError });

    // Check if parent exists and token is still valid (like teacher activation)
    if (
      parentError ||
      !parent ||
      parent.activation_used ||
      new Date(parent.activation_expires_at) < new Date()
    ) {
      console.log("Parent validation failed", {
        parentError,
        parent,
        activation_used: parent && parent.activation_used,
        activation_expires_at: parent && parent.activation_expires_at,
      });
      return NextResponse.json(
        { error: "Invalid or expired activation link" },
        { status: 400 }
      );
    }

    // Fetch students separately using parent email
    const { data: students } = await supabase
      .from("students")
      .select("first_name, last_name, student_id")
      .eq("parent_email", parent.email);

    console.log("Parent validated successfully", parent);
    return NextResponse.json({
      parent: {
        name: parent.name,
        email: parent.email,
        students: students || [],
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
