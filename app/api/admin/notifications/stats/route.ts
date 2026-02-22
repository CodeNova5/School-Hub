import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
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

async function requireAdmin() {
    const check = await checkIsAdmin();
    if (!check.authorized) {
        throw new Error(check.error || "Unauthorized");
    }
}

export async function GET(request: NextRequest) {
    try {
        // Check if user is admin  
        const authCheck = await checkIsAdmin();
        if (!authCheck.authorized) {
            return NextResponse.json(
                { error: authCheck.error || "Unauthorized" },
                { status: authCheck.status || 401 }
            );
        }


        // Get total notifications sent (from notification_logs table)
        const { data: allNotifications, count: totalCount } = await supabaseAdmin
            .from("notification_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

        // Get today's notifications
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayString = today.toISOString();

        const { data: todayNotifications, count: todayCount } = await supabaseAdmin
            .from("notification_logs")
            .select("*", { count: "exact" })
            .gte("created_at", todayString);

        // Calculate stats
        const totalSent = totalCount || 0;
        const todayNotificationCount = todayCount || 0;

        // Calculate average success rate
        let successRate = 0;
        if (allNotifications && allNotifications.length > 0) {
            const totalSuccessRate = allNotifications.reduce((sum: number, notif: any) => sum + (notif.success_rate || 0), 0);
            successRate = totalSuccessRate / allNotifications.length;
        }

        // Calculate average recipients per notification
        let averageRecipientsPerNotification = 0;
        if (allNotifications && allNotifications.length > 0) {
            const totalRecipients = allNotifications.reduce((sum: number, notif: any) => sum + (notif.total_recipients || 0), 0);
            averageRecipientsPerNotification = Math.round(totalRecipients / allNotifications.length);
        }

        // Get recent notifications (last 10)
        const { data: recentNotifications } = await supabaseAdmin
            .from("notification_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(10);

        // Generate notification trend (last 7 days)
        const notificationTrend = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const { count: dayCount } = await supabaseAdmin
                .from("notification_logs")
                .select("*", { count: "exact" })
                .gte("created_at", dayStart.toISOString())
                .lt("created_at", dayEnd.toISOString());

            notificationTrend.push({
                date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                sent: dayCount || 0,
            });
        }

        return NextResponse.json({
            data: {
                totalSent,
                todayCount: todayNotificationCount,
                successRate: parseFloat(successRate.toFixed(1)),
                averageRecipientsPerNotification,
                recentNotifications: (recentNotifications || []).map((notif: any) => ({
                    id: notif.id,
                    title: notif.title,
                    body: notif.body,
                    target: notif.target,
                    targetValue: notif.target_value,
                    successCount: notif.success_count,
                    failureCount: notif.failure_count,
                    createdAt: notif.created_at,
                    sentBy: "admin",
                })),
                notificationTrend,
            },
        });
    } catch (error) {
        console.error("Get notification stats error:", error);
        return NextResponse.json(
            { error: "Failed to fetch notification stats" },
            { status: 500 }
        );
    }
}
