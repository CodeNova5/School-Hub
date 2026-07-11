import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import crypto from "crypto";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Resolve the school_id for the admin making the request.
 * Falls back to the default school id if no school is found.
 */
async function getCallerSchoolId(): Promise<string | null> {
  const routeClient = createRouteHandlerClient({ cookies });
  const { data: { user } } = await routeClient.auth.getUser();
  if (!user) return null;
  const { data } = await routeClient.rpc("get_my_school_id");
  return data ?? null;
}

// Update generateUniqueStudentId to accept a client parameter
async function generateUniqueStudentId(client?: any): Promise<string> {
  const db = client || supabase;
  let studentId: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Format: STU + 6 random digits (e.g., STU123456)
    const randomNum = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    studentId = `STU${randomNum}`;

    // Check if this ID already exists
    const { data: existingStudent } = await db
      .from('students')
      .select('id')
      .eq('student_id', studentId)
      .single();

    if (!existingStudent) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique student ID after multiple attempts');
  }

  return studentId!;
}

function normalizeGuardianInput(studentData: Record<string, any>) {
  const primaryGuardian = Array.isArray(studentData.guardians) && studentData.guardians.length > 0
    ? studentData.guardians[0]
    : null;

  const guardianName = String(
    studentData.guardian_name
      ?? studentData.parent_name
      ?? primaryGuardian?.guardian_name
      ?? primaryGuardian?.name
      ?? ""
  ).trim();
  const guardianEmail = String(
    studentData.guardian_email
      ?? studentData.parent_email
      ?? primaryGuardian?.guardian_email
      ?? primaryGuardian?.email
      ?? ""
  ).trim();
  const guardianPhone = String(
    studentData.guardian_phone
      ?? studentData.parent_phone
      ?? primaryGuardian?.guardian_phone
      ?? primaryGuardian?.phone
      ?? ""
  ).trim();

  return {
    guardianName,
    guardianEmail,
    guardianPhone: guardianPhone || null,
    relationshipType: String(studentData.relationship_type ?? "Guardian").trim() || "Guardian",
    isPrimaryContact: Boolean(studentData.is_primary_contact ?? true),
    hasLegalCustody: Boolean(studentData.has_legal_custody ?? false),
    canPickup: Boolean(studentData.can_pickup ?? true),
  };
}

function getPrimaryGuardianId(studentData: Record<string, any>) {
  const primaryGuardian = Array.isArray(studentData.guardians) && studentData.guardians.length > 0
    ? studentData.guardians[0]
    : null;

  return String(studentData.guardian_id ?? primaryGuardian?.guardian_id ?? "").trim() || null;
}

