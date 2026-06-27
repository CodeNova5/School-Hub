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

    return NextResponse.json({
      subscription: normalizedSub ?? null,
      school: school ?? null,
      plans: plans ?? [],
      transactions: transactions ?? [],
      status: statusResult ?? null,
    });
  } catch (err: any) {
    console.error("Admin subscription API error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
