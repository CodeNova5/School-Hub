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
        .eq("school_id", permission.schoolId),
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

    const { families, parents: parentSummaries } = deriveFamilyClusters({
      parents: normalizedParents,
      students: normalizedStudents,
      links: normalizedLinks,
    });

    const filteredFamilies = search
      ? families.filter((family) => {
          const haystack = [
            family.family_name,
            family.family_id,
            ...family.parents.map((parent) => parent.name),
            ...family.parents.map((parent) => parent.email),
            ...family.students.map((student) => student.name),
            ...family.students.map((student) => student.student_id || ""),
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : families;

    const filteredParents = search
      ? parentSummaries.filter((parent) => {
          const haystack = [
            parent.name,
            parent.email,
            parent.phone || "",
            ...parent.students.map((student) => student.name),
            ...parent.students.map((student) => student.student_id || ""),
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(search);
        })
      : parentSummaries;

    return successResponse({
      families: filteredFamilies,
      parents: filteredParents,
      totals: {
        families: families.length,
        parents: parentSummaries.length,
      },
    });
  } catch (error: any) {
    return errorResponse(error.message || "Failed to load families", 500);
  }
}