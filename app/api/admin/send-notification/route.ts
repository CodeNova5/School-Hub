import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import {
  getUserTokens,
  getTokensByRole,
  formatFCMPayload,
  deactivateToken,
} from "@/lib/notification-utils";
import {
  sendNotificationsToMultiple,
  initializeAdminSDK,
} from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    // Verify user is admin
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: adminData } = await supabase
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!adminData) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { title, body, imageUrl, link, target, targetValue, data: customData } =
      await request.json();

    // Validate required fields
    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    // Get tokens based on target
    let tokens: any[] = [];

    if (target === "all") {
      // Get all active tokens
      const { data, error } = await supabase
        .from("notification_tokens")
        .select("token")
        .eq("is_active", true);

      if (error) throw error;
      tokens = data || [];
    } else if (target === "role") {
      // Get tokens by role
      const { data, error } = await supabase
        .from("notification_tokens")
        .select("token")
        .eq("role", targetValue)
        .eq("is_active", true);

      if (error) throw error;
      tokens = data || [];
    } else if (target === "user") {
      // Get tokens for specific user
      tokens = await getUserTokens(targetValue);
    } else if (target === "class") {
      // Get tokens for students in a class
      const { data, error } = await supabase
        .from("notification_tokens")
        .select("nt.token")
        .eq("students.class_id", targetValue)
        .eq("is_active", true);

      if (error) throw error;
      tokens = data || [];
    }

    if (tokens.length === 0) {
      return NextResponse.json(
        { success: true, successCount: 0, message: "No active tokens found" },
        { status: 200 }
      );
    }

    // Format notification payload
    const notificationPayload = formatFCMPayload({
      title,
      body,
      imageUrl,
      link,
      data: customData,
    });

    // Initialize Firebase Admin SDK
    try {
      initializeAdminSDK();
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
      return NextResponse.json(
        {
          error: "Firebase Admin SDK not configured. Please set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local",
        },
        { status: 500 }
      );
    }

    // Send notifications via Firebase Admin SDK
    const tokensList = tokens.map((t: any) => t.token);

    const result = await sendNotificationsToMultiple(
      tokensList,
      {
        title,
        body,
        imageUrl,
      },
      notificationPayload.data
    );

    // Deactivate failed tokens
    if (result.failedTokens && result.failedTokens.length > 0) {
      for (const token of result.failedTokens) {
        await deactivateToken(token);
      }
    }

    return NextResponse.json({
      success: true,
      successCount: result.successCount,
      failureCount: result.failureCount,
      errors: result.errors,
      message: `Sent ${result.successCount} notification${
        result.successCount !== 1 ? "s" : ""
      }, ${result.failureCount} failed`,
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
