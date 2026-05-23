import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkIsAdminWithSchool, errorResponse, successResponse } from "@/lib/api-helpers";
import crypto from "crypto";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";
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
    const rawPage = Number(url.searchParams.get("page") || "1");
    const rawPageSize = Number(url.searchParams.get("pageSize") || "20");
    const statusFilter = (url.searchParams.get("status") || "").trim().toLowerCase();
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(Math.max(Math.floor(rawPageSize), 1), 200) : 20;

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

    let filteredParents = search
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

    // apply status filter if provided
    if (statusFilter === "active") {
      filteredParents = filteredParents.filter((p) => Boolean(p.is_active));
    } else if (statusFilter === "inactive") {
      filteredParents = filteredParents.filter((p) => !p.is_active);
    }

    const total = filteredParents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const start = (currentPage - 1) * pageSize;
    const paginatedParents = filteredParents.slice(start, start + pageSize);

    const parentIds = new Set(filteredParents.map((parent) => parent.id));
    const linkedFamilies = families.filter((family) => family.parents.some((parent) => parentIds.has(parent.id)));

    return successResponse({
      parents: paginatedParents,
      families: linkedFamilies,
      totals: {
        parents: parentSummaries.length,
        families: families.length,
      },
      meta: {
        page: currentPage,
        pageSize,
        total,
        totalPages,
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

export async function POST(req: NextRequest) {
  const permission = await checkIsAdminWithSchool();
  if (!permission.authorized || !permission.schoolId) {
    return errorResponse(permission.error || "Unauthorized", permission.status || 401);
  }

  let createdAuthUserId: string | null = null;
  let createdParentId: string | null = null;

  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim() || null;
    const relationshipType = String(body.relationship_type || "Guardian").trim() || "Guardian";
    const isPrimaryContact = Boolean(body.is_primary_contact ?? false);
    const selectedStudentIds = Array.isArray(body.student_ids)
      ? body.student_ids.map((value: any) => String(value || "").trim()).filter(Boolean)
      : [];
    const uniqueStudentIds = Array.from(new Set(selectedStudentIds));

    if (!name) {
      return errorResponse("Parent name is required", 400);
    }

    if (!email) {
      return errorResponse("Parent email is required", 400);
    }

    if (uniqueStudentIds.length === 0) {
      return errorResponse("Select at least one student to link", 400);
    }

    const { data: existingParent, error: parentLookupError } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", email)
      .eq("school_id", permission.schoolId)
      .maybeSingle();

    if (parentLookupError) {
      throw parentLookupError;
    }

    if (existingParent) {
      return errorResponse("A parent with this email already exists in this school", 409);
    }

    const { data: studentRecords, error: studentLookupError } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", permission.schoolId)
      .in("id", uniqueStudentIds);

    if (studentLookupError) {
      throw studentLookupError;
    }

    const resolvedStudentIds = new Set((studentRecords || []).map((student) => student.id));
    const missingStudentIds = uniqueStudentIds.filter((studentId) => !resolvedStudentIds.has(studentId));

    if (missingStudentIds.length > 0) {
      return errorResponse("One or more selected students were not found in this school", 400);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: false,
      user_metadata: {
        role: "parent",
        name,
      },
    });

    if (authError) {
      throw authError;
    }

    createdAuthUserId = authData.user.id;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { data: createdParent, error: parentInsertError } = await supabaseAdmin
      .from("parents")
      .insert({
        user_id: authData.user.id,
        email,
        name,
        phone,
        is_active: false,
        activation_token_hash: tokenHash,
        activation_expires_at: expiresAt,
        activation_used: false,
        school_id: permission.schoolId,
      })
      .select("id, name, email, phone, is_active, created_at")
      .single();

    if (parentInsertError) {
      throw parentInsertError;
    }

    createdParentId = createdParent.id;

    const linkRows = uniqueStudentIds.map((studentId) => ({
      school_id: permission.schoolId,
      student_id: studentId,
      guardian_id: createdParent.id,
      relationship_type: relationshipType,
      is_primary_contact: isPrimaryContact,
      has_legal_custody: false,
      can_pickup: true,
      updated_at: new Date().toISOString(),
    }));

    const { error: linkError } = await supabaseAdmin
      .from("student_guardian_links")
      .upsert(linkRows, { onConflict: "student_id,guardian_id" });

    if (linkError) {
      throw linkError;
    }

    const schoolName = await resolveSchoolName(supabaseAdmin, permission.schoolId);
    const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/parent/activate?token=${rawToken}`;
    await sendEmailSafe({
      to: email,
      fromName: buildSchoolSenderName(schoolName),
      subject: `Activate Your Parent Account - ${schoolName}`,
      html: `
        <p>Hello ${name},</p>
        <p>Your parent account has been created for <strong>${schoolName}</strong>.</p>
        <p>Click the link below to activate your account and set your password:</p>
        <p><a href="${activationLink}" style="color:#2563eb; text-decoration:none;">Activate Parent Account</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });

    return successResponse({
      parent: createdParent,
      linked_students: uniqueStudentIds,
      relationship_type: relationshipType,
      is_primary_contact: isPrimaryContact,
    }, 201);
  } catch (error: any) {
    if (createdParentId) {
      await supabaseAdmin.from("parents").delete().eq("id", createdParentId);
    }

    if (createdAuthUserId) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      } catch {
        // ignore cleanup failures
      }
    }

    return errorResponse(error.message || "Failed to create parent", 500);
  }
}