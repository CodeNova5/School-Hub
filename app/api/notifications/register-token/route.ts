import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key to bypass RLS policies
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // Get authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify the token with Supabase auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication error:", authError);
      return NextResponse.json(
        { error: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    const { fcmToken, userId, role, deviceType } = await req.json();

    if (!fcmToken || !userId) {
      return NextResponse.json(
        { error: "Missing fcmToken or userId" },
        { status: 400 }
      );
    }

    // Ensure user can only register tokens for themselves
    if (user.id !== userId) {
      return NextResponse.json(
        { error: "Forbidden: You can only register tokens for your own account" },
        { status: 403 }
      );
    }

    // 1️⃣ Delete all existing tokens for this user
    const { error: deleteError } = await supabase
      .from("notification_tokens")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("Error deleting old tokens:", deleteError);
      return NextResponse.json(
        { error: "Failed to clean old tokens", details: deleteError },
        { status: 500 }
      );
    }

    // 2️⃣ Insert new token
    const { error: insertError } = await supabase
      .from("notification_tokens")
      .insert({
        token: fcmToken,
        user_id: userId,
        role: role || "user",
        device_type: deviceType || "unknown",
        is_active: true,
        last_registered_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error("Error inserting token:", insertError);
      return NextResponse.json(
        { error: "Failed to register notification token", details: insertError },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { success: true, message: "Notification token registered successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in register-token endpoint:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
