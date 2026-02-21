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
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware to check if user is admin
async function checkIsAdmin() {
    const supabase = createRouteHandlerClient({ cookies });
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { authorized: false, error: "Unauthorized", status: 401 };
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isAdmin) {
        return { authorized: false, error: "Forbidden", status: 403 };
    }

    return { authorized: true };
}

export async function POST(request: NextRequest) {
    try {
        // Check if user is admin  
        const authCheck = await checkIsAdmin();
        if (!authCheck.authorized) {
            return NextResponse.json(
                { error: authCheck.error || "Unauthorized" },
                { status: authCheck.status || 401 }
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
            const { data, error } = await supabaseAdmin
                .from("notification_tokens")
                .select("token")
                .eq("is_active", true);

            if (error) throw error;
            tokens = data || [];
        } else if (target === "role") {
            // Get tokens by role
            const { data, error } = await supabaseAdmin
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
            const { data, error } = await supabaseAdmin
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

        // Deactivate all failed tokens (including invalid ones)
        if (result.failedTokens && result.failedTokens.length > 0) {
            console.log(`Deactivating ${result.failedTokens.length} failed tokens...`);
            for (const token of result.failedTokens) {
                await deactivateToken(token);
            }
        }

        // Log notification send details for debugging
        console.log(`
📊 Notification Send Summary:
├─ Title: ${title}
├─ Target: ${target === "all" ? "All Users" : `${target} (${targetValue})`}
├─ Success: ${result.successCount}
├─ Failed: ${result.failureCount}
├─ Invalid Tokens: ${result.invalidTokens?.length || 0}
├─ Total Tokens Found: ${tokensList.length}
└─ Success Rate: ${tokensList.length > 0 ? ((result.successCount / tokensList.length) * 100).toFixed(1) : 0}%
        `);

        // Return detailed response
        return NextResponse.json({
            success: true,
            successCount: result.successCount,
            failureCount: result.failureCount,
            invalidTokensCount: result.invalidTokens?.length || 0,
            totalTokens: tokensList.length,
            successRate: tokensList.length > 0 ? ((result.successCount / tokensList.length) * 100).toFixed(1) : 0,
            errors: result.errors,
            message: `Sent ${result.successCount}/${tokensList.length} notification${result.successCount !== 1 ? "s" : ""
                }, ${result.failureCount} failed (${result.invalidTokens?.length || 0} invalid tokens detected)`,
            diagnostics: {
                tokensWithoutRecipients: tokensList.length === 0,
                hasInvalidTokens: (result.invalidTokens?.length || 0) > 0,
                recommendation: 
                    tokensList.length === 0 ? "No active tokens found. Check if users have registered for notifications." :
                    (result.invalidTokens?.length || 0) > 0 ? `${result.invalidTokens?.length} invalid/expired tokens detected. Users may need to re-register for notifications.` :
                    ""
            }
        });
    } catch (error) {
        console.error("Send notification error:", error);
        return NextResponse.json(
            { error: "Failed to send notification" },
            { status: 500 }
        );
    }
}
