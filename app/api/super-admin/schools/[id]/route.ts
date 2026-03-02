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

type RouteParams = { params: { id: string } };

// ---------------------------------------------------------------------------
// GET /api/super-admin/schools/[id]
// ---------------------------------------------------------------------------
export async function GET(_: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ school: data });
}

// ---------------------------------------------------------------------------
// PATCH /api/super-admin/schools/[id]
// Body: partial School fields (name, subdomain, address, phone, email, is_active)
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();

    // Sanitise allowed fields
    const allowed: Record<string, unknown> = {};
    if (body.name !== undefined) allowed.name = String(body.name).trim();
    if (body.subdomain !== undefined)
      allowed.subdomain = body.subdomain ? String(body.subdomain).trim().toLowerCase() : null;
    if (body.address !== undefined) allowed.address = String(body.address).trim();
    if (body.phone !== undefined) allowed.phone = String(body.phone).trim();
    if (body.email !== undefined) allowed.email = String(body.email).trim();
    if (body.is_active !== undefined) allowed.is_active = Boolean(body.is_active);
    allowed.updated_at = new Date().toISOString();

    if (Object.keys(allowed).length <= 1) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("schools")
      .update(allowed)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ school: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/super-admin/schools/[id]
// Hard-deletes a school (cascades to all related data due to ON DELETE CASCADE)
// ---------------------------------------------------------------------------
export async function DELETE(_: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    // Prevent deleting the default seed school to keep system integrity
    if (params.id === "00000000-0000-0000-0000-000000000001") {
      return NextResponse.json(
        { error: "Cannot delete the default school. Update it instead." },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("schools")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
