import { NextRequest, NextResponse } from "next/server";
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
        return { authorized: false, error: "Unauthorized", status: 401, schoolId: null };
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isAdmin) {
        return { authorized: false, error: "Forbidden", status: 403, schoolId: null };
    }

    // Get user's school_id
    const { data: schoolId } = await supabase.rpc("get_my_school_id");

    return { authorized: true, schoolId };
}

export async function GET(request: NextRequest) {
    try {
        // Check if user is admin and get school_id
        const authCheck = await checkIsAdmin();
        if (!authCheck.authorized) {
            return NextResponse.json(
                { error: authCheck.error || "Unauthorized" },
                { status: authCheck.status || 401 }
            );
        }

        if (!authCheck.schoolId) {
            return NextResponse.json(
                { error: "User is not assigned to a school" },
                { status: 403 }
            );
        }

        const schoolId = authCheck.schoolId;

        // Get total notifications sent for this school
        const { count: totalSent } = await supabaseAdmin
            .from("notification_logs")
            .select("*", { count: "exact" })
            .eq("school_id", schoolId);

        // Get today's count for this school
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayString = today.toISOString();

        const { count: todayCount } = await supabaseAdmin
            .from("notification_logs")
            .select("*", { count: "exact" })
            .eq("school_id", schoolId)
            .gte("created_at", todayString);

        // Get all notification logs for this school for calculations
        const { data: allNotifications, error: notifError } = await supabaseAdmin
            .from("notification_logs")
            .select("*")
            .eq("school_id", schoolId)
            .order("created_at", { ascending: false })
            .limit(100);

        if (notifError) {
            console.error("Error fetching notification logs:", notifError);
            throw notifError;
        }

        // Calculate success rate
        let totalSuccessCount = 0;
        let totalFailureCount = 0;
        let totalRecipientsCount = 0;

        if (allNotifications && allNotifications.length > 0) {
            allNotifications.forEach((notif: any) => {
                totalSuccessCount += notif.success_count || 0;
                totalFailureCount += notif.failure_count || 0;
                totalRecipientsCount += notif.total_recipients || 0;
            });
        }

        const successRate = totalRecipientsCount > 0 
            ? ((totalSuccessCount / totalRecipientsCount) * 100).toFixed(1)
            : 0;

        const averageRecipientsPerNotification = (totalSent || 0) > 0 
            ? Math.round(totalRecipientsCount / (totalSent || 1))
            : 0;

        // Format recent notifications for display
        const recentNotifications = (allNotifications || []).slice(0, 5).map((notif: any) => ({
            id: notif.id,
            title: notif.title,
            body: notif.body,
            target: notif.target,
            targetValue: notif.target_value,
            targetName: notif.target_name,
            successCount: notif.success_count || 0,
            failureCount: notif.failure_count || 0,
            createdAt: notif.created_at,
            sentBy: notif.sent_by,
        }));

        // Generate notification trend (last 7 days)
        const notificationTrend = [];
        const trendMap: Record<string, number> = {};

        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            trendMap[dateKey] = 0;
        }

        // Count notifications per day
        if (allNotifications && allNotifications.length > 0) {
            allNotifications.forEach((notif: any) => {
                const notifDate = new Date(notif.created_at);
                const dateKey = notifDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                if (notifDate.getTime() >= Date.now() - (7 * 24 * 60 * 60 * 1000)) {
                    trendMap[dateKey] = (trendMap[dateKey] || 0) + 1;
                }
            });
        }

        // Convert to array format
        for (const [date, sent] of Object.entries(trendMap)) {
            notificationTrend.push({ date, sent });
        }

        return NextResponse.json({
            data: {
                totalSent: totalSent || 0,
                todayCount: todayCount || 0,
                successRate: parseFloat(successRate as string) || 0,
                averageRecipientsPerNotification,
                recentNotifications,
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
