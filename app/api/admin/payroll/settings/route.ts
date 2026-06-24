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

  // Get all teachers with their payroll settings
  const { data: teachers, error: teachersError } = await supabase
    .from("teachers")
    .select(`
      id,
      first_name,
      last_name,
      staff_id,
      email,
      phone,
      status,
      photo_url,
      specialization,
      paystack_subaccount_code,
      teacher_payroll_settings(id, salary_amount, is_active, created_at, updated_at)
    `)
    .eq("school_id", permission.schoolId)
    .order("first_name", { ascending: true });

  if (teachersError) {
    return errorResponse(teachersError.message, 500);
  }

  // Get payment totals per teacher
  const { data: paymentTotals } = await supabase
    .from("teacher_payroll_payments")
    .select("teacher_id, amount, status, paid_at")
    .eq("school_id", permission.schoolId)
    .eq("status", "success");

  const totalsByTeacher = new Map<string, number>();
  (paymentTotals || []).forEach((p: any) => {
    const current = totalsByTeacher.get(p.teacher_id) || 0;
    totalsByTeacher.set(p.teacher_id, current + Number(p.amount || 0));
  });

  const enrichedTeachers = (teachers || []).map((teacher: any) => {
    const payrollSettings = Array.isArray(teacher.teacher_payroll_settings)
      ? teacher.teacher_payroll_settings[0]
      : teacher.teacher_payroll_settings;

    return {
      id: teacher.id,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      staff_id: teacher.staff_id,
      email: teacher.email,
      phone: teacher.phone,
      status: teacher.status,
      photo_url: teacher.photo_url,
      specialization: teacher.specialization,
      paystack_subaccount_code: teacher.paystack_subaccount_code,
      salary_amount: payrollSettings?.salary_amount || 0,
      payroll_active: payrollSettings?.is_active ?? true,
      total_paid: totalsByTeacher.get(teacher.id) || 0,
    };
  });

  return successResponse(enrichedTeachers);
}

export async function PUT(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const body = await req.json();
  const { teacherId, salaryAmount, isActive } = body;

  if (!teacherId) {
    return errorResponse("teacherId is required", 400);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Upsert payroll settings
  const { data: settings, error } = await supabase
    .from("teacher_payroll_settings")
    .upsert(
      {
        school_id: permission.schoolId,
        teacher_id: teacherId,
        salary_amount: typeof salaryAmount === "number" ? salaryAmount : 0,
        is_active: typeof isActive === "boolean" ? isActive : true,
      },
      { onConflict: "school_id,teacher_id" }
    )
    .select("*")
    .single();

  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(settings);
}
