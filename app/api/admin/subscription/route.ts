export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    // Authenticate as admin
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin role
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get admin's school_id
    const { data: admin } = await supabase
      .from("admins")
      .select("school_id")
      .eq("user_id", user.id)
      .single();

    if (!admin?.school_id) {
      return NextResponse.json({ error: "Admin not linked to any school" }, { status: 403 });
    }

    const schoolId = admin.school_id;

    // Fetch subscription info (using the RPC that joins with plans)
    const { data: subscription, error: subError } = await supabaseAdmin
      .rpc("get_school_subscription", { p_school_id: schoolId });

    if (subError) {
      console.error("Failed to fetch subscription:", subError);
      return NextResponse.json({ error: "Failed to load subscription" }, { status: 500 });
    }

    // Get school's current plan
    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("plan, name")
      .eq("id", schoolId)
      .single();

    // Fetch available plans (for upgrade options)
    const { data: plans } = await supabaseAdmin
      .rpc("get_subscription_plans");

    // Fetch transaction history
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("school_subscription_transactions")
      .select("*")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (txError) {
      console.error("Failed to fetch transactions:", txError);
    }

    // Check subscription status
    const { data: statusResult } = await supabaseAdmin
      .rpc("check_school_subscription_status", { p_school_id: schoolId });

    // Normalize subscription (RPC returns array for TABLE returns)
    const normalizedSub = Array.isArray(subscription) ? subscription[0] : subscription;

    // ── Helper to format a term row ──
    const formatTerm = (t: any) => {
      const ms = new Date(t.end_date).getTime() - new Date(t.start_date).getTime();
      return {
        id: t.id,
        name: t.name,
        session_name: (t as any).sessions?.name || "",
        start_date: t.start_date,
        end_date: t.end_date,
        weeks: Math.round(ms / (1000 * 60 * 60 * 24 * 7)),
      };
    };

    // Fetch current term details if subscription has a current_term_id
    let currentTerm = null;
    if (normalizedSub?.current_term_id) {
      const { data: term } = await supabaseAdmin
        .from("terms")
        .select(`
          id,
          name,
          start_date,
          end_date,
          is_current,
          session_id,
          sessions!inner(name)
        `)
        .eq("id", normalizedSub.current_term_id)
        .maybeSingle();

      if (term) {
        // Fetch the next term after the current one (for holiday break detection)
        const { data: nextTermData } = await supabaseAdmin
          .from("terms")
          .select(`
            id,
            name,
            start_date,
            end_date,
            session_id,
            sessions!inner(name)
          `)
          .eq("school_id", schoolId)
          .gt("start_date", term.end_date)
          .order("start_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        currentTerm = {
          ...formatTerm(term),
          is_current: term.is_current,
          next_term: nextTermData ? formatTerm(nextTermData) : null,
        };
      }
    }

    // ── Fetch yearly covered terms ──
    // For yearly subscriptions, show the chain of covered terms
    // by looking back from current_term_id to find all 3 terms
    let yearlyCoveredTerms: ReturnType<typeof formatTerm>[] | null = null;

    if (normalizedSub?.billing_interval === "yearly" && normalizedSub?.current_term_id) {
      // Start from current_term_id (last covered term) and go back 2 more
      const { data: currentTermRow } = await supabaseAdmin
        .from("terms")
        .select("start_date")
        .eq("id", normalizedSub.current_term_id)
        .maybeSingle();

      if (currentTermRow) {
        const { data: coveredTerms } = await supabaseAdmin
          .from("terms")
          .select(`
            id,
            name,
            start_date,
            end_date,
            session_id,
            sessions!inner(name)
          `)
          .eq("school_id", schoolId)
          .lte("start_date", currentTermRow.start_date)
          .order("start_date", { ascending: true });

        if (coveredTerms && coveredTerms.length > 0) {
          const lastTerms = coveredTerms.slice(-3);
          yearlyCoveredTerms = lastTerms.map(formatTerm);
        }
      }
    }

    // ── Fetch upcoming terms (for pay-in-advance) ──
    // Terms that start after the current covered period
    let upcomingTerms: ReturnType<typeof formatTerm>[] | null = null;

    const coveredPeriodEnd = normalizedSub?.billing_interval === "yearly" && yearlyCoveredTerms
      ? yearlyCoveredTerms[yearlyCoveredTerms.length - 1].end_date
      : currentTerm?.end_date;

    if (coveredPeriodEnd) {
      const { data: upcoming } = await supabaseAdmin
        .from("terms")
        .select(`
          id,
          name,
          start_date,
          end_date,
          session_id,
          sessions!inner(name)
        `)
        .eq("school_id", schoolId)
        .gt("start_date", coveredPeriodEnd)
        .order("start_date", { ascending: true })
        .limit(6);

      if (upcoming && upcoming.length > 0) {
        upcomingTerms = upcoming.map(formatTerm);
      }
    }

    // ── Fetch all terms grouped by session (for overview) ──
    type TermWithStatus = ReturnType<typeof formatTerm> & {
      is_current: boolean;
      status: "paid" | "past" | "unpaid";
    };

    let termsBySession: { session_name: string; terms: TermWithStatus[] }[] = [];

    const { data: allTerms } = await supabaseAdmin
      .from("terms")
      .select(`
        id,
        name,
        start_date,
        end_date,
        is_current,
        session_id,
        sessions!inner(name)
      `)
      .eq("school_id", schoolId)
      .order("start_date", { ascending: true });

    // Build a set of covered term IDs for quick lookup
    const coveredTermIds = new Set<string>();
    if (currentTerm) coveredTermIds.add(currentTerm.id);
    if (yearlyCoveredTerms) yearlyCoveredTerms.forEach((t) => coveredTermIds.add(t.id));

    // Also build a set of upcoming term IDs
    const upcomingTermIds = new Set<string>();
    if (upcomingTerms) upcomingTerms.forEach((t) => upcomingTermIds.add(t.id));

    const now = new Date();

    if (allTerms) {
      const grouped = new Map<string, TermWithStatus[]>();

      for (const t of allTerms) {
        const termEnd = new Date(t.end_date);
        let status: "paid" | "past" | "unpaid";

        if (coveredTermIds.has(t.id)) {
          status = "paid";
        } else if (upcomingTermIds.has(t.id)) {
          status = "unpaid";
        } else if (termEnd < now) {
          // Past term — not in current coverage.
          // Subscription must have been active sometime for us to assume it was paid.
          // If there's a subscription record, assume it was covered.
          status = normalizedSub ? "past" : "unpaid";
        } else {
          status = "unpaid";
        }

        const formatted = formatTerm(t);
        const sessionName = (t as any).sessions?.name || "Unknown Session";

        if (!grouped.has(sessionName)) {
          grouped.set(sessionName, []);
        }
        grouped.get(sessionName)!.push({ ...formatted, is_current: t.is_current, status });
      }

      // Sort sessions by the first term's start_date descending (most recent first)
      termsBySession = Array.from(grouped.entries())
        .map(([sessionName, terms]) => ({ session_name: sessionName, terms }))
        .sort((a, b) => {
          const aStart = new Date(a.terms[0].start_date).getTime();
          const bStart = new Date(b.terms[0].start_date).getTime();
          return bStart - aStart;
        });
    }

    return NextResponse.json({
      subscription: normalizedSub ?? null,
      school: school ?? null,
      plans: plans ?? [],
      transactions: transactions ?? [],
      status: statusResult ?? null,
      current_term: currentTerm,
      yearly_covered_terms: yearlyCoveredTerms,
      upcoming_terms: upcomingTerms,
      terms_by_session: termsBySession,
    });
  } catch (err: any) {
    console.error("Admin subscription API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
