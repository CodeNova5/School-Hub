import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const url = new URL(req.url);
    const status = (url.searchParams.get("status") || "pending").trim().toLowerCase();
    const search = (url.searchParams.get("search") || "").trim();

    let query = supabaseAdmin
      .from("website_alumni_applications")
      .select("*")
      .eq("school_id", permission.schoolId)
      .order("submitted_at", { ascending: false });

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      const escaped = search.replace(/,/g, " ").trim();
      query = query.or(
        [
          `full_name.ilike.%${escaped}%`,
          `occupation.ilike.%${escaped}%`,
          `email.ilike.%${escaped}%`,
        ].join(",")
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    return successResponse({ applications: data || [] });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load alumni applications", 500);
  }
}
