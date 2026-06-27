import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: "success" | "failed" | "abandoned";
    paid_at?: string;
    amount: number;
    authorization?: {
      authorization_code: string;
      email: string;
    };
    customer?: {
      customer_code: string;
      email: string;
    };
  };
}

// ---------------------------------------------------------------------------
// GET /api/school/subscription/verify?reference=SUB-xxx
// Verifies a Paystack transaction for a school subscription purchase.
// On success, updates the school_subscription and school plan.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured" },
      { status: 500 }
    );
  }

  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the pending transaction from our DB
  const { data: tx } = await supabaseAdmin
    .from("school_subscription_transactions")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Verify with Paystack
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${paystackSecret}` },
    }
  );

  const verifyData = (await verifyRes.json()) as PaystackVerifyResponse;

  if (!verifyRes.ok || !verifyData.status || !verifyData.data) {
    return NextResponse.json(
      { error: verifyData.message || "Failed to verify payment" },
      { status: 400 }
    );
  }

  const mappedStatus = verifyData.data.status === "success" ? "success"
    : verifyData.data.status === "abandoned" ? "abandoned"
    : "failed";

  // Update transaction status
  await supabaseAdmin
    .from("school_subscription_transactions")
    .update({
      status: mappedStatus,
      auth_code: verifyData.data.authorization?.authorization_code || null,
      paid_at: mappedStatus === "success" ? verifyData.data.paid_at || new Date().toISOString() : null,
      metadata: {
        ...(tx.metadata as Record<string, unknown> || {}),
        paystack_authorization: verifyData.data.authorization,
        paystack_customer: verifyData.data.customer,
      },
    })
    .eq("id", tx.id);

  if (mappedStatus === "success") {
    // Get the current academic term for this school
    const { data: currentTerm } = await supabaseAdmin
      .from("terms")
      .select("id, session_id, end_date")
      .eq("school_id", tx.school_id)
      .eq("is_current", true)
      .maybeSingle();

    // Calculate next billing date based on interval
    let nextBillingDate: Date;
    if (tx.billing_interval === "termly" && currentTerm) {
      // Next billing = end of current term + 1 day (start of next term)
      nextBillingDate = new Date(currentTerm.end_date);
      nextBillingDate.setDate(nextBillingDate.getDate() + 3); // Small buffer
    } else if (tx.billing_interval === "yearly") {
      nextBillingDate = new Date();
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      // Default: next billing in 4 months (rough term length)
      nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 4);
    }

    // Calculate period end
    const periodEnd = tx.billing_interval === "yearly"
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : currentTerm
        ? new Date(currentTerm.end_date)
        : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000); // ~4 months for term

    // Upsert school subscription
    const authCode = verifyData.data.authorization?.authorization_code || null;
    const customerCode = verifyData.data.customer?.customer_code || null;
    const customerEmail = verifyData.data.customer?.email || "";

    await supabaseAdmin.rpc("upsert_school_subscription", {
      p_school_id: tx.school_id,
      p_plan_id: tx.plan_id,
      p_billing_interval: tx.billing_interval,
      p_status: "active",
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
      .from("subscription_plans")
      .select("plan_key")
      .eq("id", tx.plan_id)
      .single();

    if (plan) {
      await supabaseAdmin
        .from("schools")
        .update({ plan: plan.plan_key, updated_at: new Date().toISOString() })
        .eq("id", tx.school_id);
    }
  }

  return NextResponse.json({
    status: mappedStatus,
    transaction: tx,
    paystack: verifyData.data,
  });
}
