import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = createRouteHandlerClient({ cookies });

  const { data, error } = await supabase
    .from("finance_receipts")
    .select(`
      *,
      students(first_name, last_name, student_id),
      finance_transactions(reference, amount, payment_method, status)
    `)
    .eq("school_id", permission.schoolId)
    .order("issued_at", { ascending: false })
    .limit(200);

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(data || []);
}
