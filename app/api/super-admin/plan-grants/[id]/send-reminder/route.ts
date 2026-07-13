import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendGrantExpiryReminder } from "@/lib/subscription-email";

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
// POST /api/super-admin/plan-grants/[id]/send-reminder
// Sends a grant expiry reminder email for a specific grant.
// ---------------------------------------------------------------------------
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const grantId = params.id;

    // Fetch the grant with school info
    const { data: grants } = await supabaseAdmin.rpc("get_school_plan_grants", {
      p_school_id: null,
      p_active_only: false,
    });

    const grant = Array.isArray(grants)
      ? (grants as any[]).find((g: any) => g.id === grantId)
      : null;

    if (!grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }

    if (!grant.is_active) {
      return NextResponse.json({ error: "Grant is already expired" }, { status: 400 });
    }

    const err = await sendGrantExpiryReminder(grant.school_id, grant.plan_key, grant.expires_at);

    if (err) {
      return NextResponse.json(
        { success: false, error: err, school_name: grant.school_name },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Reminder sent for ${grant.school_name}'s ${grant.plan_key} grant`,
      school_name: grant.school_name,
      plan_key: grant.plan_key,
    });
  } catch (err: any) {
    console.error("[super-admin/plan-grants/send-reminder] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
