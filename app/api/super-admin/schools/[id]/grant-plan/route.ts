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
  return { ok: true, user };
}

interface GrantPlanBody {
  plan_key: "pro" | "premium";
  grant_type: "term" | "session" | "custom";
  term_id?: string;
  session_id?: string;
  start_date: string;
  end_date: string;
  include_holidays?: boolean;
  notes?: string;
}

type RouteParams = { params: { id: string } };

// ---------------------------------------------------------------------------
// POST /api/super-admin/schools/[id]/grant-plan
// Manually grant a plan to a school for a specific period.
// Used when an admin pays cash or transfers directly.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const schoolId = params.id;
    const body: GrantPlanBody = await req.json();

    // ── Validation ──────────────────────────────────────────────────────
    if (!["pro", "premium"].includes(body.plan_key)) {
      return NextResponse.json(
        { error: "Invalid plan. Must be 'pro' or 'premium'." },
        { status: 400 }
      );
    }

    if (!["term", "session", "custom"].includes(body.grant_type)) {
      return NextResponse.json(
        { error: "Invalid grant_type. Must be 'term', 'session', or 'custom'." },
        { status: 400 }
      );
    }

    if (!body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: "start_date and end_date are required." },
        { status: 400 }
      );
    }

    const startDate = new Date(body.start_date);
    const endDate = new Date(body.end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: "start_date must be before end_date." },
        { status: 400 }
      );
    }

    // Validate term_id if grant_type is "term"
    if (body.grant_type === "term") {
      if (!body.term_id) {
        return NextResponse.json(
          { error: "term_id is required when grant_type is 'term'." },
          { status: 400 }
        );
      }

      // Verify the term exists and belongs to this school
      const { data: term } = await supabaseAdmin
        .from("terms")
        .select("id, name, start_date, end_date, school_id")
        .eq("id", body.term_id)
        .single();

      if (!term) {
        return NextResponse.json(
          { error: "Term not found." },
          { status: 404 }
        );
      }
    }

    // Validate session_id if grant_type is "session"
    if (body.grant_type === "session") {
      if (!body.session_id) {
        return NextResponse.json(
          { error: "session_id is required when grant_type is 'session'." },
          { status: 400 }
        );
      }

      const { data: session } = await supabaseAdmin
        .from("sessions")
        .select("id, name, start_date, end_date, school_id")
        .eq("id", body.session_id)
        .single();

      if (!session) {
        return NextResponse.json(
          { error: "Session not found." },
          { status: 404 }
        );
      }
    }

    // ── Verify the school exists ─────────────────────────────────────────
    const { data: school } = await supabaseAdmin
      .from("schools")
      .select("id, name, plan")
      .eq("id", schoolId)
      .single();

    if (!school) {
      return NextResponse.json({ error: "School not found." }, { status: 404 });
    }

    // ── Resolve the grantor's name ───────────────────────────────────────
    let grantorName = "Super Admin";
    if (guard.user) {
      const { data: admin } = await supabaseAdmin
        .from("admins")
        .select("name")
        .eq("user_id", guard.user.id)
        .maybeSingle();

      if (admin?.name) {
        grantorName = admin.name;
      }
    }

    // ── Execute the grant ────────────────────────────────────────────────
    const { data: result, error: grantError } = await supabaseAdmin.rpc(
      "create_school_plan_grant",
      {
        p_school_id: schoolId,
        p_plan_key: body.plan_key,
        p_grant_type: body.grant_type,
        p_start_date: body.start_date,
        p_end_date: body.end_date,
        p_include_holidays: body.include_holidays ?? true,
        p_notes: body.notes?.trim() ?? "",
        p_term_id: body.term_id || null,
        p_session_id: body.session_id || null,
        p_granted_by: guard.user?.id,
        p_granted_by_name: grantorName,
      }
    );

    if (grantError) {
      console.error("[grant-plan] RPC error:", grantError);
      return NextResponse.json(
        { error: grantError.message || "Failed to create grant." },
        { status: 500 }
      );
    }

    console.log(
      `[grant-plan] ✓ ${school.name} granted ${body.plan_key} ` +
      `(${body.grant_type}: ${body.start_date} → ${body.end_date}) by ${grantorName}`
    );

    return NextResponse.json({
      success: true,
      message: `${school.name} has been granted the ${body.plan_key} plan from ${body.start_date} to ${body.end_date}.`,
      grant: result,
    });
  } catch (err: any) {
    console.error("[grant-plan] Error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
