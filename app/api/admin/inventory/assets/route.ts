import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List inventory assets with filtering
export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const url = new URL(req.url);
    const itemId = url.searchParams.get("item_id");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search")?.trim();

    let query = supabase
      .from("inventory_assets")
      .select("*, inventory_items(name, category, item_type)")
      .eq("school_id", permission.schoolId)
      .order("created_at", { ascending: false });

    if (itemId) query = query.eq("item_id", itemId);
    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("serial_number", `%${search}%`);

    const { data: assets, error } = await query;
    if (error) throw error;

    return successResponse({ assets: assets || [] });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load assets", 500);
  }
}

// POST: Register one or more assets
export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const body = await req.json();

    const { item_id, serial_numbers } = body;

    if (!item_id || !serial_numbers || !Array.isArray(serial_numbers) || serial_numbers.length === 0) {
      return errorResponse("Item ID and serial_numbers array are required", 400);
    }

    // Verify the item exists and is of type 'asset'
    const { data: item } = await supabase
      .from("inventory_items")
      .select("id, item_type")
      .eq("id", item_id)
      .eq("school_id", permission.schoolId)
      .single();

    if (!item) return errorResponse("Item not found", 404);
    if (item.item_type !== "asset") return errorResponse("Item must be of type 'asset'", 400);

    // Bulk insert assets
    const assetsToInsert = serial_numbers.map((serial: string) => ({
      school_id: permission.schoolId,
      item_id,
      serial_number: serial.trim(),
      status: "available" as const,
    }));

    const { data: assets, error } = await supabase
      .from("inventory_assets")
      .insert(assetsToInsert)
      .select("*, inventory_items(name, category, item_type)");

    if (error) throw error;

    // Log the purchase transaction
    await supabase.from("inventory_transactions").insert({
      school_id: permission.schoolId,
      item_id,
      transaction_type: "purchase",
      quantity: serial_numbers.length,
      notes: `Registered ${serial_numbers.length} new assets`,
    });

    return successResponse({ assets: assets || [] }, 201);
  } catch (error: any) {
    return errorResponse(error.message || "Failed to register assets", 500);
  }
}
