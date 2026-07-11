import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = await createServerSupabaseClient();
  const schoolId = permission.schoolId;

  try {
    const [
      { data: payments },
      { data: settings },
      { data: teachers },
    ] = await Promise.all([
      supabase
        .from("teacher_payroll_payments")
        .select("amount, status")
        .eq("school_id", schoolId),
      supabase
        .from("teacher_payroll_settings")
        .select("salary_amount, teacher_id")
        .eq("school_id", schoolId)
        .eq("is_active", true),
      supabase
        .from("teachers")
        .select("id, paystack_subaccount_code")
        .eq("school_id", schoolId)
        .eq("status", "active"),
    ]);

    const totalPaid = (payments || [])
      .filter((p) => p.status === "success")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const pendingPayments = (payments || []).filter((p) => p.status === "pending").length;
    const totalSalaryBudget = (settings || []).reduce((sum, s) => sum + Number(s.salary_amount || 0), 0);
    const teachersWithSubaccount = (teachers || []).filter((t) => t.paystack_subaccount_code).length;
    const totalTeachers = teachers?.length || 0;
    const configuredTeachers = settings?.length || 0;

    return successResponse({
      totalPaid,
      pendingPayments,
      totalPayments: payments?.length || 0,
      totalSalaryBudget,
      teachersWithSubaccount,
      teachersConfigured: configuredTeachers,
      totalActiveTeachers: totalTeachers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch overview";
    return errorResponse(message, 500);
  }
}
