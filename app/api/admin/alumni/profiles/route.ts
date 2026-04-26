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
    const search = (url.searchParams.get("search") || "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "10")));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabaseAdmin
      .from("website_alumni_profiles")
      .select("*", { count: "exact" })
      .eq("school_id", permission.schoolId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      const escaped = search.replace(/,/g, " ").trim();
      query = query.or(
        [
          `full_name.ilike.%${escaped}%`,
          `occupation.ilike.%${escaped}%`,
          `profile_slug.ilike.%${escaped}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return successResponse({
      profiles: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / pageSize)),
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load alumni profiles", 500);
  }
}
