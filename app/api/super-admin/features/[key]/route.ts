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

type RouteParams = { params: { key: string } };

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/features/[key]
// Update feature metadata
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin.rpc("upsert_feature", {
      p_feature_key: params.key,
      p_label: body.label?.trim() ?? null,
      p_label_short: body.label_short?.trim() ?? null,
      p_description: body.description?.trim() ?? null,
      p_icon: body.icon ?? null,
      p_category: body.category ?? null,
      p_is_active: body.is_active ?? null,
    });

    if (error) throw error;
    return NextResponse.json({ feature: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/super-admin/features/[key]
// Delete a feature (cascades to plan features and routes)
// ---------------------------------------------------------------------------
export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { data, error } = await supabaseAdmin.rpc("delete_feature", {
      p_feature_key: params.key,
    });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
