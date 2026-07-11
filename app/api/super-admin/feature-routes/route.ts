import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { clearRouteCache } from "@/lib/route-enforcer";

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

// ---------------------------------------------------------------------------
// GET /api/super-admin/feature-routes
// Returns all feature routes with feature metadata
// ---------------------------------------------------------------------------
export async function GET() {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { data: routes, error: routesError } = await supabaseAdmin
      .from("subscription_feature_routes")
      .select("*")
      .order("path_pattern", { ascending: true });

    if (routesError) throw routesError;

    // Also fetch features for the dropdown
    const { data: features } = await supabaseAdmin.rpc("get_features");

    return NextResponse.json({
      routes: routes ?? [],
      features: features ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/super-admin/feature-routes
// Add a new feature route (clears middleware cache)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();

    if (!body.path_pattern?.trim()) {
      return NextResponse.json({ error: "path_pattern is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("add_feature_route", {
      p_feature_key: body.feature_key || null,
      p_path_pattern: body.path_pattern.trim(),
      p_portal: body.portal || null,
      p_is_api: Boolean(body.is_api),
      p_is_excluded: Boolean(body.is_excluded),
    });

    if (error) throw error;

    // Clear the middleware's route cache so changes take effect immediately
    clearRouteCache();

    return NextResponse.json({ route: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
