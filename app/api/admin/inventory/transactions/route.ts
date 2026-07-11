import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List inventory transactions with pagination
export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const itemId = url.searchParams.get("item_id");
    const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 200);
    const offset = Number(url.searchParams.get("offset") || "0");

    let query = supabase
      .from("inventory_transactions")
      .select("*, inventory_items(name), inventory_assets(serial_number)")
      .eq("school_id", permission.schoolId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) query = query.eq("transaction_type", type);
    if (itemId) query = query.eq("item_id", itemId);

    const { data: transactions, error } = await query;
    if (error) throw error;

    // Get total count
    let countQuery = supabase
      .from("inventory_transactions")
      .select("*", { count: "exact", head: true })
      .eq("school_id", permission.schoolId);

    if (type) countQuery = countQuery.eq("transaction_type", type);
    if (itemId) countQuery = countQuery.eq("item_id", itemId);

    const { count } = await countQuery;

    return successResponse({
      transactions: transactions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load transactions", 500);
  }
}
