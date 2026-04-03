import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: "success" | "failed" | "abandoned";
    paid_at?: string;
    amount: number;
  };
}

type StudentRelation = {
  user_id?: string | null;
  parent_email?: string | null;
};

function getSingleStudentRelation(value: unknown): StudentRelation | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as StudentRelation | undefined) ?? null;
  }

  if (typeof value === "object") {
    return value as StudentRelation;
  }

  return null;
}

function formatSequence(value: number) {
  return value.toString().padStart(6, "0");
}

async function ensureReceipt(supabase: any, schoolId: string, transactionId: string, billId: string, studentId: string, amount: number, paymentMethod: string, reference: string) {
  // Use limit(1) instead of maybeSingle to avoid RLS coercion errors
  const { data: existingArray } = await supabase
    .from("finance_receipts")
    .select("id, receipt_number")
    .eq("transaction_id", transactionId)
    .limit(1);

  const existing = Array.isArray(existingArray) && existingArray.length > 0 ? existingArray[0] : null;

  if (existing) {
    return existing;
  }

  // Use limit(1) instead of maybeSingle to avoid RLS coercion errors
  const { data: settingsArray } = await supabase
    .from("finance_settings")
    .select("receipt_prefix")
    .eq("school_id", schoolId)
    .limit(1);

  const settings = Array.isArray(settingsArray) && settingsArray.length > 0 ? settingsArray[0] : null;

  const { count } = await supabase
    .from("finance_receipts")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  const receiptPrefix = settings?.receipt_prefix || "RCP";
  const receiptNumber = `${receiptPrefix}-${formatSequence((count || 0) + 1)}`;

  const { data: receiptArray, error } = await supabase
    .from("finance_receipts")
    .upsert(
      {
        school_id: schoolId,
        bill_id: billId,
        transaction_id: transactionId,
        student_id: studentId,
        receipt_number: receiptNumber,
        payload: {
          amount,
          payment_method: paymentMethod,
          reference,
        },
      } as any,
      { onConflict: "transaction_id" }
    )
    .select("id, receipt_number")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(receiptArray) && receiptArray.length > 0 ? receiptArray[0] : null;
}

export async function GET(req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return errorResponse("PAYSTACK_SECRET_KEY is not configured", 500);
  }

  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return errorResponse("reference is required", 400);
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse("Unauthorized", 401);
  }

  // Use order + limit instead of single to avoid RLS coercion errors
  const { data: transactionArray, error: txLookupError } = await supabase
    .from("finance_transactions")
    .select(`
      id,
      school_id,
      bill_id,
      student_id,
      amount,
      status,
      students(user_id, parent_email)
    `)
    .eq("reference", reference)
    .limit(1);

  if (txLookupError || !transactionArray || transactionArray.length === 0) {
    return errorResponse("Transaction not found", 404);
  }

  const transaction = transactionArray[0];

  const txStudent = getSingleStudentRelation((transaction as any).students);
  // Use limit(1) instead of maybeSingle to avoid RLS coercion errors
  const { data: parentArray } = await supabase
    .from("parents")
    .select("email")
    .eq("user_id", user.id)
    .limit(1);

  const parent = Array.isArray(parentArray) && parentArray.length > 0 ? parentArray[0] : null;

  const isStudentOwner = txStudent?.user_id === user.id;
  const isParentOwner = !!parent?.email && !!txStudent?.parent_email && parent.email === txStudent.parent_email;

  if (!isStudentOwner && !isParentOwner) {
    return errorResponse("Forbidden", 403);
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${paystackSecret}`,
    },
  });

  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;
  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return errorResponse(verifyData.message || "Failed to verify payment", 400);
  }

  const mappedStatus = verifyData.data.status === "success" ? "success" : verifyData.data.status === "abandoned" ? "abandoned" : "failed";

  const { error: updateError } = await supabase
    .from("finance_transactions")
    .update({
      status: mappedStatus,
      paid_at: mappedStatus === "success" ? verifyData.data.paid_at || new Date().toISOString() : null,
      provider_reference: verifyData.data.reference,
    })
    .eq("id", transaction.id);

  if (updateError) {
    return errorResponse(updateError.message || "Failed to update transaction", 500);
  }

  // Re-fetch the updated transaction to include in response
  const { data: updatedTxArray } = await supabase
    .from("finance_transactions")
    .select("*")
    .eq("id", transaction.id)
    .limit(1);

  const updatedTx = Array.isArray(updatedTxArray) && updatedTxArray.length > 0 ? updatedTxArray[0] : transaction;

  let receipt: { id: string; receipt_number: string } | null = null;
  if (mappedStatus === "success") {
    receipt = await ensureReceipt(
      supabase,
      transaction.school_id,
      transaction.id,
      transaction.bill_id,
      transaction.student_id,
      Number(transaction.amount || 0),
      "paystack",
      reference
    );
  }

  return successResponse({
    transaction: updatedTx,
    receipt,
    paystack: verifyData.data,
  });
}
