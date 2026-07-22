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
  if (!user) return { ok: false, status: 401, error: "Unauthorized" } as const;
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" } as const;
  return { ok: true } as const;
}

type RouteParams = { params: { id: string } };

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/subscription-plans/[id]
// Update plan details (name, description, prices) or toggle a feature
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();

    // ── Feature toggle ──
    if (body.feature_key !== undefined && body.is_enabled !== undefined) {
      const { data, error } = await supabaseAdmin.rpc("toggle_plan_feature", {
        p_plan_id: params.id,
        p_feature_key: body.feature_key,
        p_is_enabled: Boolean(body.is_enabled),
      });
      if (error) throw error;
      return NextResponse.json({ feature: data });
    }

    // ── Update plan details ──
    // Note: CSS/styling fields (color_tailwind, badge_color_tailwind, etc.)
    // are intentionally excluded — styles are now hardcoded in client helpers.
    const { data, error } = await supabaseAdmin.rpc("update_subscription_plan", {
      p_plan_id: params.id,
      p_name: body.name ?? null,
      p_description: body.description ?? null,
      p_monthly_price: body.monthly_price != null ? Number(body.monthly_price) : null,
      p_termly_price: body.termly_price != null ? Number(body.termly_price) : null,
      p_yearly_price: body.yearly_price != null ? Number(body.yearly_price) : null,
      p_is_active: body.is_active != null ? Boolean(body.is_active) : null,
      p_label_short: body.label_short ?? null,
      p_price_hint: body.price_hint ?? null,
    });

    if (error) throw error;
    return NextResponse.json({ plan: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
