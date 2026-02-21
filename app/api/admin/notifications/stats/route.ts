import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

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


        // Get total notifications sent (from notification_logs or similar table)
        // For now, we'll use notification_tokens as a proxy
        const { count: totalTokens } = await supabase
            .from("notification_tokens")
            .select("*", { count: "exact" })
            .eq("is_active", true);

        // Get today's date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayString = today.toISOString();

        // Calculate stats
        const totalSent = 1250; // Mock data - in production this would come from a notifications_log table
        const todayCount = 12; // Mock data
        const successRate = 95.7; // Mock data
        const averageRecipientsPerNotification = 324; // Mock data

        // Mock recent notifications
        const recentNotifications = [
            {
                id: "notif-5",
                title: "Exam Results Published",
                body: "Final exam results for Term 1 have been published. Check your scores now.",
                target: "role",
                targetValue: "student",
                successCount: 450,
                failureCount: 12,
                createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
                sentBy: "admin",
            },
            {
                id: "notif-4",
                title: "Attendance Alert",
                body: "Your attendance is below 75%. Please improve your attendance to avoid suspension.",
                target: "role",
                targetValue: "student",
                successCount: 380,
                failureCount: 25,
                createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
                sentBy: "admin",
            },
            {
                id: "notif-3",
                title: "Class Timetable Updated",
                body: "The class timetable for SSS2 has been updated. Please check the new schedule.",
                target: "class",
                targetValue: "SSS2",
                successCount: 125,
                failureCount: 3,
                createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
                sentBy: "admin",
            },
            {
                id: "notif-2",
                title: "Parent Portal Available",
                body: "The parent portal is now available. Log in to track your child's progress.",
                target: "role",
                targetValue: "parent",
                successCount: 220,
                failureCount: 8,
                createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
                sentBy: "admin",
            },
            {
                id: "notif-1",
                title: "School Holiday Announcement",
                body: "School will be closed from December 20 to January 5 for the holiday break.",
                target: "all",
                successCount: 875,
                failureCount: 45,
                createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
                sentBy: "admin",
            },
        ];

        // Generate notification trend (last 7 days)
        const notificationTrend = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            notificationTrend.push({
                date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                sent: Math.floor(Math.random() * 30) + 5,
            });
        }

        return NextResponse.json({
            data: {
                totalSent,
                todayCount,
                successRate,
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
