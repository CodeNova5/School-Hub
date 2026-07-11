import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsSuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" };
  return { ok: true };
}

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/super-admin/analytics/subscriptions
// Returns aggregated subscription analytics for the super admin dashboard.
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    // ── 1. Schools per plan ─────────────────────────────────────────────
    const { data: schools, error: schoolsError } = await supabaseAdmin
      .from("schools")
      .select("id, name, plan, is_active, created_at");

    if (schoolsError) throw schoolsError;

    const totalSchools = schools.length;
    const activeSchools = schools.filter((s) => s.is_active).length;
    const planDistribution: Record<string, number> = {};
    for (const s of schools) {
      const plan = s.plan || "basic";
      planDistribution[plan] = (planDistribution[plan] || 0) + 1;
    }

    // ── 2. Subscription status breakdown ─────────────────────────────────
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("school_subscriptions")
      .select("school_id, status, billing_interval, plan_id");

    if (subError) throw subError;

    const statusBreakdown: Record<string, number> = {
      active: 0,
      past_due: 0,
      expired: 0,
      cancelled: 0,
      trialing: 0,
      none: 0,
    };

    const subMap = new Map<string, typeof subscriptions[0]>();
    for (const sub of subscriptions || []) {
      subMap.set(sub.school_id, sub);
      statusBreakdown[sub.status] = (statusBreakdown[sub.status] || 0) + 1;
    }
    // Schools without a subscription record count as "none"
    const withSub = new Set((subscriptions || []).map((s) => s.school_id));
    statusBreakdown.none = schools.filter((s) => !withSub.has(s.id)).length;

    // ── 3. MRR & Revenue calculations ────────────────────────────────────
    const { data: plans } = await supabaseAdmin
      .from("subscription_plans")
      .select("id, plan_key, termly_price, monthly_price, yearly_price");

    const planPriceMap = new Map<string, { termly: number; monthly: number; yearly: number }>();
    for (const p of plans || []) {
      planPriceMap.set(p.plan_key, {
        termly: Number(p.termly_price) || 0,
        monthly: Number(p.monthly_price) || 0,
        yearly: Number(p.yearly_price) || 0,
      });
    }

    // MRR: For active subscriptions, calculate the monthly equivalent
    // Termly = price / 4 (roughly 4 months per term with holidays)
    // Yearly = price / 12
    let mrr = 0;
    let projectedAnnual = 0;
    // Also calculate by plan
    const mrrByPlan: Record<string, number> = {};
    const schoolsByPlan: Record<string, { name: string; plan_key: string }[]> = {};

    for (const school of schools) {
      const planKey = school.plan || "basic";
      if (!mrrByPlan[planKey]) mrrByPlan[planKey] = 0;
      if (!schoolsByPlan[planKey]) schoolsByPlan[planKey] = [];

      schoolsByPlan[planKey].push({ name: school.name, plan_key: planKey });

      // Only count active subscriptions toward MRR
      const sub = subMap.get(school.id);
      if (!sub || sub.status !== "active") continue;

      const prices = planPriceMap.get(planKey);
      if (!prices) continue;

      let monthlyAmount = 0;
      if (sub.billing_interval === "yearly" && prices.yearly > 0) {
        monthlyAmount = prices.yearly / 12;
      } else if (sub.billing_interval === "termly" && prices.termly > 0) {
        monthlyAmount = prices.termly / 4; // ~4 months per term
      } else if (prices.monthly > 0) {
        monthlyAmount = prices.monthly;
      }

      mrr += monthlyAmount;
      mrrByPlan[planKey] += monthlyAmount;
    }
    projectedAnnual = mrr * 12;

    // ── 4. Transaction analytics ─────────────────────────────────────────
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("school_subscription_transactions")
      .select("id, school_id, amount, status, created_at, paid_at, metadata")
      .order("created_at", { ascending: false })
      .limit(500);

    if (txError) throw txError;

    // Aggregate by month for failed payment trend
    const monthlyTrend: Record<string, { total: number; success: number; failed: number; amount: number }> = {};
    // Transaction status breakdown
    let totalRevenue = 0;
    const successfulTxs = (transactions || []).filter((tx) => tx.status === "success");
    for (const tx of successfulTxs) {
      totalRevenue += Number(tx.amount) || 0;
    }

    for (const tx of transactions || []) {
      const date = new Date(tx.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!monthlyTrend[monthKey]) {
        monthlyTrend[monthKey] = { total: 0, success: 0, failed: 0, amount: 0 };
      }
      monthlyTrend[monthKey].total++;
      monthlyTrend[monthKey].amount += Number(tx.amount) || 0;
      if (tx.status === "success") monthlyTrend[monthKey].success++;
      else if (tx.status === "failed") monthlyTrend[monthKey].failed++;
    }

    // ── 5. Recent transactions (last 20) ─────────────────────────────────
    const recentTransactions = (transactions || []).slice(0, 20).map((tx) => {
      const school = schools.find((s) => s.id === tx.school_id);
      return {
        id: tx.id,
        school_name: school?.name || "Unknown",
        school_id: tx.school_id,
        amount: tx.amount,
        status: tx.status,
        reference: tx.metadata && typeof tx.metadata === "object" && "source" in (tx.metadata as object)
          ? ((tx.metadata as any).source === "manual" ? "Manual" : "Auto")
          : "Auto",
        created_at: tx.created_at,
        paid_at: tx.paid_at,
      };
    });

    // ── 6. Past due schools (schools in trouble) ─────────────────────────
    const pastDueSchools = schools
      .filter((s) => {
        const sub = subMap.get(s.id);
        return sub && sub.status === "past_due";
      })
      .map((s) => ({
        id: s.id,
        name: s.name,
        plan: s.plan || "basic",
      }));

    // Build trend data for the chart
    const trendData = Object.entries(monthlyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        total: data.total,
        success: data.success,
        failed: data.failed,
        revenue: data.amount / 100,
      }));

    return NextResponse.json({
      overview: {
        totalSchools,
        activeSchools,
        schoolsWithSubscriptions: subscriptions?.length || 0,
        planDistribution,
        statusBreakdown,
      },
      revenue: {
        mrr: Math.round(mrr / 100),
        projectedAnnual: Math.round(projectedAnnual / 100),
        totalRevenue: Math.round(totalRevenue / 100),
        mrrByPlan: Object.fromEntries(
          Object.entries(mrrByPlan).map(([key, val]) => [key, Math.round(val / 100)])
        ),
      },
      trends: trendData,
      recentTransactions,
      atRiskSchools: {
        pastDue: pastDueSchools,
        count: pastDueSchools.length,
      },
    });
  } catch (err: any) {
    console.error("Subscription analytics error:", err.message);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
