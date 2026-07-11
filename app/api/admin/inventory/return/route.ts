import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST: Return a checked-out asset
export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const body = await req.json();
    const { asset_id, notes } = body;

    if (!asset_id) {
      return errorResponse("Asset ID is required", 400);
    }

    // Verify asset exists and is checked out
    const { data: asset, error: assetError } = await supabase
      .from("inventory_assets")
      .select("*, inventory_items(name)")
      .eq("id", asset_id)
      .eq("school_id", permission.schoolId)
      .single();

    if (assetError || !asset) return errorResponse("Asset not found", 404);
    if (asset.status !== "checked_out") return errorResponse("Asset is not currently checked out", 409);

    // Update asset: set status to available, clear assignment
    const { error: updateError } = await supabase
      .from("inventory_assets")
      .update({
        status: "available",
        assigned_user_id: null,
        assigned_user_role: "",
      })
      .eq("id", asset_id)
      .eq("school_id", permission.schoolId);

    if (updateError) throw updateError;

    // Log the return transaction
    const { error: txError } = await supabase.from("inventory_transactions").insert({
      school_id: permission.schoolId,
      item_id: asset.item_id,
      asset_id,
      user_id: asset.assigned_user_id,
      user_role: asset.assigned_user_role,
      transaction_type: "return",
      quantity: 1,
      notes: notes || `Returned: ${asset.inventory_items?.name || "Asset"}`,
    });

    if (txError) throw txError;

    // Fetch updated asset
    const { data: updatedAsset } = await supabase
      .from("inventory_assets")
      .select("*, inventory_items(name, category, item_type)")
      .eq("id", asset_id)
      .single();

    return successResponse({ asset: updatedAsset });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to return asset", 500);
  }
}
