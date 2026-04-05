export const runtime = "nodejs";

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
        return { authorized: false, error: "Unauthorized", status: 401, user: null, schoolId: null };
    }

    const { data: isAdmin } = await supabase.rpc("is_admin");

    if (!isAdmin) {
        return { authorized: false, error: "Forbidden", status: 403, user: null, schoolId: null };
    }

    // Get user's school_id
    const { data: schoolId } = await supabase.rpc("get_my_school_id");

    return { authorized: true, user, schoolId };
}

export async function GET(request: NextRequest) {
    try {
        // Check if user is admin
        const authCheck = await checkIsAdmin();

        if (!authCheck.authorized) {
            return NextResponse.json(
                { error: authCheck.error },
                { status: authCheck.status }
            );
        }

        const schoolId = authCheck.schoolId;

        if (!schoolId) {
            return NextResponse.json(
                { error: "User is not assigned to a school" },
                { status: 403 }
            );
        }

        // Fetch all emails for this school
        const { data: emailLogs, error: logsError } = await supabaseAdmin
            .from("email_logs")
            .select("*")
            .eq("school_id", schoolId)
            .order("created_at", { ascending: false });

        if (logsError) {
            console.error("Error fetching email logs:", logsError);
            throw logsError;
        }

        // Calculate stats
        const totalSent = emailLogs?.length || 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayEmails = emailLogs?.filter((log: any) => {
            const createdAt = new Date(log.created_at);
            createdAt.setHours(0, 0, 0, 0);
            return createdAt.getTime() === today.getTime();
        }) || [];

        const todayCount = todayEmails.length;

        // Calculate success rate
        let totalSuccessCount = 0;
        let totalRecipientsNeeded = 0;
        emailLogs?.forEach((log: any) => {
            totalSuccessCount += log.success_count || 0;
            totalRecipientsNeeded += log.total_recipients || 0;
        });

        const successRate = totalRecipientsNeeded > 0 
            ? ((totalSuccessCount / totalRecipientsNeeded) * 100) 
            : 0;

        const averageRecipientsPerEmail = totalSent > 0 
            ? (totalRecipientsNeeded / totalSent) 
            : 0;

        // Get trend data (last 7 days)
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const recentEmails = emailLogs?.filter((log: any) => {
            return new Date(log.created_at) > last7Days;
        }) || [];

        const emailTrend: Array<{ date: string; sent: number }> = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const dateStr = date.toISOString().split('T')[0];
            const count = recentEmails.filter((log: any) => {
                const logDate = new Date(log.created_at);
                logDate.setHours(0, 0, 0, 0);
                return logDate.getTime() === date.getTime();
            }).length;

            emailTrend.push({ date: dateStr, sent: count });
        }

        // Get recent emails (limit to 10) with camelCase field mapping
        const recentEmailsList = (emailLogs?.slice(0, 10) || []).map((email: any) => ({
            id: email.id,
            title: email.title,
            body: email.body,
            target: email.target,
            targetValue: email.target_value,
            targetName: email.target_name,
            successCount: email.success_count || 0,
            failureCount: email.failure_count || 0,
            createdAt: email.created_at,
            sentBy: email.sent_by,
        }));

        return NextResponse.json(
            {
                data: {
                    totalSent,
                    todayCount,
                    successRate: parseFloat(successRate.toFixed(1)),
                    averageRecipientsPerEmail: Math.round(averageRecipientsPerEmail),
                    recentEmails: recentEmailsList,
                    emailTrend,
                }
            },
            { status: 200 }
        );

    } catch (error: any) {
        console.error("❌ Error in emails/stats endpoint:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to fetch email stats" },
            { status: 500 }
        );
    }
}
