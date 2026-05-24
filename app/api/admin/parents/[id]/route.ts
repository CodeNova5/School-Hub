import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const { id } = await params;
    const parentId = String(id || "").trim();

    if (!parentId) {
      return errorResponse("Parent id is required", 400);
    }

    const { data: parent, error: parentError } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, phone, is_active")
      .eq("id", parentId)
      .eq("school_id", permission.schoolId)
      .maybeSingle();

    if (parentError) {
      throw parentError;
    }

    if (!parent) {
      return errorResponse("Parent not found", 404);
    }

    const { data: links, error: linksError } = await supabaseAdmin
      .from("student_guardian_links")
      .select("student_id")
      .eq("school_id", permission.schoolId)
      .eq("guardian_id", parentId);

    if (linksError) {
      throw linksError;
    }

    const studentIds = Array.from(new Set((links || []).map((row: any) => row.student_id).filter(Boolean)));

    let students: Array<{ id: string; student_id: string | null; name: string; class_name: string | null }> = [];

    if (studentIds.length > 0) {
      const { data: studentRows, error: studentsError } = await supabaseAdmin
        .from("students")
        .select("id, student_id, first_name, last_name, class_id, classes(name)")
        .eq("school_id", permission.schoolId)
        .in("id", studentIds);

      if (studentsError) {
        throw studentsError;
      }

      students = (studentRows || []).map((student: any) => ({
        id: student.id,
        student_id: student.student_id || null,
        name: [student.first_name, student.last_name].filter(Boolean).join(" ").trim() || "Unnamed Student",
        class_name: student.classes?.name || null,
      }));
    }

    return successResponse({
      parent: {
        ...parent,
        student_count: students.length,
        students,
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load parent", 500);
  }
}
