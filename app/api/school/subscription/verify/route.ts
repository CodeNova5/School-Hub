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
    const txMetadata = tx.metadata as Record<string, unknown> || {};
    const selectedTermId = txMetadata.selected_term_id as string | null;
    const selectedTermIds = txMetadata.selected_term_ids as string[] | null;

    // Use the selected term(s) (from checkout) or fall back to current term
    let termForBilling: { id: string; end_date: string; name?: string; session_id?: string } | null = null;

    if (tx.billing_interval === "termly" && selectedTermId) {
      // Fetch the term the user selected during checkout
      const { data: selectedTerm } = await supabaseAdmin
        .from("terms")
        .select("id, session_id, end_date, name")
        .eq("id", selectedTermId)
        .maybeSingle();
      termForBilling = selectedTerm;
    }

    // Fallback: get the current active term
    if (!termForBilling) {
      const { data: currentTerm } = await supabaseAdmin
        .from("terms")
        .select("id, session_id, end_date")
        .eq("school_id", tx.school_id)
        .eq("is_current", true)
        .maybeSingle();
      termForBilling = currentTerm;
    }

    // ── Yearly rollover: allocate 3 terms when upgrading from termly ──
    // If the subscriber was termly and paid yearly, the yearly payment
    // covers 3 terms (remaining terms in current session + next session).
    // Set current_term_id to the LAST covered term so banners naturally
    // defer to whatever comes after it.
    let yearlyAllocatedTerms: { id: string; name: string; session_name: string; start_date: string; end_date: string }[] | null = null;
    let billingTermId = termForBilling?.id || null;
    let billingPeriodEnd: Date;

    if (tx.billing_interval === "yearly") {
      // If user selected specific terms from checkout (3 terms ahead), use those
      if (selectedTermIds && selectedTermIds.length > 0) {
        const { data: selectedTerms } = await supabaseAdmin
          .from("terms")
          .select(`
            id,
            name,
            start_date,
            end_date,
            session_id,
            sessions!inner(name)
          `)
          .in("id", selectedTermIds)
          .order("start_date", { ascending: true });

        if (selectedTerms && selectedTerms.length > 0) {
          yearlyAllocatedTerms = selectedTerms.slice(0, 3).map((t: any) => ({
            id: t.id,
            name: t.name,
            session_name: (t as any).sessions?.name || "",
            start_date: t.start_date,
            end_date: t.end_date,
          }));

          billingTermId = yearlyAllocatedTerms[yearlyAllocatedTerms.length - 1].id;
          billingPeriodEnd = new Date(yearlyAllocatedTerms[yearlyAllocatedTerms.length - 1].end_date);
        } else {
          billingPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
      } else {
        // Fallback: check if the subscriber was previously on termly — fetch their existing subscription
        const { data: existingSub } = await supabaseAdmin
          .rpc("get_school_subscription", { p_school_id: tx.school_id });
        const existing = Array.isArray(existingSub) ? existingSub[0] : existingSub;
        const wasTermly = existing?.billing_interval === "termly" && existing?.current_term_id;

        if (wasTermly) {
          // Fetch the next 3 terms after the current one
          const { data: currentTermData } = await supabaseAdmin
            .from("terms")
            .select("end_date")
            .eq("id", existing.current_term_id)
            .maybeSingle();

          if (currentTermData) {
            const { data: upcomingTerms } = await supabaseAdmin
              .from("terms")
              .select(`
                id,
                name,
                start_date,
                end_date,
                session_id,
                sessions!inner(name)
              `)
              .eq("school_id", tx.school_id)
              .gt("start_date", currentTermData.end_date)
              .order("start_date", { ascending: true })
              .limit(3);

            if (upcomingTerms && upcomingTerms.length > 0) {
              const allocated = upcomingTerms.slice(0, 3).map((t: any) => ({
                id: t.id,
                name: t.name,
                session_name: (t as any).sessions?.name || "",
                start_date: t.start_date,
                end_date: t.end_date,
              }));

              yearlyAllocatedTerms = allocated;
              // Set current_term_id to the LAST term in the allocation
              billingTermId = allocated[allocated.length - 1].id;
              // Period ends at the end of the last allocated term
              billingPeriodEnd = new Date(allocated[allocated.length - 1].end_date);
            } else {
              billingPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            }
          } else {
            billingPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          }
        } else {
          // Standard yearly (no upgrade) — 365 days
          billingPeriodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        }
      }
    } else {
      // Termly billing — period ends at term end
      billingPeriodEnd = termForBilling
        ? new Date(termForBilling.end_date)
        : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);
    }

    // Calculate next billing date
    let nextBillingDate: Date;
    if (tx.billing_interval === "termly" && termForBilling) {
      nextBillingDate = new Date(termForBilling.end_date);
      nextBillingDate.setDate(nextBillingDate.getDate() + 3);
    } else {
      // Yearly: 1 year from now
      nextBillingDate = new Date();
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    // Build metadata with allocation info
    const txMeta = tx.metadata as Record<string, unknown> || {};
    const updatedMetadata = {
      ...txMeta,
      paystack_authorization: verifyData.data.authorization,
      paystack_customer: verifyData.data.customer,
      ...(yearlyAllocatedTerms ? { yearly_covered_terms: yearlyAllocatedTerms } : {}),
    };

    // Update transaction with metadata
    await supabaseAdmin
      .from("school_subscription_transactions")
      .update({ metadata: updatedMetadata })
      .eq("id", tx.id);

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
      p_current_period_end: billingPeriodEnd.toISOString(),
      p_auth_code: authCode,
      p_customer_email: customerEmail,
      p_paystack_customer_code: customerCode,
      p_next_billing_date: nextBillingDate.toISOString(),
      p_current_term_id: billingTermId,
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
