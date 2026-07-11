import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, school_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!teacher) {
    return errorResponse("Teacher profile not found", 404);
  }

  const { data: payments, error } = await supabase
    .from("teacher_payroll_payments")
    .select("*")
    .eq("school_id", teacher.school_id)
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(payments || []);
}
