import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: Fetch assets assigned to the children of the authenticated parent
export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    // Get parent record
    const { data: parent } = await supabase
      .from("parents")
      .select("id, school_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!parent) return errorResponse("Parent record not found", 404);

    // Get children's user_ids through guardian links
    const { data: guardianLinks } = await supabase
      .from("student_guardian_links")
      .select(`
        students!inner(
          id,
          user_id,
          first_name,
          last_name,
          student_id,
          classes(name)
        )
      `)
      .eq("guardian_id", parent.id);

    if (!guardianLinks || guardianLinks.length === 0) {
      return successResponse({ children: [] });
    }

    const childrenUserIds = guardianLinks
      .map((link: any) => link.students?.user_id)
      .filter(Boolean);

    const childrenInfo = guardianLinks.map((link: any) => link.students).filter(Boolean);

    // Fetch assets assigned to any of the children's user_ids
    const { data: assets } = await supabase
      .from("inventory_assets")
      .select("*, inventory_items(name, category, item_type, description, unit_price)")
      .eq("school_id", parent.school_id)
      .in("assigned_user_id", childrenUserIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!assets) {
      return successResponse({ children: childrenInfo, assets: [] });
    }

    // Group assets by child user_id
    const assetsByChild: Record<string, any[]> = {};
    for (const asset of assets) {
      const uid = asset.assigned_user_id;
      if (!assetsByChild[uid]) assetsByChild[uid] = [];
      assetsByChild[uid].push(asset);
    }

    // Enrich children with their assets
    const enrichedChildren = childrenInfo.map((child: any) => ({
      ...child,
      assets: assetsByChild[child.user_id] || [],
    }));

    // Identify high-value items (e.g., unit_price > 50000 or electronics)
    const highValueCategories = ["electronics", "laptop", "tablet", "projector", "computer"];

    const highValueItems = assets.filter((asset: any) => {
      const item = asset.inventory_items as any;
      if (!item) return false;
      if (item.unit_price && item.unit_price > 50000) return true;
      const cat = (item.category || "").toLowerCase();
      return highValueCategories.some((hvc) => cat.includes(hvc));
    });

    return successResponse({
      children: enrichedChildren,
      total_assets: assets.length,
      high_value_count: highValueItems.length,
      high_value_assets: highValueItems,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load assets", 500);
  }
}
