import { NextRequest } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// GET: List admin alerts
export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread_only") === "true";
    const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);

    let query = supabase
      .from("admin_alerts")
      .select("*")
      .eq("school_id", permission.schoolId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq("is_read", false);

    const { data: alerts, error } = await query;
    if (error) throw error;

    // Get unread count
    const { count: unreadCount } = await supabase
      .from("admin_alerts")
      .select("*", { count: "exact", head: true })
      .eq("school_id", permission.schoolId)
      .eq("is_read", false);

    return successResponse({ alerts: alerts || [], unread_count: unreadCount || 0 });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load alerts", 500);
  }
}

// PATCH: Mark alert as read
export async function PATCH(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await req.json();
    const { id, is_read } = body;

    if (!id) return errorResponse("Alert ID is required", 400);

    const { error } = await supabase
      .from("admin_alerts")
      .update({ is_read: is_read ?? true })
      .eq("id", id)
      .eq("school_id", permission.schoolId);

    if (error) throw error;
    return successResponse({ message: "Alert updated" });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update alert", 500);
  }
}