export async function POST(req: Request) {
  try {
    const studentData = await req.json();
    const supabaseAuth = createRouteHandlerClient({ cookies });
    const warnings: string[] = [];
    const guardianInput = normalizeGuardianInput(studentData);
    const primaryGuardianId = getPrimaryGuardianId(studentData);

    if (!guardianInput.guardianName) {
      return NextResponse.json({ error: "Guardian name is required" }, { status: 400 });
    }

    if (!guardianInput.guardianEmail && !primaryGuardianId) {
      return NextResponse.json({ error: "Guardian email is required" }, { status: 400 });
    }

    // Resolve school_id: prefer explicit body param (internal calls), else from caller session
    let schoolId: string | null = studentData.school_id ?? null;
    if (!schoolId) {
      schoolId = await getCallerSchoolId();
    }
    if (!schoolId) {
      return NextResponse.json({ error: "Unable to determine school context" }, { status: 400 });
    }
    const schoolName = await resolveSchoolName(supabaseAuth, schoolId);

    // Generate unique student ID
    const generatedStudentId = await generateUniqueStudentId(supabaseAuth);

    // Determine if student has their own email or using parent's
    const hasOwnEmail = studentData.email && studentData.email.trim() !== '';
    const studentEmail = hasOwnEmail ? studentData.email : guardianInput.guardianEmail;
    const studentIsActive = !hasOwnEmail; // Only active if no own email (using parent's)

    // 1️⃣ Create auth user for student ONLY if they have their own email
    let authUserId: string | null = null;

    if (hasOwnEmail) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: studentEmail,
        password: crypto.randomUUID(),
        email_confirm: false, // They need to activate
        user_metadata: {
          role: "student",
          student_id: generatedStudentId,
          first_name: studentData.first_name,
          last_name: studentData.last_name,
          name: `${studentData.first_name} ${studentData.last_name}`.trim(),
        },
      });

      if (authError) throw authError;
      authUserId = authData.user.id;
    }

    let parentUserId: string;
    let parentRecordId: string | null = null;
    let isNewParent = false;

    if (primaryGuardianId) {
      const { data: parentById, error: parentByIdError } = await supabaseAuth
        .from("parents")
        .select("id, user_id, school_id")
        .eq("id", primaryGuardianId)
        .maybeSingle();

      if (parentByIdError) throw parentByIdError;
      if (!parentById) {
        return NextResponse.json({ error: "Selected guardian record does not exist" }, { status: 400 });
      }
      if (parentById.school_id && parentById.school_id !== schoolId) {
        return NextResponse.json({ error: "Selected guardian belongs to another school" }, { status: 400 });
      }

      parentUserId = parentById.user_id;
      parentRecordId = parentById.id;
    } else {
      // 2️⃣ Check if parent already exists
      const { data: existingParent } = await supabaseAuth
        .from("parents")
        .select("*")
        .eq("email", guardianInput.guardianEmail)
        .single();

      if (existingParent) {
        if (existingParent.school_id && existingParent.school_id !== schoolId) {
          return NextResponse.json({ error: "Guardian email already belongs to another school" }, { status: 400 });
        }

        parentUserId = existingParent.user_id;
        parentRecordId = existingParent.id;

        const { error: parentUpdateError } = await supabaseAuth
          .from("parents")
          .update({
            name: guardianInput.guardianName,
            phone: guardianInput.guardianPhone,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingParent.id);

        if (parentUpdateError) throw parentUpdateError;
        // Do not create new parent or send activation email
      } else {
        // Create new parent auth user
        const { data: parentAuthData, error: parentAuthError } = await supabase.auth.admin.createUser({
          email: guardianInput.guardianEmail,
          password: crypto.randomUUID(),
          email_confirm: false,
          user_metadata: {
            role: "parent",
            name: guardianInput.guardianName,
          },
        });

        if (parentAuthError) throw parentAuthError;
        parentUserId = parentAuthData.user.id;
        isNewParent = true;

        // Generate activation token for parent
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto
          .createHash("sha256")
          .update(rawToken)
          .digest("hex");

        // Create parent record — use authenticated client for audit identity
        const { error: parentInsertError } = await supabaseAuth.from("parents").insert({
          user_id: parentUserId,
          email: guardianInput.guardianEmail,
          name: guardianInput.guardianName,
          phone: guardianInput.guardianPhone,
          is_active: false,
          activation_token_hash: tokenHash,
          activation_expires_at: new Date(Date.now() + 86400000),
          activation_used: false,
          school_id: schoolId,
        });

        if (parentInsertError) throw parentInsertError;

        const { data: createdParent, error: parentLookupError } = await supabaseAuth
          .from("parents")
          .select("id")
          .eq("email", guardianInput.guardianEmail)
          .single();

        if (parentLookupError || !createdParent?.id) {
          throw parentLookupError || new Error("Failed to resolve guardian record");
        }

        parentRecordId = createdParent.id;

        // Store token for email after core create flow succeeds
        (studentData as any).__parentActivationToken = rawToken;
      }
    }

    if (!parentRecordId && guardianInput.guardianEmail) {
      const { data: resolvedParent, error: parentLookupError } = await supabaseAuth
        .from("parents")
        .select("id")
        .eq("email", guardianInput.guardianEmail)
        .single();

      if (parentLookupError || !resolvedParent?.id) {
        throw parentLookupError || new Error("Failed to resolve guardian record");
      }

      parentRecordId = resolvedParent.id;
    }

    // 3️⃣ Create student row with generated ID
    const studentInsertData = {
      first_name: studentData.first_name,
      last_name: studentData.last_name,
      email: studentEmail,
      phone: studentData.phone || studentData.parent_phone || null,
      date_of_birth: studentData.date_of_birth || null,
      gender: studentData.gender || null,
      address: studentData.address || null,
      class_id: studentData.class_id || null,
      department_id: studentData.department_id || null,
      religion_id: studentData.religion_id || null,
      // Legacy parent snapshot removed: use student_guardian_links instead
      admission_date: studentData.admission_date,
      student_id: generatedStudentId,
      user_id: authUserId, // Will be null if no own email
      is_active: studentIsActive,
      status: "active",
      school_id: schoolId,
      image_url: studentData.image_url || null,
    };

    const { data: createdStudent, error: studentError } = await supabaseAuth
      .from("students")
      .insert(studentInsertData)
      .select()
      .single();

    if (studentError) throw studentError;

    // Support multiple guardians: either `guardians` array in request body, or single guardianInput
    const guardiansList = Array.isArray(studentData.guardians) && studentData.guardians.length > 0
      ? studentData.guardians
      : [ {
        guardian_name: guardianInput.guardianName,
        guardian_email: guardianInput.guardianEmail,
        guardian_phone: guardianInput.guardianPhone,
        relationship_type: guardianInput.relationshipType,
        is_primary_contact: guardianInput.isPrimaryContact,
        has_legal_custody: guardianInput.hasLegalCustody,
        can_pickup: guardianInput.canPickup,
      } ];

    // For each guardian, ensure parent record/auth exists and upsert student_guardian_links
    const parentActivationTokens: Array<{ email: string; token: string } > = [];

    // If an activation token was created earlier for the primary guardian, queue it
    if ((studentData as any).__parentActivationToken) {
      parentActivationTokens.push({ email: guardianInput.guardianEmail, token: (studentData as any).__parentActivationToken });
      delete (studentData as any).__parentActivationToken;
    }

    for (const g of guardiansList) {
      const gGuardianId = String(g.guardian_id ?? "").trim() || null;
      const gName = String(g.guardian_name ?? g.name ?? "").trim();
      const gEmail = String(g.guardian_email ?? g.email ?? "").trim();
      const gPhone = String(g.guardian_phone ?? g.phone ?? "").trim() || null;
      const gRelationship = String(g.relationship_type ?? "Guardian").trim() || "Guardian";
      const gIsPrimary = Boolean(g.is_primary_contact ?? false);
      const gHasLegal = Boolean(g.has_legal_custody ?? false);
      const gCanPickup = Boolean(g.can_pickup ?? true);

      if (!gGuardianId && (!gEmail || !gName)) {
        // skip incomplete guardian entries
        continue;
      }

      let parentId: string | null = null;
      let createdNewParent = false;

      if (gGuardianId) {
        const { data: existingById, error: existingByIdError } = await supabaseAuth
          .from("parents")
          .select("id, school_id")
          .eq("id", gGuardianId)
          .maybeSingle();

        if (existingByIdError) throw existingByIdError;

        if (!existingById) {
          warnings.push("One linked guardian could not be found");
          continue;
        }

        if (existingById.school_id && existingById.school_id !== schoolId) {
          warnings.push("One linked guardian belongs to another school");
          continue;
        }

        parentId = existingById.id;
      } else {
        // Check for existing parent record
        const { data: existingP } = await supabaseAuth
          .from("parents")
          .select("*")
          .eq("email", gEmail)
          .single();

        if (existingP) {
          if (existingP.school_id && existingP.school_id !== schoolId) {
            warnings.push(`Guardian ${gEmail} already belongs to another school`);
            continue;
          }

          parentId = existingP.id;

          const { error: updateErr } = await supabaseAuth
            .from("parents")
            .update({ name: gName, phone: gPhone, updated_at: new Date().toISOString() })
            .eq("id", existingP.id);

          if (updateErr) throw updateErr;
        } else {
          // Create supabase auth user for parent
          const { data: parentAuthData, error: parentAuthError } = await supabase.auth.admin.createUser({
            email: gEmail,
            password: crypto.randomUUID(),
            email_confirm: false,
            user_metadata: { role: "parent", name: gName },
          });

          if (parentAuthError) throw parentAuthError;

          const rawToken = crypto.randomBytes(32).toString("hex");
          const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

          const { error: parentInsertError } = await supabaseAuth.from("parents").insert({
            user_id: parentAuthData.user.id,
            email: gEmail,
            name: gName,
            phone: gPhone,
            is_active: false,
            activation_token_hash: tokenHash,
            activation_expires_at: new Date(Date.now() + 86400000),
            activation_used: false,
            school_id: schoolId,
          });

          if (parentInsertError) throw parentInsertError;

          const { data: createdP, error: parentLookupError } = await supabaseAuth
            .from("parents")
            .select("id")
            .eq("email", gEmail)
            .single();

          if (parentLookupError || !createdP?.id) throw parentLookupError || new Error("Failed to resolve created guardian");

          parentId = createdP.id;
          createdNewParent = true;
          parentActivationTokens.push({ email: gEmail, token: rawToken });
        }
      }

      if (!parentId) continue;

      const { error: linkError } = await supabaseAuth
        .from("student_guardian_links")
        .upsert({
          school_id: schoolId,
          student_id: createdStudent.id,
          guardian_id: parentId,
          relationship_type: gRelationship,
          is_primary_contact: gIsPrimary,
          has_legal_custody: gHasLegal,
          can_pickup: gCanPickup,
        }, { onConflict: "student_id,guardian_id" });

      if (linkError) throw linkError;
    }

    // 3.5️⃣ If student has own email, generate and send activation token link
    if (hasOwnEmail) {
      // Generate activation token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      // Save token in students table — use authenticated client for audit identity
      const { error: studentTokenError } = await supabaseAuth
        .from("students")
        .update({
          activation_token_hash: tokenHash,
          activation_expires_at: new Date(Date.now() + 86400000), // 24 hours expiry
          activation_used: false,
        })
        .eq("id", createdStudent.id);

      if (studentTokenError) {
        throw studentTokenError;
      }

      const activationLink =
        `${process.env.NEXT_PUBLIC_APP_URL}/student/activate?token=${rawToken}`;

      const studentMailError = await sendEmailSafe({
        to: studentData.email,
        fromName: buildSchoolSenderName(schoolName),
        subject: `Activate Your Student Account - ${schoolName}`,
        html: `
      <p>Hello ${studentData.first_name},</p>
      <p>Your student account has been created for <strong>${schoolName}</strong>.</p>
      <p>Click the link below to activate your account and set your password:</p>
      <p>
        <a href="${activationLink}" style="color:#2563eb;">
          Activate Account
        </a>
      </p>
      <p>This link expires in 24 hours.</p>
      <p>Welcome to School Deck.</p>
    `,
      });

      if (studentMailError) {
        warnings.push(`Student activation email was not delivered: ${studentMailError}`);
      }
    }

    // 3.6️⃣ Automatically assign subjects based on religion and department
    if (studentData.class_id) {
      const { data: subjectClassesData, error: subjectClassesError } = await supabaseAuth
        .from("subject_classes")
        .select(`
          id,
          subject_id,
          subjects (
            id,
            name,
            department_id,
            religion_id,
            is_optional
          )
        `)
        .eq("class_id", studentData.class_id);

      if (!subjectClassesError && subjectClassesData) {
        const eligibleSubjectClasses = subjectClassesData.filter((sc: any) => {
          const subject = Array.isArray(sc.subjects) ? sc.subjects[0] : sc.subjects;

          if (subject.department_id && studentData.department_id) {
            if (subject.department_id !== studentData.department_id) {
              return false;
            }
          }

          if (subject.religion_id && studentData.religion_id) {
            if (subject.religion_id !== studentData.religion_id) {
              return false;
            }
          }

          return !subject.is_optional;
        });

        if (eligibleSubjectClasses.length > 0) {
          const studentSubjectsToInsert = eligibleSubjectClasses.map((sc: any) => ({
            student_id: createdStudent.id,
            subject_class_id: sc.id,
          }));

          const { error: studentSubjectsError } = await supabaseAuth
            .from("student_subjects")
            .insert(studentSubjectsToInsert);

          if (studentSubjectsError) {
            console.error("Error inserting student subjects:", studentSubjectsError);
          }
        }
      }
    }

    // 4️⃣ Send parent notifications (best effort; do not fail student creation)
    // Send activation emails to any newly-created parents
    for (const p of parentActivationTokens) {
      const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/parent/activate?token=${p.token}`;
      const parentMailError = await sendEmailSafe({
        to: p.email,
        fromName: buildSchoolSenderName(schoolName),
        subject: `Activate Your Parent Portal Account - ${schoolName}`,
        html: `
          <p>Hello,</p>
          <p>A parent portal account has been created at <strong>${schoolName}</strong> for your child/ward: <strong>${studentData.first_name} ${studentData.last_name}</strong>.</p>
          <p>Student ID: <strong>${generatedStudentId}</strong></p>
          <p>Click the link below to activate your parent portal account and set your password:</p>
          <p>
            <a href="${activationLink}" style="color:#2563eb;">Activate Parent Account</a>
          </p>
          <p>This link expires in 24 hours.</p>
          <p>Powered by School Deck.</p>
        `,
      });

      if (parentMailError) warnings.push(`Parent activation email was not delivered: ${parentMailError}`);
    }

    // Notify existing active parents that a new student has been added to their account
    try {
      const guardianEmails = guardiansList.map((g: any) => String(g.guardian_email ?? g.email ?? "").trim()).filter(Boolean);
      if (guardianEmails.length > 0) {
        const { data: parentsRecords } = await supabaseAuth
          .from("parents")
          .select("email,name,is_active")
          .in("email", guardianEmails);

        if (parentsRecords && Array.isArray(parentsRecords)) {
          for (const parentRec of parentsRecords) {
            if (parentRec.is_active) {
              const existingParentMailError = await sendEmailSafe({
                to: parentRec.email,
                fromName: buildSchoolSenderName(schoolName),
                subject: `New Student Added to Your Account - ${schoolName}`,
                html: `
                  <p>Hello ${parentRec.name || ''},</p>
                  <p>A new student has been added to your ${schoolName} parent portal account:</p>
                  <p><strong>${studentData.first_name} ${studentData.last_name}</strong> (ID: ${generatedStudentId})</p>
                  <p>You can now view their information in your parent portal.</p>
                  <p>Powered by School Deck.</p>
                `,
              });

              if (existingParentMailError) warnings.push(`Parent notification email was not delivered: ${existingParentMailError}`);
            }
          }
        }
      }
    } catch (err) {
      // best-effort notifications only
    }

    return NextResponse.json({
      success: true,
      studentId: generatedStudentId,
      message: warnings.length > 0
        ? `Student created, but email delivery failed (${warnings.length} issue${warnings.length > 1 ? "s" : ""}).`
        : hasOwnEmail
          ? "Student created. Activation link sent to student email."
          : "Student created. Using parent portal for now.",
      warnings,
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message },
      { status: 500 }
    );
  }
}