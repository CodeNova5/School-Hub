import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  // Get teacher profile with subaccount code
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id, school_id, first_name, last_name, email, phone, paystack_subaccount_code, bank_name, bank_code, account_number, account_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (teacherError || !teacher) {
    return errorResponse("Teacher profile not found", 404);
  }

  // Get payroll settings
  const { data: settings } = await supabase
    .from("teacher_payroll_settings")
    .select("*")
    .eq("school_id", teacher.school_id)
    .eq("teacher_id", teacher.id)
    .maybeSingle();

  // Get payment summary
  const { data: payments } = await supabase
    .from("teacher_payroll_payments")
    .select("amount, status, paid_at, created_at, period_label, reference, payment_method")
    .eq("school_id", teacher.school_id)
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const totalPaid = (payments || [])
    .filter((p) => p.status === "success")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingPayments = (payments || []).filter((p) => p.status === "pending").length;

  return successResponse({
    teacher: {
      id: teacher.id,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      email: teacher.email,
      phone: teacher.phone,
      paystack_subaccount_code: teacher.paystack_subaccount_code,
    },
    settings: settings || null,
    summary: {
      totalPaid,
      pendingPayments,
      totalPayments: payments?.length || 0,
    },
    recentPayments: payments || [],
  });
}
