import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface InitializePayload {
  teacherId: string;
  amount: number;
  periodLabel?: string;
  callbackUrl?: string;
}

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

function generateReference(prefix: string) {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function POST(req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = (await req.json()) as InitializePayload;
  if (!body.teacherId || !body.amount) {
    return errorResponse("teacherId and amount are required", 400);
  }

  // Get teacher details and subaccount code
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("id, first_name, last_name, email, paystack_subaccount_code")
    .eq("id", body.teacherId)
    .eq("school_id", permission.schoolId)
    .maybeSingle();

  if (teacherError || !teacher) {
    return errorResponse("Teacher not found", 404);
  }

  if (!teacher.paystack_subaccount_code) {
    return errorResponse(
      "This teacher has not set up their Paystack subaccount yet. They need to configure their bank details in their settings first.",
      400
    );
  }

  if (body.amount <= 0) {
    return errorResponse("Amount must be greater than 0", 400);
  }

  const reference = generateReference("PAYR");

  // Use admin email as payer email (or a fallback)
  const adminEmail = user?.email || "admin@school.com";
  const callbackUrl = body.callbackUrl || `${req.nextUrl.origin}/admin/payroll?reference=${reference}`;

  const paystackPayload: Record<string, unknown> = {
    email: adminEmail,
    amount: Math.round(body.amount * 100),
    reference,
    callback_url: callbackUrl,
    metadata: {
      payroll_payment: true,
      teacher_id: teacher.id,
      teacher_name: `${teacher.first_name} ${teacher.last_name}`,
      school_id: permission.schoolId,
      initiated_by: user?.id,
      period_label: body.periodLabel || "",
    },
  };

  // Route payment to teacher's subaccount
  paystackPayload.subaccount = teacher.paystack_subaccount_code;
  console.log("✓ Routing payroll to teacher subaccount:", teacher.paystack_subaccount_code);

  const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(paystackPayload),
  });

  const paystackData = (await paystackRes.json()) as PaystackInitializeResponse;
  if (!paystackRes.ok || !paystackData.status || !paystackData.data) {
    return errorResponse(paystackData.message || "Failed to initialize payment", 400);
  }

  // Create pending payroll payment record
  const { error: paymentError } = await supabase
    .from("teacher_payroll_payments")
    .insert({
      school_id: permission.schoolId,
      teacher_id: teacher.id,
      amount: body.amount,
      period_label: body.periodLabel || "",
      status: "pending",
      reference,
      subaccount_code: teacher.paystack_subaccount_code,
      payment_method: "paystack",
      notes: `Payroll payment initialized via Paystack checkout`,
      created_by: user?.id || null,
    });

  if (paymentError) {
    console.error("Failed to create payroll payment record:", paymentError);
    // Don't block the payment flow for this
  }

  return successResponse({
    authorizationUrl: paystackData.data.authorization_url,
    accessCode: paystackData.data.access_code,
    reference,
    teacher_name: `${teacher.first_name} ${teacher.last_name}`,
    subaccount: teacher.paystack_subaccount_code,
  });
}
