import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// POST: Consume stock (decrement count for consumables/saleables)
export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const body = await req.json();
    const { item_id, quantity, notes } = body;

    if (!item_id || !quantity || quantity <= 0) {
      return errorResponse("Item ID and a positive quantity are required", 400);
    }

    // Fetch current item
    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .select("id, name, item_type, stock_count")
      .eq("id", item_id)
      .eq("school_id", permission.schoolId)
      .single();

    if (itemError || !item) return errorResponse("Item not found", 404);
    if (item.item_type === "asset") return errorResponse("Assets cannot be consumed. Use the checkout flow instead.", 400);

    const newStock = item.stock_count - quantity;
    if (newStock < 0) return errorResponse(`Insufficient stock. Only ${item.stock_count} available.`, 400);

    // Update stock count
    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ stock_count: newStock })
      .eq("id", item_id)
      .eq("school_id", permission.schoolId);

    if (updateError) throw updateError;

    // Log the consumption transaction
    const { error: txError } = await supabase.from("inventory_transactions").insert({
      school_id: permission.schoolId,
      item_id,
      transaction_type: "consumed",
      quantity,
      notes: notes || `Consumed ${quantity} x ${item.name}`,
    });

    if (txError) throw txError;

    // Fetch updated item
    const { data: updatedItem } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", item_id)
      .single();

    return successResponse({ item: updatedItem });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to consume stock", 500);
  }
}
