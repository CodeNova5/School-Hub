import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import { sendNotificationsToMultiple, initializeAdminSDK } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Scan all items for low stock, create alerts, and send push notifications
export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const schoolId = permission.schoolId;

    // 1. Find all consumable/saleable items below their low-stock threshold
    const { data: allItems, error: itemsError } = await supabase
      .from("inventory_items")
      .select("id, name, stock_count, low_stock_threshold, category")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .in("item_type", ["consumable", "saleable"]);

    if (itemsError) throw itemsError;

    // Filter in JS since .lt can't compare two columns directly
    const items = (allItems || []).filter((item) => item.stock_count < item.low_stock_threshold);

    if (items.length === 0) {
      return successResponse({
        message: "No low-stock items found. All stock levels are healthy.",
        alerts_created: 0,
        notifications_sent: 0,
      });
    }

    // 2. Check which items already have an unread low-stock alert (avoid duplicates)
    const itemIds = items.map((i: any) => i.id);
    const { data: existingAlerts } = await supabase
      .from("admin_alerts")
      .select("reference_id")
      .eq("school_id", schoolId)
      .eq("alert_type", "low_stock")
      .eq("is_dismissed", false)
      .in("reference_id", itemIds);

    const alertedIds = new Set((existingAlerts || []).map((a: any) => a.reference_id));

    // 3. Create new alerts for items without existing ones
    const newItems = items.filter((i: any) => !alertedIds.has(i.id));
    const alertsToInsert = newItems.map((item: any) => ({
      school_id: schoolId,
      alert_type: "low_stock" as const,
      title: `Low stock: ${item.name}`,
      message: `Stock count (${item.stock_count}) has fallen below the threshold (${item.low_stock_threshold}).`,
      reference_type: "inventory_items" as const,
      reference_id: item.id,
    }));

    let insertedAlerts: any[] = [];
    if (alertsToInsert.length > 0) {
      const { data, error: insertError } = await supabase
        .from("admin_alerts")
        .insert(alertsToInsert)
        .select();
      if (insertError) throw insertError;
      insertedAlerts = data || [];
    }

    // 4. Send push notifications to admin users
    let notificationsSent = 0;
    let notificationError: string | null = null;

    if (newItems.length > 0) {
      try {
        // Fetch all active admin notification tokens for this school
        const { data: adminTokens } = await supabaseAdmin
          .from("notification_tokens")
          .select("token")
          .eq("school_id", schoolId)
          .eq("role", "admin")
          .eq("is_active", true);

        const tokens = (adminTokens || []).map((t: any) => t.token);

        if (tokens.length > 0) {
          const itemList = newItems
            .slice(0, 5)
            .map((i: any) => `${i.name} (${i.stock_count}/${i.low_stock_threshold})`)
            .join(", ");
          const remainder = newItems.length > 5 ? ` and ${newItems.length - 5} more` : "";

          try {
            initializeAdminSDK();
          } catch {
            // Firebase not configured — skip push notifications
            notificationError = "Firebase not configured";
            return successResponse({
              message: `${insertedAlerts.length} low-stock alert(s) created. Firebase not configured — push notifications skipped.`,
              alerts_created: insertedAlerts.length,
              notifications_sent: 0,
              total_low_stock_items: items.length,
              already_alerted: alertedIds.size,
              items: newItems.map((i: any) => ({
                id: i.id,
                name: i.name,
                stock_count: i.stock_count,
                threshold: i.low_stock_threshold,
              })),
              warning: notificationError,
            });
          }

          const result = await sendNotificationsToMultiple(
            tokens,
            {
              title: `Low Stock Alert — ${newItems.length} item${newItems.length !== 1 ? "s" : ""}`,
              body: `${itemList}${remainder}`,
            },
            {
              type: "low_stock",
              link: "/admin/inventory/items?tab=alerts",
            }
          );
          notificationsSent = result.successCount;
        }
      } catch (err: any) {
        notificationError = err.message || "Failed to send notifications";
      }
    }

    // 5. Log transaction for audit
    if (insertedAlerts.length > 0) {
      await supabase.from("inventory_transactions").insert({
        school_id: schoolId,
        transaction_type: "restock", // using restock as closest match for the audit entry
        quantity: insertedAlerts.length,
        notes: `Low-stock scan created ${insertedAlerts.length} alert(s) for ${insertedAlerts.map((a) => a.title).join(", ")}`,
      }).maybeSingle();
    }

    const summaryItems = newItems.map((i: any) => ({
      id: i.id,
      name: i.name,
      stock_count: i.stock_count,
      threshold: i.low_stock_threshold,
    }));

    return successResponse({
      message: `${insertedAlerts.length} low-stock alert(s) created. ${notificationsSent > 0 ? `${notificationsSent} push notification(s) sent.` : "Push notifications skipped."}`,
      alerts_created: insertedAlerts.length,
      notifications_sent: notificationsSent,
      total_low_stock_items: items.length,
      already_alerted: alertedIds.size,
      items: summaryItems,
      warning: notificationError,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to scan for low-stock alerts", 500);
  }
}
