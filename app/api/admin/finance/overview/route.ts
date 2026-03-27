import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const schoolId = permission.schoolId;
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const [
      { data: bills },
      { data: successfulTransactions },
      { data: recentTransactions },
      { data: classBalances },
      { count: totalBills },
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch finance overview";
    return errorResponse(message, 500);
  }
}
