import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// GET /api/plans
// Returns plan display info (labels, colors, badge styles) for all active plans.
// Accessible to any authenticated user (requires auth).
// Used by client components to render plan badges, selectors, and comparison UI.
// ---------------------------------------------------------------------------
export async function GET() {
  // Require authentication
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("get_subscription_plans");
    if (error) throw error;

    // Return a clean display-focused shape
    const plans = (data ?? []).map((plan: any) => ({
      plan_key: plan.plan_key,
      name: plan.name,
      label_short: plan.label_short,
      description: plan.description,
      color: plan.color_tailwind,
      badge_color: plan.badge_color_tailwind,
      price_hint: plan.price_hint,
      border_color: plan.border_color_tailwind,
      icon_bg: plan.icon_bg_tailwind,
      monthly_price: plan.monthly_price,
      termly_price: plan.termly_price ?? plan.monthly_price * 3,
      yearly_price: plan.yearly_price,
    }));

    return NextResponse.json({ plans });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
