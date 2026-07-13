import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import {
  runChargeSubscriptions,
  runDowngradeExpired,
  runExpirePlanGrants,
  runSubscriptionReminders,
  runGrantExpiryReminders,
} from "@/lib/maintenance-tasks";

async function checkIsSuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" } as const;
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" } as const;
  return { ok: true } as const;
}

// ---------------------------------------------------------------------------
// POST /api/super-admin/maintenance
// Run one or all maintenance tasks manually (super admin only)
// Body: { task: "charge" | "downgrade" | "expire-grants" | "reminders" | "grant-reminders" | "all" }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json().catch(() => ({}));
    const task = body.task || "all";

    const validTasks = ["charge", "downgrade", "expire-grants", "reminders", "grant-reminders", "all"];
    if (!validTasks.includes(task)) {
      return NextResponse.json(
        { error: `Invalid task "${task}". Valid options: ${validTasks.join(", ")}` },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const results: Record<string, any> = {};

    if (task === "all" || task === "charge") {
      const chargeResult = await runChargeSubscriptions();
      results.charge_subscriptions = {
        processed: chargeResult.processed,
        succeeded: chargeResult.succeeded,
        failed: chargeResult.failed,
        skipped: chargeResult.skipped,
        details: chargeResult.results,
      };
    }

    if (task === "all" || task === "downgrade") {
      const downgradeResult = await runDowngradeExpired();
      results.downgrade_expired = {
        total: downgradeResult.downgraded + downgradeResult.failed,
        downgraded: downgradeResult.downgraded,
        failed: downgradeResult.failed,
        details: downgradeResult.results,
      };
    }

    if (task === "all" || task === "expire-grants") {
      const expireGrantsResult = await runExpirePlanGrants();
      results.expire_plan_grants = {
        total: expireGrantsResult.expired + expireGrantsResult.failed,
        expired: expireGrantsResult.expired,
        failed: expireGrantsResult.failed,
        details: expireGrantsResult.results,
      };
    }

    if (task === "all" || task === "reminders") {
      const reminderResult = await runSubscriptionReminders();
      results.subscription_reminders = {
        total: reminderResult.sent + reminderResult.skipped + reminderResult.failed,
        sent: reminderResult.sent,
        skipped: reminderResult.skipped,
        failed: reminderResult.failed,
        details: reminderResult.results,
      };
    }

    if (task === "all" || task === "grant-reminders") {
      const grantReminderResult = await runGrantExpiryReminders();
      results.grant_expiry_reminders = {
        total: grantReminderResult.sent + grantReminderResult.skipped + grantReminderResult.failed,
        sent: grantReminderResult.sent,
        skipped: grantReminderResult.skipped,
        failed: grantReminderResult.failed,
        details: grantReminderResult.results,
      };
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      task,
      duration_ms: duration,
      results,
    });
  } catch (err: any) {
    console.error("[super-admin/maintenance] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
