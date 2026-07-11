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

// ---------------------------------------------------------------------------
// GET /api/super-admin/features
// Returns all features with metadata
// ---------------------------------------------------------------------------
export async function GET() {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabaseAdmin.rpc("get_features");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ features: data ?? [] });
}

// ---------------------------------------------------------------------------
// POST /api/super-admin/features
// Create a new feature
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    if (!body.feature_key?.trim()) {
      return NextResponse.json({ error: "feature_key is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("upsert_feature", {
      p_feature_key: body.feature_key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      p_label: body.label?.trim() ?? null,
      p_label_short: body.label_short?.trim() ?? null,
      p_description: body.description?.trim() ?? null,
      p_icon: body.icon ?? null,
      p_category: body.category ?? null,
      p_is_active: body.is_active ?? true,
    });

    if (error) throw error;
    return NextResponse.json({ feature: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
