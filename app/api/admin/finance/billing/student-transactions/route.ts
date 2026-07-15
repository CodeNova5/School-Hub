import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const studentId = req.nextUrl.searchParams.get("studentId");
  if (!studentId) {
    return errorResponse("studentId query parameter is required", 400);
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("finance_transactions")
    .select(`
      *,
      students(first_name, last_name, student_id),
      finance_student_bills(due_date, total_amount, status)
    `)
    .eq("school_id", permission.schoolId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(data || []);
}
