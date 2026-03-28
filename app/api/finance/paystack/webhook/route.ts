import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

interface PaystackWebhookEvent {
  event: string;
  data?: {
    reference?: string;
    status?: "success" | "failed" | "abandoned";
    paid_at?: string;
  };
}

function formatSequence(value: number) {
  return value.toString().padStart(6, "0");
}

async function ensureReceipt(schoolId: string, transactionId: string, billId: string, studentId: string, amount: number, reference: string) {
  const { data: existing } = await supabaseAdmin
    .from("finance_receipts")
    .select("id")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { data: settings } = await supabaseAdmin
    .from("finance_settings")
    .select("receipt_prefix")
    .eq("school_id", schoolId)
    .maybeSingle();

  const { count } = await supabaseAdmin
    .from("finance_receipts")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  const receiptPrefix = settings?.receipt_prefix || "RCP";
  const receiptNumber = `${receiptPrefix}-${formatSequence((count || 0) + 1)}`;

  await supabaseAdmin
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
          payment_method: "paystack",
          reference,
        },
      },
      { onConflict: "transaction_id" }
    );
}

export async function POST(req: Request) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return NextResponse.json({ error: "PAYSTACK_SECRET_KEY is not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-paystack-signature") || "";
  const rawBody = await req.text();

  const expectedSignature = crypto
    .createHmac("sha512", paystackSecret)
    .update(rawBody)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as PaystackWebhookEvent;
  const reference = payload.data?.reference;

  if (!reference) {
    return NextResponse.json({ success: true });
  }

  const { data: transaction } = await supabaseAdmin
    .from("finance_transactions")
    .select("id, school_id, bill_id, student_id, amount")
    .eq("reference", reference)
    .maybeSingle();

  if (!transaction) {
    return NextResponse.json({ success: true });
  }

  let nextStatus: "success" | "failed" | "abandoned" | "pending" | "reversed" = "pending";

  if (payload.event === "charge.success") {
    nextStatus = "success";
  } else if (payload.event === "charge.failed") {
    nextStatus = "failed";
  } else if (payload.event === "charge.abandoned") {
    nextStatus = "abandoned";
  }

  await supabaseAdmin
    .from("finance_transactions")
    .update({
      status: nextStatus,
      paid_at: nextStatus === "success" ? payload.data?.paid_at || new Date().toISOString() : null,
      provider_reference: reference,
    })
    .eq("id", transaction.id);

  if (nextStatus === "success") {
    await ensureReceipt(
      transaction.school_id,
      transaction.id,
      transaction.bill_id,
      transaction.student_id,
      Number(transaction.amount || 0),
      reference
    );
  }

  return NextResponse.json({ success: true });
}
