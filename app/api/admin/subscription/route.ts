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
        const ms = new Date(term.end_date).getTime() - new Date(term.start_date).getTime();
        const weeks = Math.round(ms / (1000 * 60 * 60 * 24 * 7));

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

        let nextTermValue: {
          id: string;
          name: string;
          session_name: string;
          start_date: string;
          end_date: string;
          weeks: number;
        } | null = null;

        if (nextTermData) {
          const nextMs = new Date(nextTermData.end_date).getTime() - new Date(nextTermData.start_date).getTime();
          nextTermValue = {
            id: nextTermData.id,
            name: nextTermData.name,
            session_name: (nextTermData as any).sessions?.name || "",
            start_date: nextTermData.start_date,
            end_date: nextTermData.end_date,
            weeks: Math.round(nextMs / (1000 * 60 * 60 * 24 * 7)),
          };
        }

        currentTerm = {
          id: term.id,
          name: term.name,
          session_name: (term as any).sessions?.name || "",
          start_date: term.start_date,
          end_date: term.end_date,
          is_current: term.is_current,
          weeks,
          next_term: nextTermValue,
        };
      }
    }

    // ── Fetch yearly covered terms ──
    // For yearly subscriptions, show the chain of covered terms
    // by looking back from current_term_id to find all 3 terms
    let yearlyCoveredTerms: {
      id: string;
      name: string;
      session_name: string;
      start_date: string;
      end_date: string;
      weeks: number;
    }[] | null = null;

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
          // Take the last 3 (or fewer if not enough)
          const lastTerms = coveredTerms.slice(-3);
          yearlyCoveredTerms = lastTerms.map((t: any) => {
            const tMs = new Date(t.end_date).getTime() - new Date(t.start_date).getTime();
            return {
              id: t.id,
              name: t.name,
              session_name: (t as any).sessions?.name || "",
              start_date: t.start_date,
              end_date: t.end_date,
              weeks: Math.round(tMs / (1000 * 60 * 60 * 24 * 7)),
            };
          });
        }
      }
    }

    return NextResponse.json({
      subscription: normalizedSub ?? null,
      school: school ?? null,
      plans: plans ?? [],
      transactions: transactions ?? [],
      status: statusResult ?? null,
      current_term: currentTerm,
      yearly_covered_terms: yearlyCoveredTerms,
    });
  } catch (err: any) {
    console.error("Admin subscription API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
