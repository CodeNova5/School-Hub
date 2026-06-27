import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendSuperAdminAtRiskAlert } from "@/lib/subscription-email";

async function checkIsSuperAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };
  const { data: canAccess } = await supabase.rpc("can_access_super_admin");
  if (!canAccess) return { ok: false, status: 403, error: "Forbidden – super admin only" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// POST /api/super-admin/notify-at-risk
// Manually triggers the super admin at-risk alert for a specific school.
// Body: { schoolId: string }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const guard = await checkIsSuperAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const { schoolId } = await req.json();

    if (!schoolId || typeof schoolId !== "string") {
      return NextResponse.json(
        { error: "schoolId is required" },
        { status: 400 }
      );
    }

    await sendSuperAdminAtRiskAlert(schoolId);

    return NextResponse.json({
      success: true,
      message: "Super admin alert sent successfully",
    });
  } catch (err: any) {
    console.error("Failed to send super admin alert:", err.message);
    return NextResponse.json(
      { error: err.message || "Failed to send alert" },
      { status: 500 }
    );
  }
}
