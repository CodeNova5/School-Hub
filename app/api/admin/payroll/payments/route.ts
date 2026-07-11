import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

function generateReference(prefix: string) {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

interface CreatePaymentPayload {
  teacherId: string;
  amount: number;
  periodLabel?: string;
  paymentMethod: "paystack" | "bank_transfer" | "cash" | "manual";
  notes?: string;
}

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = await createServerSupabaseClient();
  const teacherId = req.nextUrl.searchParams.get("teacherId");
  const status = req.nextUrl.searchParams.get("status");

  let query = supabase
    .from("teacher_payroll_payments")
    .select(`
      *,
      teachers(id, first_name, last_name, staff_id, email, photo_url, paystack_subaccount_code)
    `)
    .eq("school_id", permission.schoolId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message, 500);
  }

  return successResponse(data || []);
}

export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const body = (await req.json()) as CreatePaymentPayload;
  if (!body.teacherId || !body.amount || !body.paymentMethod) {
    return errorResponse("teacherId, amount, and paymentMethod are required", 400);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get teacher's subaccount code
  const { data: teacher } = await supabase
    .from("teachers")
    .select("paystack_subaccount_code")
    .eq("id", body.teacherId)
    .eq("school_id", permission.schoolId)
    .maybeSingle();

  const reference = generateReference("PAYROLL");

  const { data: payment, error: paymentError } = await supabase
    .from("teacher_payroll_payments")
    .insert({
      school_id: permission.schoolId,
      teacher_id: body.teacherId,
      amount: body.amount,
      period_label: body.periodLabel || "",
      status: "success",
      reference,
      subaccount_code: teacher?.paystack_subaccount_code || null,
      payment_method: body.paymentMethod,
      paid_at: new Date().toISOString(),
      notes: body.notes || "",
      created_by: user?.id || null,
    })
    .select("*")
    .single();

  if (paymentError || !payment) {
    return errorResponse(paymentError?.message || "Failed to create payment", 500);
  }

  return successResponse(payment, 201);
}
