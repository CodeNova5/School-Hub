import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List all categories with item counts
export async function GET() {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const schoolId = permission.schoolId;

    // Fetch all items and bucket by category in code
    const { data: items, error } = await supabase
      .from("inventory_items")
      .select("category, item_type")
      .eq("school_id", schoolId)
      .eq("is_active", true);

    if (error) throw error;

    // Group by category
    const grouped: Record<string, { total: number; assets: number; consumables: number; saleables: number }> = {};
    for (const item of items || []) {
      const cat = item.category || "Uncategorized";
      if (!grouped[cat]) {
        grouped[cat] = { total: 0, assets: 0, consumables: 0, saleables: 0 };
      }
      grouped[cat].total++;
      if (item.item_type === "asset") grouped[cat].assets++;
      else if (item.item_type === "consumable") grouped[cat].consumables++;
      else if (item.item_type === "saleable") grouped[cat].saleables++;
    }

    const categories = Object.entries(grouped)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total);

    return successResponse({ categories });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load categories", 500);
  }
}

// PATCH: Rename a category across all items
export async function PATCH(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const body = await req.json();
    const { old_name, new_name } = body;

    if (!old_name || !new_name) {
      return errorResponse("Both old_name and new_name are required", 400);
    }

    // Update all items matching the old category to the new name (handle both '' and 'Uncategorized')
    const actualOldName = old_name === "Uncategorized" ? "" : old_name;

    const { error } = await supabase
      .from("inventory_items")
      .update({ category: new_name })
      .eq("school_id", permission.schoolId)
      .eq("category", actualOldName);

    if (error) throw error;
    return successResponse({ message: `Category renamed to "${new_name}"` });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to rename category", 500);
  }
}

// DELETE: Remove a category (sets to empty string) from all items
export async function DELETE(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const url = new URL(req.url);
    const name = url.searchParams.get("name");

    if (!name) {
      return errorResponse("Category name is required", 400);
    }

    const actualName = name === "Uncategorized" ? "" : name;

    const { error } = await supabase
      .from("inventory_items")
      .update({ category: "" })
      .eq("school_id", permission.schoolId)
      .eq("category", actualName);

    if (error) throw error;
    return successResponse({ message: `Category "${name}" removed from all items` });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to delete category", 500);
  }
}
