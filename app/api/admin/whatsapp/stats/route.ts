export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsAdmin() {
  const supabase = await createServerSupabaseClient();
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

  const { data: schoolId } = await supabase.rpc("get_my_school_id");
  return { authorized: true, user, schoolId };
}

export async function GET(_request: NextRequest) {
  try {
    const authCheck = await checkIsAdmin();

    if (!authCheck.authorized) {
      return NextResponse.json(
        { error: authCheck.error },
        { status: authCheck.status ?? 401 }
      );
    }

    const schoolId = authCheck.schoolId;

    if (!schoolId) {
      return NextResponse.json(
        { error: "User is not assigned to a school" },
        { status: 403 }
      );
    }

    // Fetch all WhatsApp logs for this school
    const { data: waLogs, error: logsError } = await supabaseAdmin
      .from("whatsapp_logs")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (logsError) {
      console.error("Error fetching whatsapp_logs:", logsError);
      throw logsError;
    }

    // ── Stats ─────────────────────────────────────────────────────────────────
    const totalSent = waLogs?.length ?? 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = (waLogs ?? []).filter((log: any) => {
      const d = new Date(log.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;

    let totalSuccessCount = 0;
    let totalRecipientsNeeded = 0;
    (waLogs ?? []).forEach((log: any) => {
      totalSuccessCount += log.success_count ?? 0;
      totalRecipientsNeeded += log.total_recipients ?? 0;
    });

    const successRate =
      totalRecipientsNeeded > 0
        ? (totalSuccessCount / totalRecipientsNeeded) * 100
        : 0;

    const averageRecipientsPerMessage =
      totalSent > 0 ? totalRecipientsNeeded / totalSent : 0;

    // ── 7-day Trend ───────────────────────────────────────────────────────────
    const whatsappTrend: Array<{ date: string; sent: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const dateStr = d.toISOString().split("T")[0];
      const count = (waLogs ?? []).filter((log: any) => {
        const logDate = new Date(log.created_at);
        logDate.setHours(0, 0, 0, 0);
        return logDate.getTime() === d.getTime();
      }).length;
      whatsappTrend.push({ date: dateStr, sent: count });
    }

    // ── Recent messages (last 10) ─────────────────────────────────────────────
    const recentMessages = ((waLogs ?? []).slice(0, 10) as any[]).map(
      (log) => ({
        id: log.id,
        title: log.title,
        body: log.body,
        target: log.target,
        targetValue: log.target_value,
        targetName: log.target_name,
        successCount: log.success_count ?? 0,
        failureCount: log.failure_count ?? 0,
        createdAt: log.created_at,
        sentBy: log.sent_by,
      })
    );

    return NextResponse.json(
      {
        data: {
          totalSent,
          todayCount,
          successRate: parseFloat(successRate.toFixed(1)),
          averageRecipientsPerMessage: Math.round(averageRecipientsPerMessage),
          recentMessages,
          whatsappTrend,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Error in whatsapp/stats endpoint:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch WhatsApp stats" },
      { status: 500 }
    );
  }
}
