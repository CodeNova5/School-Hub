import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: Fetch assets assigned to the current student
export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("Unauthorized", 401);

    // Get student's school_id
    const { data: student } = await supabase
      .from("students")
      .select("id, school_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!student) return errorResponse("Student record not found", 404);

    // Fetch assets assigned to this student's user_id
    const { data: assets, error } = await supabase
      .from("inventory_assets")
      .select("*, inventory_items(name, category, item_type, description)")
      .eq("school_id", student.school_id)
      .eq("assigned_user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return successResponse({ assets: assets || [] });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load your assets", 500);
  }
}
