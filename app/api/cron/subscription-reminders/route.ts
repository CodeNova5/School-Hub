import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendRenewalReminder } from "@/lib/subscription-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReminderResult {
  school_id: string;
  school_name: string;
  plan_key: string;
  next_billing_date: string | null;
  status: "sent" | "skipped" | "failed";
  error?: string;
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

// ---------------------------------------------------------------------------
// RPC: Fetch schools with upcoming billing dates (T-7 days)
// This query finds active subscriptions with next_billing_date
// between 6 and 8 days from now (accounts for cron timing variance).
// ---------------------------------------------------------------------------

async function fetchSchoolsDueForReminder(): Promise<SchoolDueForReminder[]> {
  const sixDaysFromNow = new Date();
  sixDaysFromNow.setDate(sixDaysFromNow.getDate() + 6);

  const eightDaysFromNow = new Date();
  eightDaysFromNow.setDate(eightDaysFromNow.getDate() + 8);

  // Single query with joins — Supabase auto-detects FK relationships
  // school_subscriptions.school_id → schools.id
  // school_subscriptions.plan_id → subscription_plans.id
  const { data, error } = await supabaseAdmin
    .from("school_subscriptions")
    .select(`
      school_id,
      status,
      billing_interval,
      next_billing_date,
      auth_code,
      subscription_plans!inner(plan_key),
      schools!inner(name)
    `)
    .eq("status", "active")
    .not("auth_code", "is", null)
    .gte("next_billing_date", sixDaysFromNow.toISOString())
    .lte("next_billing_date", eightDaysFromNow.toISOString());

  if (error) {
    console.error("Failed to fetch schools due for reminders:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    school_id: row.school_id,
    school_name: row.schools?.name || "Unknown School",
    plan_key: row.subscription_plans?.plan_key || "basic",
    billing_interval: row.billing_interval,
    next_billing_date: row.next_billing_date,
    auth_code: row.auth_code,
    status: row.status,
  }));
}

// ---------------------------------------------------------------------------
// POST & GET /api/cron/subscription-reminders
//
// Called daily by a cron scheduler. Sends renewal reminder emails to
// school admins whose subscriptions are due for renewal in ~7 days.
//
// Protected by CRON_SECRET (same as charge-subscriptions cron).
// ---------------------------------------------------------------------------

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
  const results: ReminderResult[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const schools = await fetchSchoolsDueForReminder();

    if (schools.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No schools due for renewal reminders",
        sent: 0,
        skipped: 0,
        failed: 0,
        results: [],
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(`Reminders: Found ${schools.length} schools due for renewal reminder`);

    for (const school of schools) {
      // Only send reminders to schools with stored auth codes
      // (schools without auth codes need to re-subscribe via the checkout flow)
      if (!school.auth_code) {
        console.log(`Reminders: ${school.school_name} (${school.school_id}) — no auth code, skipping`);
        results.push({
          school_id: school.school_id,
          school_name: school.school_name,
          plan_key: school.plan_key,
          next_billing_date: school.next_billing_date,
          status: "skipped",
          error: "No stored payment method — school needs to re-subscribe",
        });
        skipped++;
        continue;
      }

      console.log(`Reminders: Sending renewal reminder to ${school.school_name} (${school.school_id})`);

      const error = await sendRenewalReminder(school.school_id);

      if (error) {
        console.error(`Reminders: Failed to send to ${school.school_name}:`, error);
        results.push({
          school_id: school.school_id,
          school_name: school.school_name,
          plan_key: school.plan_key,
          next_billing_date: school.next_billing_date,
          status: "failed",
          error,
        });
        failed++;
      } else {
        results.push({
          school_id: school.school_id,
          school_name: school.school_name,
          plan_key: school.plan_key,
          next_billing_date: school.next_billing_date,
          status: "sent",
        });
        sent++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `Reminders: Complete — ${sent} sent, ${failed} failed, ${skipped} skipped in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${schools.length} schools (${sent} sent, ${failed} failed, ${skipped} skipped)`,
      sent,
      failed,
      skipped,
      results,
      duration_ms: duration,
    });
  } catch (err: any) {
    console.error("Reminders: Unhandled error:", err.message);
    return NextResponse.json(
      {
        error: err.message || "Unknown error",
        sent,
        failed,
        skipped,
        results,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}
