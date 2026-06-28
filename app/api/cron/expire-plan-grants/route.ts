import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpiredGrant {
  grant_id: string;
  school_id: string;
  school_name: string;
  plan_key: string;
  expired_at: string;
}

interface ExpireResult {
  grant_id: string;
  school_id: string;
  school_name: string;
  plan_key: string;
  status: "expired" | "skipped" | "failed";
  error?: string;
}

// ---------------------------------------------------------------------------
// POST & GET /api/cron/expire-plan-grants
//
// Called by a cron scheduler (e.g., Vercel Cron Jobs, cron-job.org).
// Protected by CRON_SECRET environment variable.
//
// Process:
// 1. Call expire_past_plan_grants() RPC — atomically expires grants where
//    expires_at < now() and downgrades schools with no remaining active grants
// 2. Log each expired grant
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
  const results: ExpireResult[] = [];
  let expired = 0;
  let failed = 0;

  try {
    // 1. Call the RPC that expires past grants and handles downgrades
    const { data: expiredGrants, error } = await supabaseAdmin
      .rpc("expire_past_plan_grants");

    if (error) {
      console.error("Failed to expire past plan grants:", error);
      return NextResponse.json(
        { error: `Failed to expire grants: ${error.message}` },
        { status: 500 }
      );
    }

    const grants = (expiredGrants ?? []) as ExpiredGrant[];

    if (grants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No plan grants have expired — all active grants are still valid",
        expired: 0,
        failed: 0,
        results: [],
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(
      `Cron (expire-grants): Found ${grants.length} expired plan grant(s) to process`
    );

    // 2. Process each result
    for (const grant of grants) {
      try {
        console.log(
          `Cron (expire-grants): ✓ ${grant.school_name} — ` +
          `${grant.plan_key} grant expired (was active until ${grant.expired_at})`
        );

        results.push({
          grant_id: grant.grant_id,
          school_id: grant.school_id,
          school_name: grant.school_name,
          plan_key: grant.plan_key,
          status: "expired",
        });
        expired++;
      } catch (err: any) {
        console.error(
          `Cron (expire-grants): ✗ ${grant.school_name} — error: ${err.message}`
        );
        results.push({
          grant_id: grant.grant_id,
          school_id: grant.school_id,
          school_name: grant.school_name,
          plan_key: grant.plan_key,
          status: "failed",
          error: err.message,
        });
        failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `Cron (expire-grants): Complete — ${expired} expired, ${failed} failed in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      message: `Processed ${grants.length} expired grant(s) (${expired} expired, ${failed} failed)`,
      expired,
      failed,
      total: grants.length,
      results,
      duration_ms: duration,
    });
  } catch (err: any) {
    console.error("Cron (expire-grants): Unhandled error:", err.message);
    return NextResponse.json(
      {
        error: err.message || "Unknown error",
        expired,
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
