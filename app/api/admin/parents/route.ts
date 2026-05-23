import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import { deriveFamilyClusters, type FamilyLinkRecord, type FamilyParentRecord, type FamilyStudentRecord } from "@/lib/family-admin";

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

    const [{ data: parents, error: parentsError }, { data: students, error: studentsError }, { data: links, error: linksError }] = await Promise.all([
      supabaseAdmin
        .from("parents")
        .select("id, name, email, phone, is_active, created_at, school_id")
        .eq("school_id", permission.schoolId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("students")
        .select("id, student_id, first_name, last_name, created_at, school_id, class_id, classes(name)")
        .eq("school_id", permission.schoolId),
      supabaseAdmin
        .from("student_guardian_links")
        .select("student_id, guardian_id, relationship_type, is_primary_contact")
        .eq("school_id", permission.schoolId),
    ]);

    if (parentsError) throw parentsError;
    if (studentsError) throw studentsError;
    if (linksError) throw linksError;

    const normalizedParents: FamilyParentRecord[] = (parents || []).map((parent: any) => ({
      id: parent.id,
      name: parent.name,
      email: parent.email,
      phone: parent.phone,
      is_active: Boolean(parent.is_active),
      created_at: parent.created_at,
    }));

    const normalizedStudents: FamilyStudentRecord[] = (students || []).map((student: any) => ({
      id: student.id,
      student_id: student.student_id,
      first_name: student.first_name,
      last_name: student.last_name,
      created_at: student.created_at,
      class_id: student.class_id || null,
      class_name: student.classes?.name || null,
    }));

    const normalizedLinks: FamilyLinkRecord[] = (links || []).map((link: any) => ({
      student_id: link.student_id,
      guardian_id: link.guardian_id,
      relationship_type: link.relationship_type,
      is_primary_contact: Boolean(link.is_primary_contact),
    }));

    const { parents: parentSummaries, families } = deriveFamilyClusters({
      parents: normalizedParents,
      students: normalizedStudents,
      links: normalizedLinks,
    });

    const filteredParents = search
      ? parentSummaries.filter((parent) => {
          const haystack = [
            parent.name,
            parent.email,
            parent.phone || "",
            ...parent.students.map((student) => student.name),
            ...parent.students.map((student) => student.student_id || ""),
            ...parent.relationships,
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : parentSummaries;

    const parentIds = new Set(filteredParents.map((parent) => parent.id));
    const linkedFamilies = families.filter((family) => family.parents.some((parent) => parentIds.has(parent.id)));

    return successResponse({
      parents: filteredParents,
      families: linkedFamilies,
      totals: {
        parents: parentSummaries.length,
        families: families.length,
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load parents", 500);
  }
}

export async function PATCH(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();

    if (!id) {
      return errorResponse("Parent id is required", 400);
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === "string") payload.name = body.name.trim();
    if (typeof body.email === "string") payload.email = body.email.trim().toLowerCase();
    if (typeof body.phone === "string") payload.phone = body.phone.trim() || null;
    if (typeof body.is_active === "boolean") payload.is_active = body.is_active;

    const { error } = await supabaseAdmin
      .from("parents")
      .update(payload)
      .eq("id", id)
      .eq("school_id", permission.schoolId);

    if (error) throw error;

    return successResponse({ updated: true });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to update parent", 500);
  }
}