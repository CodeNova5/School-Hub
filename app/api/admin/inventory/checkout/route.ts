import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST: Checkout an asset to a user
export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await req.json();
    const { asset_id, user_id, user_role, notes } = body;

    if (!asset_id) {
      return errorResponse("Asset ID is required", 400);
    }

    // Verify asset exists and is available
    const { data: asset, error: assetError } = await supabase
      .from("inventory_assets")
      .select("*, inventory_items(name)")
      .eq("id", asset_id)
      .eq("school_id", permission.schoolId)
      .single();

    if (assetError || !asset) return errorResponse("Asset not found", 404);
    if (asset.status !== "available") return errorResponse("Asset is not available for checkout", 409);

    // Begin transaction: update asset status + insert transaction record
    const { error: updateError } = await supabase
      .from("inventory_assets")
      .update({
        status: "checked_out",
        assigned_user_id: user_id || null,
        assigned_user_role: user_role || "",
      })
      .eq("id", asset_id)
      .eq("school_id", permission.schoolId);

    if (updateError) throw updateError;

    // Log the checkout transaction
    const { error: txError } = await supabase.from("inventory_transactions").insert({
      school_id: permission.schoolId,
      item_id: asset.item_id,
      asset_id,
      user_id: user_id || null,
      user_role: user_role || "",
      transaction_type: "checkout",
      quantity: 1,
      notes: notes || `Checked out: ${asset.inventory_items?.name || "Asset"}`,
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
    return errorResponse(error.message || "Failed to checkout asset", 500);
  }
}
