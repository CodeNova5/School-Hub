import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  sendPaymentFailureAlert,
  sendPaymentSuccessConfirmation,
  sendSuperAdminAtRiskAlert,
  sendSubscriptionDowngradedAlert,
  sendRenewalReminder,
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

interface ExpiredGraceSchool {
  school_id: string;
  school_name: string;
  school_email: string;
  grace_ended_at: string;
}

interface ExpiredGrant {
  grant_id: string;
  school_id: string;
  school_name: string;
  plan_key: string;
  expired_at: string;
}

interface SchoolDueForReminder {
  school_id: string;
  school_name: string;
  plan_key: string;
  billing_interval: string;
  next_billing_date: string;
  auth_code: string | null;
  status: string;
}

interface PaystackChargeResponse {
  status: boolean;
  message: string;
  data?: {
    reference: string;
    status: string;
    amount: number;
    gateway_response: string;
    authorization?: { authorization_code: string };
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      queue: true,
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

async function handleFailedCharge(school: SchoolDueForBilling): Promise<void> {
  await supabaseAdmin.rpc("expire_school_subscription", {
    p_school_id: school.school_id,
    p_grace_days: 7,
  });
}

// ===========================================================================
// Task 1: charge-subscriptions — charge stored auth codes for due renewals
// ===========================================================================

async function runChargeSubscriptions(): Promise<{
  results: any[];
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}> {
  const results: any[] = [];
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackSecret) {
    console.warn("[daily-maintenance] PAYSTACK_SECRET_KEY not set — skipping billing charges");
    return { results: [{ task: "charge-subscriptions", skipped: true, reason: "PAYSTACK_SECRET_KEY not set" }], processed: 0, succeeded: 0, failed: 0, skipped: 1 };
  }

  const { data: schoolsDue } = await supabaseAdmin.rpc("get_schools_due_for_billing");
  const schools = (schoolsDue ?? []) as SchoolDueForBilling[];

  if (schools.length === 0) {
    console.log("[daily-maintenance] No schools due for billing");
    return { results: [], processed: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  console.log(`[daily-maintenance] Charging ${schools.length} school(s) due for billing`);

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    if (i > 0) await sleep(100);

    processed++;

    if (!school.auth_code) {
      skipped++;
      results.push({ task: "charge", school_id: school.school_id, school_name: school.school_name, status: "skipped", error: "No stored authorization code" });
      continue;
    }

    const reference = generateReference();
    const amountInKobo = Math.round(Number(school.amount) * 100);

    // Create pending transaction (non-fatal)
    try {
      await supabaseAdmin.from("school_subscription_transactions").insert({
        school_id: school.school_id, plan_id: school.plan_id,
        billing_interval: school.billing_interval, reference,
        amount: school.amount, status: "pending",
        metadata: { source: "daily-maintenance", auth_code: school.auth_code },
      });
    } catch (_) {}

    const chargeResult = await chargeAuthorization(
      paystackSecret, school.auth_code,
      school.customer_email || school.school_email, amountInKobo, reference
    );

    // Update transaction
    try {
      await supabaseAdmin.from("school_subscription_transactions").update({
        status: chargeResult.success ? "success" : "failed",
        paid_at: chargeResult.success ? new Date().toISOString() : null,
        metadata: { source: "daily-maintenance", gateway_response: chargeResult.gatewayResponse },
      }).eq("reference", reference);
    } catch (_) {}

    if (chargeResult.success) {
      await handleSuccessfulCharge(school).catch(() => {});
      succeeded++;
      sendPaymentSuccessConfirmation(school.school_id).catch(() => {});
    } else {
      await handleFailedCharge(school).catch(() => {});
      failed++;
      sendPaymentFailureAlert(school.school_id, chargeResult.gatewayResponse).catch(() => {});
      sendSuperAdminAtRiskAlert(school.school_id).catch(() => {});
    }

    results.push({
      task: "charge", school_id: school.school_id, school_name: school.school_name,
      plan_key: school.plan_key, amount: school.amount, reference,
      status: chargeResult.success ? "success" : "failed",
      gateway_response: chargeResult.gatewayResponse,
    });
  }

  return { results, processed, succeeded, failed, skipped };
}

// ===========================================================================
// Task 2: downgrade-expired — downgrade schools past their grace period
// ===========================================================================

async function runDowngradeExpired(): Promise<{
  results: any[];
  downgraded: number;
  failed: number;
}> {
  const results: any[] = [];
  let downgraded = 0;
  let failed = 0;

  const { data: expiredSchools } = await supabaseAdmin.rpc("get_expired_grace_period_schools");
  const schools = (expiredSchools ?? []) as ExpiredGraceSchool[];

  if (schools.length === 0) {
    return { results: [], downgraded: 0, failed: 0 };
  }

  console.log(`[daily-maintenance] Downgrading ${schools.length} school(s) past grace period`);

  for (const school of schools) {
    const { data: ok, error } = await supabaseAdmin.rpc("downgrade_school_to_basic", { p_school_id: school.school_id });

    if (error || !ok) {
      failed++;
      results.push({ task: "downgrade", school_id: school.school_id, school_name: school.school_name, status: "failed", error: error?.message || "Already on Basic" });
      continue;
    }

    downgraded++;
    results.push({ task: "downgrade", school_id: school.school_id, school_name: school.school_name, status: "downgraded" });
    sendSubscriptionDowngradedAlert(school.school_id).catch(() => {});
  }

  return { results, downgraded, failed };
}

// ===========================================================================
// Task 3: expire-plan-grants — expire manual grants that have ended
// ===========================================================================

async function runExpirePlanGrants(): Promise<{
  results: any[];
  expired: number;
  failed: number;
}> {
  const results: any[] = [];
  let expired = 0;
  let failed = 0;

  const { data: expiredGrants, error } = await supabaseAdmin.rpc("expire_past_plan_grants");

  if (error) {
    console.error(`[daily-maintenance] expire_past_plan_grants RPC error:`, error);
    return { results: [{ task: "expire-grants", status: "failed", error: error.message }], expired: 0, failed: 1 };
  }

  const grants = (expiredGrants ?? []) as ExpiredGrant[];

  if (grants.length === 0) {
    return { results: [], expired: 0, failed: 0 };
  }

  console.log(`[daily-maintenance] Expiring ${grants.length} plan grant(s)`);

  for (const grant of grants) {
    expired++;
    results.push({
      task: "expire-grant", grant_id: grant.grant_id,
      school_id: grant.school_id, school_name: grant.school_name,
      plan_key: grant.plan_key, status: "expired",
    });
  }

  return { results, expired, failed };
}

// ===========================================================================
// Task 4: subscription-reminders — send T-7 renewal reminder emails
// ===========================================================================

async function runSubscriptionReminders(): Promise<{
  results: any[];
  sent: number;
  skipped: number;
  failed: number;
}> {
  const results: any[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const sixDaysFromNow = new Date();
  sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);
  const eightDaysFromNow = new Date();
  eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

  const { data } = await supabaseAdmin
    .from("school_subscriptions")
    .select(`
      school_id, status, billing_interval, next_billing_date, auth_code,
      subscription_plans!inner(plan_key),
      schools!inner(name)
    `)
    .eq("status", "active")
    .not("auth_code", "is", null)
    .gte("next_billing_date", sixDaysFromNow.toISOString())
    .lte("next_billing_date", eightDaysFromNow.toISOString());

  const schools = (data ?? []).map((row: any) => ({
    school_id: row.school_id,
    school_name: row.schools?.name || "Unknown",
    plan_key: row.subscription_plans?.plan_key || "basic",
    billing_interval: row.billing_interval,
    next_billing_date: row.next_billing_date,
    auth_code: row.auth_code,
    status: row.status,
  })) as SchoolDueForReminder[];

  if (schools.length === 0) {
    return { results: [], sent: 0, skipped: 0, failed: 0 };
  }

  console.log(`[daily-maintenance] Sending ${schools.length} renewal reminder(s)`);

  for (const school of schools) {
    if (!school.auth_code) {
      skipped++;
      results.push({ task: "reminder", school_id: school.school_id, school_name: school.school_name, status: "skipped", error: "No payment method" });
      continue;
    }

    const err = await sendRenewalReminder(school.school_id);
    if (err) {
      failed++;
      results.push({ task: "reminder", school_id: school.school_id, school_name: school.school_name, status: "failed", error: err });
    } else {
      sent++;
      results.push({ task: "reminder", school_id: school.school_id, school_name: school.school_name, status: "sent" });
    }
  }

  return { results, sent, skipped, failed };
}

// ===========================================================================
// POST & GET /api/cron/daily-maintenance
// Consolidated daily cron — runs all maintenance tasks in sequence
// ===========================================================================

async function handleCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
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

  const startTime = Date.now();

  // ── Run all four tasks sequentially ──────────────────────────────────

  console.log("[daily-maintenance] Starting daily maintenance run...");

  const chargeResult = await runChargeSubscriptions();
  console.log(`[daily-maintenance] ✓ charge-subscriptions: ${chargeResult.succeeded} ok, ${chargeResult.failed} failed, ${chargeResult.skipped} skipped`);

  const downgradeResult = await runDowngradeExpired();
  console.log(`[daily-maintenance] ✓ downgrade-expired: ${downgradeResult.downgraded} downgraded, ${downgradeResult.failed} failed`);

  const expireGrantsResult = await runExpirePlanGrants();
  console.log(`[daily-maintenance] ✓ expire-plan-grants: ${expireGrantsResult.expired} expired, ${expireGrantsResult.failed} failed`);

  const reminderResult = await runSubscriptionReminders();
  console.log(`[daily-maintenance] ✓ subscription-reminders: ${reminderResult.sent} sent, ${reminderResult.skipped} skipped, ${reminderResult.failed} failed`);

  const duration = Date.now() - startTime;

  console.log(`[daily-maintenance] Complete — all tasks finished in ${duration}ms`);

  return NextResponse.json({
    success: true,
    duration_ms: duration,
    tasks: {
      charge_subscriptions: {
        processed: chargeResult.processed,
        succeeded: chargeResult.succeeded,
        failed: chargeResult.failed,
        skipped: chargeResult.skipped,
      },
      downgrade_expired: {
        total: downgradeResult.downgraded + downgradeResult.failed,
        downgraded: downgradeResult.downgraded,
        failed: downgradeResult.failed,
      },
      expire_plan_grants: {
        total: expireGrantsResult.expired + expireGrantsResult.failed,
        expired: expireGrantsResult.expired,
        failed: expireGrantsResult.failed,
      },
      subscription_reminders: {
        total: reminderResult.sent + reminderResult.skipped + reminderResult.failed,
        sent: reminderResult.sent,
        skipped: reminderResult.skipped,
        failed: reminderResult.failed,
      },
    },
    results: [
      ...chargeResult.results,
      ...downgradeResult.results,
      ...expireGrantsResult.results,
      ...reminderResult.results,
    ],
  });
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}
