import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

interface CreateTransactionPayload {
  billId: string;
  studentId: string;
  amount: number;
  paymentMethod: "paystack" | "bank_transfer" | "cash" | "card" | "manual";
  provider?: "paystack" | "manual";
  status?: "pending" | "success" | "failed" | "abandoned" | "reversed";
  reference?: string;
  providerReference?: string;
}

function generateReference(prefix: string) {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

function formatSequence(value: number) {
  return value.toString().padStart(6, "0");
}

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  const status = req.nextUrl.searchParams.get("status");
  const supabase = createRouteHandlerClient({ cookies });

  let query = supabase
    .from("finance_transactions")
    .select(`
      *,
      students(first_name, last_name, student_id),
      finance_student_bills(due_date, status)
    `)
    .eq("school_id", permission.schoolId)
    .order("created_at", { ascending: false })
    .limit(200);

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

  const body = (await req.json()) as CreateTransactionPayload;
  if (!body.billId || !body.studentId || !body.paymentMethod || typeof body.amount !== "number") {
    return errorResponse("Missing transaction fields", 400);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("finance_settings")
    .select("receipt_prefix")
    .eq("school_id", permission.schoolId)
    .maybeSingle();

  const txReference = body.reference || generateReference("TXN");

  const { data: transaction, error: txError } = await supabase
    .from("finance_transactions")
    .insert({
      school_id: permission.schoolId,
      bill_id: body.billId,
      student_id: body.studentId,
      amount: body.amount,
      payment_method: body.paymentMethod,
      provider: body.provider || "manual",
      status: body.status || "success",
      reference: txReference,
      provider_reference: body.providerReference || null,
      idempotency_key: txReference,
      paid_at: (body.status || "success") === "success" ? new Date().toISOString() : null,
      created_by: user?.id || null,
    })
    .select("*")
    .single();

  if (txError || !transaction) {
    return errorResponse(txError?.message || "Failed to create transaction", 500);
  }

  let receipt: Record<string, unknown> | null = null;

  if (transaction.status === "success") {
    const receiptPrefix = settings?.receipt_prefix || "RCP";

    const { count } = await supabase
      .from("finance_receipts")
      .select("id", { count: "exact", head: true })
      .eq("school_id", permission.schoolId);

    const nextNumber = formatSequence((count || 0) + 1);
    const receiptNumber = `${receiptPrefix}-${nextNumber}`;

    const { data: createdReceipt, error: receiptError } = await supabase
      .from("finance_receipts")
      .insert({
        school_id: permission.schoolId,
        bill_id: body.billId,
        transaction_id: transaction.id,
        student_id: body.studentId,
        receipt_number: receiptNumber,
        payload: {
          amount: body.amount,
          payment_method: body.paymentMethod,
          reference: transaction.reference,
        },
      })
      .select("*")
      .single();

    if (receiptError) {
      return errorResponse(receiptError.message, 500);
    }

    receipt = createdReceipt as Record<string, unknown>;
  }

  return successResponse({ transaction, receipt }, 201);
}
