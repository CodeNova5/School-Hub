import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIsSuperAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// GET /api/super-admin/plan-grants
// Returns all plan grants, optionally filtered by school_id.
// Query params:
//   school_id (optional) — filter by school
//   active_only (optional) — only active grants
//   school_id_for (optional) — get grants for a specific school
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const url = new URL(req.url);
    const schoolId = url.searchParams.get("school_id") || url.searchParams.get("school_id_for");
    const activeOnly = url.searchParams.get("active_only") === "true";

    const { data: grants, error } = await supabaseAdmin.rpc("get_school_plan_grants", {
      p_school_id: schoolId || null,
      p_active_only: activeOnly,
    });

    if (error) throw error;

    return NextResponse.json({ grants: grants ?? [] });
  } catch (err: any) {
    console.error("[super-admin/plan-grants] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/super-admin/plan-grants?id=<grant_id>
// Expires/deactivates a specific plan grant.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const url = new URL(req.url);
    const grantId = url.searchParams.get("id");

    if (!grantId) {
      return NextResponse.json({ error: "Grant ID is required." }, { status: 400 });
    }

    const { data: result, error } = await supabaseAdmin.rpc("expire_school_plan_grant", {
      p_grant_id: grantId,
    });

    if (error) throw error;

    if (!result) {
      return NextResponse.json(
        { error: "Grant not found or already expired." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Grant has been expired.",
    });
  } catch (err: any) {
    console.error("[super-admin/plan-grants DELETE] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
