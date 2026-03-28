import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

interface InitializePayload {
  billId: string;
  amount?: number;
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

type StudentProfile = {
  id: string;
  user_id?: string | null;
  parent_email?: string | null;
  first_name?: string;
  last_name?: string;
};

function getSingleStudentRelation(value: unknown): StudentProfile | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as StudentProfile | undefined) ?? null;
  }

  if (typeof value === "object") {
    return value as StudentProfile;
  }

  return null;
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

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = (await req.json()) as InitializePayload;
  if (!body.billId) {
    return errorResponse("billId is required", 400);
  }

  const { data: bill, error: billError } = await supabase
    .from("finance_student_bills")
    .select(`
      id,
      school_id,
      student_id,
      balance_amount,
      students(id, user_id, first_name, last_name, parent_email)
    `)
    .eq("id", body.billId)
    .single();

  if (billError || !bill) {
    return errorResponse("Bill not found", 404);
  }

  const student = getSingleStudentRelation((bill as any).students);

  if (!student) {
    return errorResponse("Student profile not found for bill", 404);
  }

  const { data: parent } = await supabase
    .from("parents")
    .select("email")
    .eq("user_id", user.id)
    .maybeSingle();

  const isStudentOwner = student?.user_id === user.id;
  const isParentOwner = !!parent?.email && !!student?.parent_email && parent.email === student.parent_email;

  if (!isStudentOwner && !isParentOwner) {
    return errorResponse("Forbidden", 403);
  }

  const billBalance = Number(bill.balance_amount || 0);
  if (billBalance <= 0) {
    return errorResponse("This bill has no outstanding balance", 400);
  }

  const requestedAmount = Number(body.amount || billBalance);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return errorResponse("Invalid amount", 400);
  }

  const paymentAmount = Math.min(requestedAmount, billBalance);

  const { data: settings } = await supabase
    .from("finance_settings")
    .select("paystack_subaccount_code")
    .eq("school_id", bill.school_id)
    .maybeSingle();

  const reference = generateReference("PSTK");

  const callbackUrl = body.callbackUrl || `${req.nextUrl.origin}/student/finance?reference=${reference}`;

  const paystackPayload: Record<string, unknown> = {
    email: parent?.email || user.email,
    amount: Math.round(paymentAmount * 100),
    reference,
    callback_url: callbackUrl,
    metadata: {
      bill_id: bill.id,
      student_id: bill.student_id,
      school_id: bill.school_id,
      initiated_by: user.id,
      initiated_as: isParentOwner ? "parent" : "student",
    },
  };

  if (settings?.paystack_subaccount_code) {
    paystackPayload.subaccount = settings.paystack_subaccount_code;
  }

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

  const { error: txError } = await supabase
    .from("finance_transactions")
    .insert({
      school_id: bill.school_id,
      bill_id: bill.id,
      student_id: bill.student_id,
      reference,
      provider: "paystack",
      payment_method: "paystack",
      status: "pending",
      amount: paymentAmount,
      provider_reference: paystackData.data.reference,
      idempotency_key: reference,
      metadata: {
        access_code: paystackData.data.access_code,
        authorization_url: paystackData.data.authorization_url,
      },
      created_by: user.id,
    });

  if (txError) {
    return errorResponse(txError.message, 500);
  }

  return successResponse({
    authorizationUrl: paystackData.data.authorization_url,
    accessCode: paystackData.data.access_code,
    reference,
  });
}
