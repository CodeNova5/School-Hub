import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Service-role client – bypasses RLS for administrative operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Guard: Verify the caller is a super_admin
async function checkIsSuperAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// GET /api/super-admin/schools
// Returns all schools with student/teacher counts
// ---------------------------------------------------------------------------
export async function GET() {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { data: schools, error } = await supabaseAdmin
    .from("schools")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ schools });
}

// ---------------------------------------------------------------------------
// POST /api/super-admin/schools
// Body: { name, subdomain?, address?, phone?, email? }
// Creates a new school
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await req.json();
    const { name, subdomain, address, phone, email } = body as {
      name: string;
      subdomain?: string;
      address?: string;
      phone?: string;
      email?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "School name is required" }, { status: 400 });
    }

    // Check subdomain uniqueness
    if (subdomain?.trim()) {
      const { data: existing } = await supabaseAdmin
        .from("schools")
        .select("id")
        .eq("subdomain", subdomain.trim().toLowerCase())
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `Subdomain "${subdomain}" is already in use` },
          { status: 409 }
        );
      }
    }

    const { data: school, error: insertErr } = await supabaseAdmin
      .from("schools")
      .insert({
        name: name.trim(),
        subdomain: subdomain?.trim().toLowerCase() || null,
        address: address?.trim() ?? "",
        phone: phone?.trim() ?? "",
        email: email?.trim() ?? "",
        is_active: true,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ school }, { status: 201 });
  } catch (err: any) {
    console.error("[super-admin/schools POST]", err);
    return NextResponse.json({ error: err.message ?? "Failed to create school" }, { status: 500 });
  }
}
