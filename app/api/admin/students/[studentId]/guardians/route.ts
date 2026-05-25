import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const { studentId: rawStudentId } = await params;
    const body = await req.json();

    const studentId = String(rawStudentId || body.studentId || "").trim();
    const guardianId = String(body.guardianId || body.parentId || "").trim();
    const relationshipType = String(body.relationshipType || "Guardian").trim() || "Guardian";
    const isPrimaryContact = Boolean(body.isPrimaryContact ?? false);
    const hasLegalCustody = Boolean(body.hasLegalCustody ?? false);
    const canPickup = Boolean(body.canPickup ?? true);

    if (!studentId) {
      return errorResponse("Student id is required", 400);
    }

    if (!guardianId) {
      return errorResponse("Parent id is required", 400);
    }

    const [{ data: student, error: studentError }, { data: parent, error: parentError }] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, school_id")
        .eq("id", studentId)
        .maybeSingle(),
      supabaseAdmin
        .from("parents")
        .select("id, school_id")
        .eq("id", guardianId)
        .maybeSingle(),
    ]);

    if (studentError) {
      throw studentError;
    }

    if (parentError) {
      throw parentError;
    }

    if (!student) {
      return errorResponse("Student not found", 404);
    }

    if (!parent) {
      return errorResponse("Parent not found", 404);
    }

    if (student.school_id !== permission.schoolId || parent.school_id !== permission.schoolId) {
      return errorResponse("Student and parent must belong to the same school", 403);
    }

    const { error: linkError } = await supabaseAdmin
      .from("student_guardian_links")
      .upsert(
        {
          school_id: permission.schoolId,
          student_id: studentId,
          guardian_id: guardianId,
          relationship_type: relationshipType,
          is_primary_contact: isPrimaryContact,
          has_legal_custody: hasLegalCustody,
          can_pickup: canPickup,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,guardian_id" }
      );

    if (linkError) {
      throw linkError;
    }

    if (isPrimaryContact) {
      const { error: clearPrimaryError } = await supabaseAdmin
        .from("student_guardian_links")
        .update({ is_primary_contact: false, updated_at: new Date().toISOString() })
        .eq("school_id", permission.schoolId)
        .eq("student_id", studentId)
        .neq("guardian_id", guardianId);

      if (clearPrimaryError) {
        throw clearPrimaryError;
      }
    }

    return successResponse({
      linked: true,
      studentId,
      guardianId,
      relationshipType,
      isPrimaryContact,
      hasLegalCustody,
      canPickup,
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to link parent", 500);
  }
}