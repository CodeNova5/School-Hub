export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
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
        return { authorized: false, error: "Unauthorized", status: 401, user: null };
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isAdmin) {
        return { authorized: false, error: "Forbidden", status: 403, user: null };
    }

    return { authorized: true, user };
}

// check if user is teacher
async function checkIsTeacher() {
    const supabase = createRouteHandlerClient({ cookies });
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return { authorized: false, error: "Unauthorized", status: 401, user: null };
    }

    const { data: isTeacher } = await supabase.rpc("is_teacher");

    if (!isTeacher) {
        return { authorized: false, error: "Forbidden", status: 403, user: null };
    }

    return { authorized: true, user };
}

// Function to log notification to the database
async function logNotification(
    title: string,
    body: string,
    target: string,
    targetValue: string | undefined,
    successCount: number,
    failureCount: number,
    totalRecipients: number,
    sentBy: string,
    imageUrl?: string,
    link?: string
) {
    try {
        console.log("📝 Attempting to log notification to database...", { sentBy, target });
        
        const { data, error } = await supabaseAdmin
            .from("notification_logs")
            .insert({
                title,
                body,
                image_url: imageUrl,
                link,
                target,
                target_value: targetValue,
                success_count: successCount,
                failure_count: failureCount,
                total_recipients: totalRecipients,
                sent_by: sentBy
            });

        if (error) {
            console.error("❌ Error logging notification to database:", error);
            console.error("Error details:", { 
                message: error.message, 
                code: error.code
            });
            return false;
        }
        
        console.log("✅ Notification logged to database successfully");
        return true;
    } catch (error) {
        console.error("❌ Failed to log notification - Exception caught:", error);
        return false;
    }
}

export async function POST(request: NextRequest) {
    try {
        // Check if user is admin or teacher
        const authCheck = await checkIsAdmin();
        if (!authCheck.authorized) {
            const teacherCheck = await checkIsTeacher();
            if (!teacherCheck.authorized) {
                return NextResponse.json(
                    { error: authCheck.error },
                    { status: authCheck.status }
                );
            }
        }
        
        const userId = authCheck.user?.id;

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

        // FIRST - Debug: Check total tokens vs active tokens
        try {
            const { count: totalCount } = await supabaseAdmin
                .from("notification_tokens")
                .select("token", { count: "exact" })
                ;

            const { count: activeCount } = await supabaseAdmin
                .from("notification_tokens")
                .select("token", { count: "exact" })
                .eq("is_active", true);

            const { data: inactiveTokensSample } = await supabaseAdmin
                .from("notification_tokens")
                .select("token, user_id, is_active")
                .eq("is_active", false)
                .limit(3);

            console.log(`
📊 Token Status Check:
├─ Total tokens in database: ${totalCount || 0}
├─ Active tokens (is_active=true): ${activeCount || 0}
├─ Inactive tokens: ${(totalCount || 0) - (activeCount || 0)}
└─ Inactive sample: ${inactiveTokensSample?.length ? "Found inactive tokens" : "None"}
            `);

            if ((totalCount || 0) > 0 && (activeCount || 0) === 0) {
                console.warn(
                    "⚠️ ALERT: Found tokens but ALL are marked as INACTIVE (is_active=false)!"
                );
            }
        } catch (debugError) {
            console.error("Debug check error:", debugError);
        }

        if (target === "all") {
            // Get all active tokens
            const { data, error } = await supabaseAdmin
                .from("notification_tokens")
                .select("token")
                .eq("is_active", true);

            if (error) {
                console.error("Error fetching active tokens:", error);
                throw error;
            }
            
            console.log(`Found ${data?.length || 0} active tokens for target 'all'`);
            tokens = data || [];
        } else if (target === "role") {
            // Get tokens by role
            const { data, error } = await supabaseAdmin
                .from("notification_tokens")
                .select("token")
                .eq("role", targetValue)
                .eq("is_active", true);

            if (error) {
                console.error(`Error fetching tokens for role '${targetValue}':`, error);
                throw error;
            }
            
            console.log(`Found ${data?.length || 0} active tokens for role '${targetValue}'`);
            tokens = data || [];
        } else if (target === "user") {
            // Get tokens for specific user - need to resolve profile ID to auth user_id
            let authUserId = targetValue;
            
            // Try to find the user_id from students table
            const { data: studentData } = await supabaseAdmin
                .from("students")
                .select("user_id")
                .eq("id", targetValue)
                .single();
            
            if (studentData?.user_id) {
                authUserId = studentData.user_id;
            } else {
                // Try teachers table
                const { data: teacherData } = await supabaseAdmin
                    .from("teachers")
                    .select("user_id")
                    .eq("id", targetValue)
                    .single();
                
                if (teacherData?.user_id) {
                    authUserId = teacherData.user_id;
                } else {
                    // Try parents table
                    const { data: parentData } = await supabaseAdmin
                        .from("parents")
                        .select("user_id")
                        .eq("id", targetValue)
                        .single();
                    
                    if (parentData?.user_id) {
                        authUserId = parentData.user_id;
                    }
                }
            }

            console.log(`Resolved user profile '${targetValue}' to auth user '${authUserId}'`);

            // Get tokens for the resolved auth user_id
            const { data, error } = await supabaseAdmin
                .from("notification_tokens")
                .select("token")
                .eq("user_id", authUserId)
                .eq("is_active", true);

            if (error) {
                console.error(`Error fetching tokens for user '${targetValue}' (auth: ${authUserId}):`, error);
                throw error;
            }
            
            console.log(`Found ${data?.length || 0} active tokens for user '${authUserId}'`);
            tokens = data || [];
        } else if (target === "class") {
            // Get tokens for students in a class
            const { data, error } = await supabaseAdmin
                .from("notification_tokens")
                .select("token")
                .eq("is_active", true);

            if (error) {
                console.error(`Error fetching tokens:`, error);
                throw error;
            }
            
            console.log(`Found ${data?.length || 0} active tokens for class`);
            tokens = data || [];
        }

        if (tokens.length === 0) {
            console.warn("⚠️ NO ACTIVE TOKENS FOUND - Returning empty result");
            return NextResponse.json(
                { 
                    success: true, 
                    successCount: 0, 
                    totalTokens: 0, 
                    failureCount: 0,
                    warning: "No active tokens found. Verify tokens have is_active=true in database.",
                    message: "No active tokens found" 
                },
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

        // Log notification to database
        if (userId) {
            const logSuccess = await logNotification(
                title,
                body,
                target,
                targetValue,
                result.successCount,
                result.failureCount,
                tokensList.length,
                userId,
                imageUrl,
                link
            );
            if (!logSuccess) {
                console.warn("⚠️ Notification was sent but failed to log to database");
            }
        } else {
            console.warn("⚠️ User ID not found - notification not logged to database");
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
