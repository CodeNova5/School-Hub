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

async function handlePayrollPayment(reference: string, nextStatus: string, paidAt: string | null) {
  // Check if this reference belongs to a teacher payroll payment
  const { data: payrollPayment } = await supabaseAdmin
    .from("teacher_payroll_payments")
    .select("id, school_id, teacher_id, amount, status")
    .eq("reference", reference)
    .maybeSingle();

  if (!payrollPayment) {
    return false; // Not a payroll payment
  }

  console.log("=== PAYSTACK WEBHOOK - PAYROLL PAYMENT ===");
  console.log("Payroll Payment ID:", payrollPayment.id);
  console.log("Reference:", reference);
  console.log("Current status:", payrollPayment.status);
  console.log("New status:", nextStatus);

  const mappedStatus = nextStatus === "success" ? "success"
    : nextStatus === "failed" ? "failed"
    : nextStatus === "abandoned" ? "cancelled"
    : nextStatus;

  await supabaseAdmin
    .from("teacher_payroll_payments")
    .update({
      status: mappedStatus,
      paid_at: mappedStatus === "success" ? paidAt || new Date().toISOString() : null,
    })
    .eq("id", payrollPayment.id);

  console.log("✓ Payroll payment updated to:", mappedStatus);
  return true;
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

  let nextStatus: "success" | "failed" | "abandoned" | "pending" | "reversed" = "pending";

  if (payload.event === "charge.success") {
    nextStatus = "success";
  } else if (payload.event === "charge.failed") {
    nextStatus = "failed";
  } else if (payload.event === "charge.abandoned") {
    nextStatus = "abandoned";
  }

  // ── Try payroll payment first ──
  const isPayroll = await handlePayrollPayment(
    reference,
    nextStatus,
    nextStatus === "success" ? payload.data?.paid_at || new Date().toISOString() : null
  );

  if (isPayroll) {
    return NextResponse.json({ success: true });
  }

  // ── School subscription payment handling ──
  // Check if this reference belongs to a school subscription transaction
  // Subscription references start with 'SUB-'
  if (reference.startsWith('SUB-')) {
    const { data: subTx } = await supabaseAdmin
      .from("school_subscription_transactions")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (subTx) {
      console.log("=== PAYSTACK WEBHOOK - SUBSCRIPTION PAYMENT ===");
      console.log("Reference:", reference);
      console.log("School ID:", subTx.school_id);
      console.log("Plan ID:", subTx.plan_id);
      console.log("Billing Interval:", subTx.billing_interval);
      console.log("Event:", payload.event);

      if (nextStatus === "success") {
        // Extract auth code from payload
        const eventData = payload.data as any;
        const authCode = eventData?.authorization?.authorization_code || null;
        const customerCode = eventData?.customer?.customer_code || null;
        const customerEmail = eventData?.customer?.email || '';

        // Update transaction
        await supabaseAdmin
          .from("school_subscription_transactions")
          .update({
            status: 'success',
            auth_code: authCode,
            paid_at: payload.data?.paid_at || new Date().toISOString(),
            metadata: {
              ...((subTx.metadata as Record<string, unknown>) || {}),
              webhook_authorization: eventData?.authorization,
              webhook_customer: eventData?.customer,
            },
          })
          .eq("id", subTx.id);

        // Get the current academic term for this school
        const { data: currentTerm } = await supabaseAdmin
          .from("terms")
          .select("id, end_date")
          .eq("school_id", subTx.school_id)
          .eq("is_current", true)
          .maybeSingle();

        // Calculate next billing date
        let nextBillingDate: Date;
        if (subTx.billing_interval === 'termly' && currentTerm) {
          nextBillingDate = new Date(currentTerm.end_date);
          nextBillingDate.setDate(nextBillingDate.getDate() + 3);
        } else if (subTx.billing_interval === 'yearly') {
          nextBillingDate = new Date();
          nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
        } else {
          nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 4);
        }

        // Period end
        const periodEnd = subTx.billing_interval === 'yearly'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : currentTerm
            ? new Date(currentTerm.end_date)
            : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

        // Upsert school subscription
        await supabaseAdmin.rpc('upsert_school_subscription', {
          p_school_id: subTx.school_id,
          p_plan_id: subTx.plan_id,
          p_billing_interval: subTx.billing_interval,
          p_status: 'active',
          p_current_period_start: new Date().toISOString(),
          p_current_period_end: periodEnd.toISOString(),
          p_auth_code: authCode,
          p_customer_email: customerEmail,
          p_paystack_customer_code: customerCode,
          p_next_billing_date: nextBillingDate.toISOString(),
          p_current_term_id: currentTerm?.id || null,
        });

        // Update the school's plan
        const { data: plan } = await supabaseAdmin
          .from('subscription_plans')
          .select('plan_key')
          .eq('id', subTx.plan_id)
          .single();

        if (plan) {
          await supabaseAdmin
            .from('schools')
            .update({ plan: plan.plan_key, updated_at: new Date().toISOString() })
            .eq('id', subTx.school_id);
        }

        console.log("✓ School subscription activated for school:", subTx.school_id);
      } else {
        // Failed or abandoned
        await supabaseAdmin
          .from("school_subscription_transactions")
          .update({ status: nextStatus })
          .eq("id", subTx.id);
      }

      return NextResponse.json({ success: true });
    }
  }

  // ── Student finance transaction handling (existing) ──
  const { data: transaction } = await supabaseAdmin
    .from("finance_transactions")
    .select("id, school_id, bill_id, student_id, amount")
    .eq("reference", reference)
    .maybeSingle();

  if (!transaction) {
    return NextResponse.json({ success: true });
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
    console.log("=== PAYSTACK WEBHOOK - SUCCESS (Student Payment) ===");
    console.log("Reference:", reference);
    console.log("Transaction ID:", transaction.id);
    console.log("Bill ID:", transaction.bill_id);

    await ensureReceipt(
      transaction.school_id,
      transaction.id,
      transaction.bill_id,
      transaction.student_id,
      Number(transaction.amount || 0),
      reference
    );
    console.log("✓ Receipt ensured");

    // Update bill amounts and status after successful payment (admin operation)
    const { data: billData, error: billFetchError } = await supabaseAdmin
      .from("finance_student_bills")
      .select("id, total_amount, amount_paid")
      .eq("id", transaction.bill_id)
      .limit(1);

    if (billFetchError) {
      console.error("Webhook: Bill fetch error:", billFetchError);
    }

    console.log("Webhook: Bill data fetched:", billData);

    if (billData && billData.length > 0) {
      const bill = billData[0];
      console.log("Webhook: Current bill:", bill);
      
      // Get all successful transactions for this bill
      const { data: successfulTxs, error: txFetchError } = await supabaseAdmin
        .from("finance_transactions")
        .select("amount")
        .eq("bill_id", transaction.bill_id)
        .eq("status", "success");

      if (txFetchError) {
        console.error("Webhook: Success transactions fetch error:", txFetchError);
      }

      console.log("Webhook: Successful transactions:", successfulTxs);

      const totalPaid = (successfulTxs || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const balanceAmount = Number(bill.total_amount || 0) - totalPaid;
      
      // Determine new bill status
      let newStatus = "pending";
      if (balanceAmount <= 0 && Number(bill.total_amount || 0) > 0) {
        newStatus = "paid";
      } else if (totalPaid > 0) {
        newStatus = "partial";
      }

      console.log("Webhook: Bill update payload:", {
        amount_paid: totalPaid,
        balance_amount: Math.max(0, balanceAmount),
        status: newStatus,
      });

      // Update bill with new amounts and status
      const { error: billUpdateError } = await supabaseAdmin
        .from("finance_student_bills")
        .update({
          amount_paid: totalPaid,
          balance_amount: Math.max(0, balanceAmount),
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction.bill_id);

      if (billUpdateError) {
        console.error("✗ Webhook: Bill update error:", billUpdateError);
      } else {
        console.log("✓ Webhook: Bill updated successfully");
      }
    } else {
      console.warn("Webhook: No bill found for ID:", transaction.bill_id);
    }
  }

  return NextResponse.json({ success: true });
}
