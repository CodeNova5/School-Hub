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

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, school_id, first_name, last_name, student_id")
    .eq("user_id", user.id)
    .single();

  if (studentError || !student) {
    return errorResponse("Student profile not found", 404);
  }

  const { data: bills, error } = await supabase
    .from("finance_student_bills")
    .select(`
      *,
      finance_bill_items(*),
      finance_transactions(*),
      finance_receipts(*)
    `)
    .eq("school_id", student.school_id)
    .eq("student_id", student.id)
    .order("created_at", { ascending: false });

  if (error) {
    return errorResponse(error.message, 500);
  }

  const rows = bills || [];
  const totalDue = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalPaid = rows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
  const totalOutstanding = rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0);

  return successResponse({
    student,
    summary: {
      totalDue,
      totalPaid,
      totalOutstanding,
      billCount: rows.length,
    },
    bills: rows,
  });
}
