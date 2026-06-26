import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------------------------------------------------------------------
// GET /api/school/plan-features
// Returns all plans with their enabled features.
// Accessible to any authenticated user (requires auth).
// Used by client components to determine which features are locked.
// ---------------------------------------------------------------------------
export async function GET() {
  // Require authentication
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("get_subscription_plans");
    if (error) throw error;

    // Return a simplified shape: plan_key → enabled feature keys
    const planFeatures: Record<string, string[]> = {};
    for (const plan of data ?? []) {
      planFeatures[plan.plan_key] = (plan.features ?? [])
        .filter((f: { feature_key: string; is_enabled: boolean }) => f.is_enabled)
        .map((f: { feature_key: string; is_enabled: boolean }) => f.feature_key);
    }

    return NextResponse.json({ planFeatures });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
