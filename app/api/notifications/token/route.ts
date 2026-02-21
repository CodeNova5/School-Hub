import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, action = "register", role } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    if (action === "register") {
      // Check if token already exists
      const { data: existingToken, error: selectError } = await supabase
        .from("notification_tokens")
        .select("id")
        .eq("user_id", user.id)
        .eq("token", token)
        .single();

      if (existingToken) {
        // Update existing token
        const { error } = await supabase
          .from("notification_tokens")
          .update({
            last_registered_at: new Date().toISOString(),
            is_active: true,
          })
          .eq("id", existingToken.id);

        if (error) throw error;
      } else {
        // Insert new token
        const { error } = await supabase.from("notification_tokens").insert({
          user_id: user.id,
          token,
          role: role || "user",
          device_type: request.headers.get("user-agent") || "unknown",
          is_active: true,
          created_at: new Date().toISOString(),
          last_registered_at: new Date().toISOString(),
        });

        if (error) throw error;
      }

      return NextResponse.json(
        { success: true, message: "Token registered successfully" },
        { status: 200 }
      );
    } else if (action === "unregister") {
      // Deactivate token
      const { error } = await supabase
        .from("notification_tokens")
        .update({
          is_active: false,
        })
        .eq("user_id", user.id)
        .eq("token", token);

      if (error) throw error;

      return NextResponse.json(
        { success: true, message: "Token deregistered successfully" },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Notification token error:", error);
    return NextResponse.json(
      { error: "Failed to process token" },
      { status: 500 }
    );
  }
}
