import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: Fetch inventory dashboard summary statistics
export async function GET(_req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const schoolId = permission.schoolId;

    // Total assets (inventory_assets count)
    const { count: totalAssets } = await supabase
      .from("inventory_assets")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_active", true);

    // Assets by status — fetch all and count in code
    const { data: allAssets } = await supabase
      .from("inventory_assets")
      .select("status")
      .eq("school_id", schoolId)
      .eq("is_active", true);

    const checkedOutCount = (allAssets || []).filter((a) => a.status === "checked_out").length;
    const availableCount = (allAssets || []).filter((a) => a.status === "available").length;
    const maintenanceCount = (allAssets || []).filter((a) => a.status === "maintenance").length;
    const lostCount = (allAssets || []).filter((a) => a.status === "lost").length;

    // Low-stock items: fetch all consumable/saleable items and filter in code
    const { data: allConsumableItems } = await supabase
      .from("inventory_items")
      .select("id, name, stock_count, low_stock_threshold, category, item_type")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in("item_type", ["consumable", "saleable"]);

    const lowStock = (allConsumableItems || []).filter(
      (item) => item.stock_count < item.low_stock_threshold
    );

    // Total items count
    const { count: totalItems } = await supabase
      .from("inventory_items")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_active", true);

    // Recent transactions (last 10)
    const { data: recentTransactions } = await supabase
      .from("inventory_transactions")
      .select("*, inventory_items(name), inventory_assets(serial_number)")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Recent low-stock alerts (unread count)
    const { count: unreadAlerts } = await supabase
      .from("admin_alerts")
      .select("*", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("is_read", false)
      .eq("alert_type", "low_stock");

    // Summary by item type
    const { data: itemsByType } = await supabase
      .from("inventory_items")
      .select("item_type")
      .eq("school_id", schoolId)
      .eq("is_active", true);

    const assetItemsCount = (itemsByType || []).filter((i) => i.item_type === "asset").length;
    const consumableItemsCount = (itemsByType || []).filter((i) => i.item_type === "consumable").length;
    const saleableItemsCount = (itemsByType || []).filter((i) => i.item_type === "saleable").length;

    return successResponse({
      stats: {
        total_items: totalItems || 0,
        total_assets: totalAssets || 0,
        checked_out: checkedOutCount,
        available: availableCount,
        in_maintenance: maintenanceCount,
        lost: lostCount,
        low_stock_count: lowStock.length,
        unread_alerts: unreadAlerts || 0,
      },
      by_type: {
        assets: assetItemsCount,
        consumables: consumableItemsCount,
        saleables: saleableItemsCount,
      },
      low_stock_items: lowStock,
      recent_transactions: recentTransactions || [],
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load inventory dashboard", 500);
  }
}
