import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List inventory items with optional filtering
export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const search = url.searchParams.get("search")?.trim();
    const category = url.searchParams.get("category")?.trim();

    let query = supabase
      .from("inventory_items")
      .select("*")
      .eq("school_id", permission.schoolId)
      .order("name");

    if (type && type !== "all") {
      query = query.eq("item_type", type);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data: items, error } = await query;
    if (error) throw error;

    // Fetch asset counts separately for asset-type items
    const { data: allAssets } = await supabase
      .from("inventory_assets")
      .select("item_id, status")
      .eq("school_id", permission.schoolId)
      .eq("is_active", true);

    // Build per-item asset stats
    const assetStats: Record<string, { total: number; checked_out: number; available: number }> = {};
    for (const asset of allAssets || []) {
      if (!assetStats[asset.item_id]) {
        assetStats[asset.item_id] = { total: 0, checked_out: 0, available: 0 };
      }
      assetStats[asset.item_id].total++;
      if (asset.status === "checked_out") assetStats[asset.item_id].checked_out++;
      if (asset.status === "available") assetStats[asset.item_id].available++;
    }

    // Enrich items with asset counts
    const enriched = (items || []).map((item: any) => {
      const stats = assetStats[item.id] || { total: 0, checked_out: 0, available: 0 };
      return {
        ...item,
        asset_count: stats.total,
        checked_out_count: stats.checked_out,
        available_count: stats.available,
      };
    });

    return successResponse({ items: enriched });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load inventory items", 500);
  }
}

// POST: Create a new inventory item
export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await req.json();

    const { name, category, item_type, stock_count, low_stock_threshold, description, unit_price } = body;

    if (!name || !item_type) {
      return errorResponse("Name and item type are required", 400);
    }

    const { data: item, error } = await supabase
      .from("inventory_items")
      .insert({
        school_id: permission.schoolId,
        name,
        category: category || "",
        item_type,
        stock_count: stock_count ?? 0,
        low_stock_threshold: low_stock_threshold ?? 5,
        description: description || "",
        unit_price: unit_price ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return successResponse({ item }, 201);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to create inventory item", 500);
  }
}

// PATCH: Update an inventory item
export async function PATCH(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return errorResponse("Item ID is required", 400);
    }

    const { data: item, error } = await supabase
      .from("inventory_items")
      .update(updates)
      .eq("id", id)
      .eq("school_id", permission.schoolId)
      .select()
      .single();

    if (error) throw error;
    return successResponse({ item });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update inventory item", 500);
  }
}

// DELETE: Soft-delete (deactivate) an inventory item
export async function DELETE(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return errorResponse("Item ID is required", 400);
    }

    const { error } = await supabase
      .from("inventory_items")
      .update({ is_active: false })
      .eq("id", id)
      .eq("school_id", permission.schoolId);

    if (error) throw error;
    return successResponse({ message: "Item deactivated" });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to deactivate item", 500);
  }
}
