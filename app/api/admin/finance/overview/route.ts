import { createServerSupabaseClient } from "@/lib/supabase-server";

import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const schoolId = permission.schoolId;
  const supabase = await createServerSupabaseClient();

  try {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

    const [
      { data: bills },
      { data: successfulTransactions },
      { data: recentTransactions },
      { data: classBalances },
      { count: totalBills },
      { data: monthlyTx },
    ] = await Promise.all([
      supabase
        .from("finance_student_bills")
        .select("total_amount, amount_paid, balance_amount, status")
        .eq("school_id", schoolId),
      supabase
        .from("finance_transactions")
        .select("amount")
        .eq("school_id", schoolId)
        .eq("status", "success"),
      supabase
        .from("finance_transactions")
        .select("id, reference, amount, status, payment_method, created_at, students(first_name, last_name, student_id)")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("finance_student_bills")
        .select("class_id, balance_amount, classes(name)")
        .eq("school_id", schoolId),
      supabase
        .from("finance_student_bills")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabase
        .from("finance_transactions")
        .select("amount, created_at")
        .eq("school_id", schoolId)
        .eq("status", "success")
        .gte("created_at", twelveMonthsAgo)
        .order("created_at", { ascending: true }),
    ]);

    const billRows = bills || [];
    const txRows = successfulTransactions || [];
    const classRows = classBalances || [];

    const totalDue = billRows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
    const totalCollected = txRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalOutstanding = billRows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);

    const overdueCount = billRows.filter((row) => row.status === "overdue").length;
    const paidCount = billRows.filter((row) => row.status === "paid").length;
    const partialCount = billRows.filter((row) => row.status === "partial").length;

    // ── Build monthly trend ──
    const monthMap = new Map<string, { collected: number; count: number }>();
    // Initialise last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      monthMap.set(key, { collected: 0, count: 0 });
    }
    (monthlyTx || []).forEach((row: any) => {
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthMap.get(key);
      if (existing) {
        existing.collected += Number(row.amount || 0);
        existing.count += 1;
      }
    });
    const monthlyTrend = Array.from(monthMap.entries()).map(([key, val]) => ({
      month: key,
      label: new Date(key + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      collected: Math.round(val.collected * 100) / 100,
      transactions: val.count,
    }));

    // ── Outstanding by class ──
    const byClassMap = new Map<string, { className: string; outstanding: number }>();
    classRows.forEach((row) => {
      const classId = row.class_id || "unassigned";
      const className = (row.classes as { name?: string } | null)?.name || "Unassigned";
      const existing = byClassMap.get(classId);
      const current = Number(row.balance_amount || 0);

      if (existing) {
        existing.outstanding += current;
      } else {
        byClassMap.set(classId, { className, outstanding: current });
      }
    });

    const outstandingByClass = Array.from(byClassMap.values())
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 8);

    return successResponse({
      stats: {
        totalDue,
        totalCollected,
        totalOutstanding,
        overdueCount,
        totalBills: totalBills || 0,
        paidCount,
        partialCount,
      },
      recentTransactions: recentTransactions || [],
      outstandingByClass,
      monthlyTrend,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch finance overview";
    return errorResponse(message, 500);
  }
}
