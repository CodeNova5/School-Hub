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
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || "100") || 100, 1), 200);

    let query = supabaseAdmin
      .from("students")
      .select("id, student_id, first_name, last_name, email, phone, is_active, class_id, classes(name), created_at")
      .eq("school_id", permission.schoolId)
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true })
      .limit(pageSize);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,student_id.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: students, error } = await query;
    if (error) throw error;

    const formatted = (students || []).map((student: any) => ({
      id: student.id,
      student_id: student.student_id,
      name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      email: student.email || null,
      phone: student.phone || null,
      is_active: Boolean(student.is_active),
      class_name: student.classes?.name || null,
      created_at: student.created_at,
    }));

    return successResponse({ students: formatted });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load students", 500);
  }
}
