import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function sanitizeSearchTerm(value: string) {
  return value.replace(/[,*()]/g, " ").replace(/\s+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const url = new URL(req.url);
    const rawQuery = String(url.searchParams.get("q") || "").trim();
    const includeInactive = String(url.searchParams.get("includeInactive") || "false").toLowerCase() === "true";
    const rawLimit = Number(url.searchParams.get("limit") || "12");
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 50) : 12;

    const queryTerm = sanitizeSearchTerm(rawQuery);

    let query = supabaseAdmin
      .from("parents")
      .select("id, name, email, phone, is_active, created_at")
      .eq("school_id", permission.schoolId)
      .order("created_at", { ascending: false })
      .limit(limit + 1);

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (queryTerm) {
      query = query.or(`name.ilike.*${queryTerm}*,email.ilike.*${queryTerm}*`);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    const rows = data || [];
    const hasMore = rows.length > limit;

    const guardians = rows.slice(0, limit).map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || null,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
    }));

    return successResponse({
      guardians,
      hasMore,
      query: queryTerm,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to search guardians", 500);
  }
}
