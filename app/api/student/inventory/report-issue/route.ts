import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST: Report an issue with an assigned asset
export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    const body = await req.json();
    const { asset_id, issue_type, notes } = body;

    if (!asset_id) return errorResponse("Asset ID is required", 400);
    if (!issue_type || !["maintenance", "lost"].includes(issue_type)) {
      return errorResponse("Issue type must be 'maintenance' or 'lost'", 400);
    }

    // Verify asset is assigned to this student
    const { data: asset } = await supabase
      .from("inventory_assets")
      .select("id, status, school_id")
      .eq("id", asset_id)
      .eq("assigned_user_id", user.id)
      .single();

    if (!asset) return errorResponse("Asset not found or not assigned to you", 404);

    const newStatus = issue_type === "lost" ? "lost" : "maintenance";

    // Update asset status
    const { error: updateError } = await supabase
      .from("inventory_assets")
      .update({ status: newStatus })
      .eq("id", asset_id);

    if (updateError) throw updateError;

    // Log transaction
    const { error: txError } = await supabase.from("inventory_transactions").insert({
      school_id: asset.school_id,
      asset_id,
      user_id: user.id,
      user_role: "student",
      transaction_type: "damage_reported",
      quantity: 1,
      notes: notes || `Reported as ${issue_type}`,
    });

    if (txError) throw txError;

    // Create alert for admins
    await supabase.from("admin_alerts").insert({
      school_id: asset.school_id,
      alert_type: issue_type === "lost" ? "asset_lost" : "maintenance_needed",
      title: `Asset reported as ${issue_type}`,
      message: `A student has reported an asset as ${issue_type}. ${notes ? `Notes: ${notes}` : ""}`,
      reference_type: "inventory_assets",
      reference_id: asset_id,
    });

    return successResponse({ message: `Asset reported as ${issue_type}` });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to report issue", 500);
  }
}
