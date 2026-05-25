import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function escapeSearchTerm(value: string) {
  return value.replace(/[%_]/g, "\\$&").replace(/'/g, "''");
}

export async function GET(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || "").trim();
    const studentId = (url.searchParams.get("studentId") || "").trim();
    const rawPage = Number(url.searchParams.get("page") || "1");
    const rawPageSize = Number(url.searchParams.get("pageSize") || "10");

    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.floor(rawPageSize), 20) : 10;

    if (search.length < 2) {
      return successResponse({
        parents: [],
        meta: {
          page,
          pageSize,
          hasMore: false,
        },
      });
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const escapedSearch = escapeSearchTerm(search.toLowerCase());

    const { data: parentRows, error: parentError } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, phone, is_active, created_at")
      .eq("school_id", permission.schoolId)
      .or(`name.ilike.%${escapedSearch}%,email.ilike.%${escapedSearch}%`)
      .order("name", { ascending: true })
      .range(start, end);

    if (parentError) {
      throw parentError;
    }

    const rows = parentRows || [];
    const hasMore = rows.length > pageSize;
    const visibleParents = hasMore ? rows.slice(0, pageSize) : rows;

    let linkedParentIds = new Set<string>();

    if (studentId && visibleParents.length > 0) {
      const parentIds = visibleParents.map((parent: any) => parent.id).filter(Boolean);

      if (parentIds.length > 0) {
        const { data: linkRows, error: linkError } = await supabaseAdmin
          .from("student_guardian_links")
          .select("guardian_id")
          .eq("school_id", permission.schoolId)
          .eq("student_id", studentId)
          .in("guardian_id", parentIds);

        if (linkError) {
          throw linkError;
        }

        linkedParentIds = new Set((linkRows || []).map((row: any) => row.guardian_id).filter(Boolean));
      }
    }

    return successResponse({
      parents: visibleParents.map((parent: any) => ({
        id: parent.id,
        name: parent.name,
        email: parent.email,
        phone: parent.phone,
        is_active: Boolean(parent.is_active),
        created_at: parent.created_at,
        is_linked_to_student: linkedParentIds.has(parent.id),
      })),
      meta: {
        page,
        pageSize,
        hasMore,
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to search parents", 500);
  }
}