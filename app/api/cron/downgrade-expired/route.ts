import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendSubscriptionDowngradedAlert } from "@/lib/subscription-email";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpiredGraceSchool {
  school_id: string;
  school_name: string;
  school_email: string;
  grace_ended_at: string;
}

interface DowngradeResult {
  school_id: string;
  school_name: string;
  status: "downgraded" | "skipped" | "failed";
  error?: string;
}

// ---------------------------------------------------------------------------
// GET / POST /api/cron/downgrade-expired
//
// Called by a cron scheduler (e.g., Vercel Cron Jobs, cron-job.org).
// Protected by CRON_SECRET environment variable.
//
// Process:
// 1. Fetch schools past their grace period (via get_expired_grace_period_schools)
// 2. For each school, call downgrade_school_to_basic RPC
// 3. Send a downgrade notification email to the school admin
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

  const startTime = Date.now();
  const results: DowngradeResult[] = [];
  let downgraded = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // 1. Fetch schools with expired grace periods
    const { data: expiredSchools, error: fetchError } = await supabaseAdmin
      .rpc("get_expired_grace_period_schools");

    if (fetchError) {
      console.error("Failed to fetch expired grace period schools:", fetchError);
      return NextResponse.json(
        { error: `Failed to fetch schools: ${fetchError.message}` },
        { status: 500 }
      );
    }

    const schools = (expiredSchools ?? []) as ExpiredGraceSchool[];

    if (schools.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No schools with expired grace periods found",
        downgraded: 0,
        skipped: 0,
        failed: 0,
        results: [],
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(`Cron (downgrade): Found ${schools.length} schools with expired grace periods`);

    // 2. Process each school
    for (const school of schools) {
      try {
        console.log(
          `Cron (downgrade): Processing ${school.school_name} (${school.school_id}) — ` +
          `grace ended ${school.grace_ended_at}`
        );

        // Call the downgrade RPC
        const { data: downgraded_ok, error: downgradeError } = await supabaseAdmin
          .rpc("downgrade_school_to_basic", { p_school_id: school.school_id });

        if (downgradeError) {
          throw new Error(downgradeError.message);
        }

        if (!downgraded_ok) {
          console.warn(
            `Cron (downgrade): ${school.school_name} — RPC returned false ` +
            `(may already be on Basic or no longer in grace period)`
          );
          results.push({
            school_id: school.school_id,
            school_name: school.school_name,
            status: "skipped",
            error: "Already downgraded or not in past_due status",
          });
          skipped++;
          continue;
        }

        console.log(`Cron (downgrade): ✓ ${school.school_name} — downgraded to Basic`);

        // Send downgrade email notification (non-fatal)
        try {
          await sendSubscriptionDowngradedAlert(school.school_id);
        } catch (emailErr: any) {
          console.error(
            `Cron (downgrade): Failed to send downgrade email for ${school.school_id}:`,
            emailErr.message
          );
        }

        results.push({
          school_id: school.school_id,
          school_name: school.school_name,
          status: "downgraded",
        });
        downgraded++;

      } catch (err: any) {
        console.error(
          `Cron (downgrade): ✗ ${school.school_name} — failed: ${err.message}`
        );
        results.push({
          school_id: school.school_id,
          school_name: school.school_name,
          status: "failed",
          error: err.message,
        });
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `Cron (downgrade): Complete — ${downgraded} downgraded, ${skipped} skipped, ` +
      `${failed} failed in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${schools.length} schools (${downgraded} downgraded, ${skipped} skipped, ${failed} failed)`,
      downgraded,
      skipped,
      failed,
      total: schools.length,
      results,
      duration_ms: duration,
    });
  } catch (err: any) {
    console.error("Cron (downgrade): Unhandled error:", err.message);
    return NextResponse.json(
      {
        error: err.message || "Unknown error",
        downgraded,
        skipped,
        failed,
        results,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// ── Both POST and GET for cron scheduler compatibility ──

export async function POST(req: NextRequest) {
  return handleCron(req);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}
