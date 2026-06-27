import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  sendPaymentFailureAlert,
  sendPaymentSuccessConfirmation,
} from "@/lib/subscription-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchoolDueForBilling {
  school_id: string;
  school_name: string;
  school_email: string;
  plan_id: string;
  plan_key: string;
  billing_interval: string;
  auth_code: string;
  customer_email: string;
  customer_code: string;
  amount: number;
}

interface ChargeResult {
  school_id: string;
  school_name: string;
  plan_key: string;
  amount: number;
  reference: string;
  status: "success" | "failed" | "skipped";
  gateway_response?: string;
  error?: string;
}

interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: string;
    amount: number;
    gateway_response: string;
    authorization?: {
      authorization_code: string;
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateReference(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SUB-CRON-${timestamp}-${random}`;
}

/**
 * Sleep for a given number of milliseconds.
 * Used to rate-limit bulk Paystack API calls (10 per second max recommended).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Charge a stored authorization code via Paystack's /transaction/charge_authorization.
 * Uses `queue: true` for off-session processing (recommended for bulk charges).
 */
async function chargeAuthorization(
  secret: string,
  authCode: string,
  email: string,
  amountInKobo: number,
  reference: string
): Promise<{ success: boolean; gatewayResponse: string; paystackRef: string }> {
  const res = await fetch("https://api.paystack.co/transaction/charge_authorization", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      authorization_code: authCode,
      email,
      amount: amountInKobo,
      reference,
      queue: true, // Off-session processing — ideal for bulk/batch charging
    }),
  });

  const data = (await res.json()) as PaystackChargeResponse;

  if (!data.status) {
    return { success: false, gatewayResponse: data.message || "Unknown error", paystackRef: "" };
  }

  return {
    success: data.data?.status === "success",
    gatewayResponse: data.data?.gateway_response || data.message || "Attempted",
    paystackRef: data.data?.reference || reference,
  };
}

/**
 * Handle a successful charge — update school subscription and plan.
 */
async function handleSuccessfulCharge(school: SchoolDueForBilling): Promise<void> {
  const { data: currentTerm } = await supabaseAdmin
    .from("terms")
    .select("id, end_date")
    .eq("school_id", school.school_id)
    .eq("is_current", true)
    .maybeSingle();

  let nextBillingDate: Date;
  if (school.billing_interval === "termly" && currentTerm) {
    nextBillingDate = new Date(currentTerm.end_date);
    nextBillingDate.setDate(nextBillingDate.getDate() + 3);
  } else if (school.billing_interval === "yearly") {
    nextBillingDate = new Date();
    nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
  } else {
    nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 4);
  }

  const periodEnd = school.billing_interval === "yearly"
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : currentTerm
      ? new Date(currentTerm.end_date)
      : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

  await supabaseAdmin.rpc("renew_school_subscription", {
    p_school_id: school.school_id,
    p_plan_id: school.plan_id,
    p_billing_interval: school.billing_interval,
    p_next_billing_date: nextBillingDate.toISOString(),
    p_current_term_id: currentTerm?.id || null,
  });

  await supabaseAdmin
    .from("schools")
    .update({ plan: school.plan_key, updated_at: new Date().toISOString() })
    .eq("id", school.school_id);
}

/**
 * Handle a failed charge — mark subscription as past_due with grace period.
 */
async function handleFailedCharge(school: SchoolDueForBilling): Promise<void> {
  await supabaseAdmin.rpc("expire_school_subscription", {
    p_school_id: school.school_id,
    p_grace_days: 7,
  });
}

// ---------------------------------------------------------------------------
// POST /api/cron/charge-subscriptions
//
// Called by a cron scheduler (e.g., Vercel Cron Jobs, GitHub Actions, cron-job.org).
// Protected by CRON_SECRET environment variable (send as Bearer token or x-api-key).
//
// Process:
// 1. Fetch schools with subscriptions due for billing (via get_schools_due_for_billing RPC)
// 2. For each school, create a pending transaction + charge the stored auth code
// 3. On success: renew subscription via renew_school_subscription RPC
// 4. On failure: mark as past_due with 7-day grace period via expire_school_subscription
// 5. Rate-limited to 10 req/s between Paystack calls
// ---------------------------------------------------------------------------

async function handleCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Cron endpoint not configured. Set CRON_SECRET environment variable." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("x-api-key") || "";
  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : apiKeyHeader;

  if (!providedSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured" },
      { status: 500 }
    );
  }

  const startTime = Date.now();
  const results: ChargeResult[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  try {
    const { data: schoolsDue, error: fetchError } = await supabaseAdmin
      .rpc("get_schools_due_for_billing");

    if (fetchError) {
      console.error("Failed to fetch schools due for billing:", fetchError);
      return NextResponse.json(
        { error: `Failed to fetch schools: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const schools = (schoolsDue ?? []) as SchoolDueForBilling[];

    if (schools.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No schools due for billing",
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        results: [],
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(`Cron: Processing ${schools.length} schools due for billing`);

    for (let i = 0; i < schools.length; i++) {
      const school = schools[i];

      if (i > 0) await sleep(100);

      processed++;

      if (!school.auth_code) {
        console.warn(`Cron: School ${school.school_id} (${school.school_name}) has no auth code — skipping`);
        results.push({
          school_id: school.school_id,
          school_name: school.school_name,
          plan_key: school.plan_key,
          amount: school.amount,
          reference: "",
          status: "skipped",
          error: "No stored authorization code",
        });
        skipped++;
        continue;
      }

      const reference = generateReference();
      const amountInKobo = Math.round(Number(school.amount) * 100);

      // Create a pending transaction record (non-fatal if it fails)
      try {
        await supabaseAdmin
          .from("school_subscription_transactions")
          .insert({
            school_id: school.school_id,
            plan_id: school.plan_id,
            billing_interval: school.billing_interval,
            reference,
            amount: school.amount,
            status: "pending",
            metadata: {
              source: "cron",
              auth_code: school.auth_code,
              customer_email: school.customer_email,
            },
          });
      } catch (err: any) {
        console.error(`Cron: Failed to create transaction record for ${school.school_id}:`, err.message);
      }

      console.log(
        `Cron: Charging ${school.school_name} (${school.school_id}) ` +
        `— ${school.plan_key} ${school.billing_interval} — ₦${school.amount}`
      );

      let chargeResult: { success: boolean; gatewayResponse: string; paystackRef: string };

      try {
        chargeResult = await chargeAuthorization(
          paystackSecret,
          school.auth_code,
          school.customer_email || school.school_email,
          amountInKobo,
          reference
        );
      } catch (err: any) {
        chargeResult = { success: false, gatewayResponse: "API call failed", paystackRef: "" };
        console.error(`Cron: API error for ${school.school_id}:`, err.message);
      }

      // Update transaction record with the result
      try {
        await supabaseAdmin
          .from("school_subscription_transactions")
          .update({
            status: chargeResult.success ? "success" : "failed",
            paid_at: chargeResult.success ? new Date().toISOString() : null,
            metadata: {
              source: "cron",
              auth_code: school.auth_code,
              customer_email: school.customer_email,
              gateway_response: chargeResult.gatewayResponse,
            },
          })
          .eq("reference", reference);
      } catch (err: any) {
        console.error(`Cron: Failed to update transaction for ${school.school_id}:`, err.message);
      }

      if (chargeResult.success) {
        try {
          await handleSuccessfulCharge(school);
          succeeded++;
          console.log(`Cron: ✓ ${school.school_name} — charged successfully`);
        } catch (err: any) {
          console.error(`Cron: Failed to update subscription for ${school.school_id}:`, err.message);
          succeeded++;
        }

        // Send success confirmation email (non-fatal if it fails)
        try {
          await sendPaymentSuccessConfirmation(school.school_id);
        } catch (err: any) {
          console.error(`Cron: Failed to send success email for ${school.school_id}:`, err.message);
        }
      } else {
        try {
          await handleFailedCharge(school);
          failed++;
          console.warn(`Cron: ✗ ${school.school_name} — charge failed: ${chargeResult.gatewayResponse}`);
        } catch (err: any) {
          console.error(`Cron: Failed to mark past_due for ${school.school_id}:`, err.message);
          failed++;
        }

        // Send payment failure alert email (non-fatal if it fails)
        try {
          await sendPaymentFailureAlert(school.school_id, chargeResult.gatewayResponse);
        } catch (err: any) {
          console.error(`Cron: Failed to send failure email for ${school.school_id}:`, err.message);
        }
      }

      results.push({
        school_id: school.school_id,
        school_name: school.school_name,
        plan_key: school.plan_key,
        amount: school.amount,
        reference,
        status: chargeResult.success ? "success" : "failed",
        gateway_response: chargeResult.gatewayResponse,
      });
    }

    const duration = Date.now() - startTime;
    console.log(
      `Cron: Complete — ${processed} processed, ${succeeded} succeeded, ` +
      `${failed} failed, ${skipped} skipped in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} schools (${succeeded} succeeded, ${failed} failed, ${skipped} skipped)`,
      processed,
      succeeded,
      failed,
      skipped,
      results,
      duration_ms: duration,
    });
  } catch (err: any) {
    console.error("Cron: Unhandled error:", err.message);
    return NextResponse.json(
      {
        error: err.message || "Unknown error",
        processed,
        succeeded,
        failed,
        skipped,
        results,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// ── Both POST and GET are supported for compatibility with different cron schedulers ──

export async function POST(req: NextRequest) {
  return handleCron(req);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}
