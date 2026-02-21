import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { getUserTokens, getTokensByRole, formatFCMPayload } from "@/lib/notification-utils";

// Note: You'll need to set up Firebase Admin SDK
// npm install firebase-admin
// Then initialize it in your project

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

    // Send notifications using Firebase Admin SDK
    // IMPORTANT: You need to initialize Firebase Admin SDK first
    // See comments below for implementation

    /*
    // Uncomment after setting up Firebase Admin SDK:
    
    import * as admin from "firebase-admin";

    const messaging = admin.messaging();
    
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    // Send in batches to avoid rate limiting
    const batchSize = 100;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const messages = batch.map(t => ({
        token: t.token,
        ...notificationPayload,
      }));

      try {
        const response = await messaging.sendMulticast({ messages });
        successCount += response.successCount;
        failureCount += response.failureCount;

        // Handle failed tokens
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              errors.push(`Token ${batch[idx].token}: ${resp.error?.message}`);
              
              // Deactivate token if invalid
              if (resp.error?.code === "messaging/invalid-registration-token") {
                supabase
                  .from("notification_tokens")
                  .update({ is_active: false })
                  .eq("token", batch[idx].token)
                  .catch(err => console.error("Error deactivating token:", err));
              }
            }
          });
        }
      } catch (error) {
        console.error("Batch send error:", error);
        failureCount += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      successCount,
      failureCount,
      errors: errors.slice(0, 10), // Return first 10 errors
      message: `Sent ${successCount} notifications, ${failureCount} failed`,
    });
    */

    // Placeholder response (replace with actual Firebase Admin SDK call)
    return NextResponse.json(
      {
        error:
          "Firebase Admin SDK not yet configured. Please set up Firebase Admin SDK and uncomment the code in app/api/admin/send-notification/route.ts",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    );
  }
}
