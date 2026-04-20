import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware to check if user is admin
async function checkIsAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}

// POST: Create admin or delete student
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    // Delete student - no permission check needed (handled separately)
    if (action === "delete-student") {
      const { studentId, userId } = body;

      if (!studentId) {
        return NextResponse.json(
          { error: "Student ID required" },
          { status: 400 }
        );
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // First, get the student to find their user_id if not provided
      let userIdToDelete = userId;
      if (!userIdToDelete) {
        const { data: studentData } = await supabaseAdmin
          .from("students")
          .select("user_id")
          .eq("id", studentId)
          .single();

        userIdToDelete = studentData?.user_id;
      }

      // 1. Delete attendance records
      const { error: attendanceError } = await supabaseAdmin
        .from("attendance")
        .delete()
        .eq("student_id", studentId);

      // 2. Delete results for current term only
      const { data: currentTerm } = await supabaseAdmin
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .single();

      const { error: resultsError } = currentTerm
        ? await supabaseAdmin
          .from("results")
          .delete()
          .eq("student_id", studentId)
          .eq("term_id", currentTerm.id)
        : { error: null };

      // 5. Delete student_subjects
      const { error: studentSubjectsError } = await supabaseAdmin
        .from("student_subjects")
        .delete()
        .eq("student_id", studentId);

      // 6. Delete student_optional_subjects
      const { error: optionalError } = await supabaseAdmin
        .from("student_optional_subjects")
        .delete()
        .eq("student_id", studentId);

      // 7. Delete assignment submissions
      const { error: submissionsError } = await supabaseAdmin
        .from("assignment_submissions")
        .delete()
        .eq("student_id", studentId);

      // 8. Delete auth user FIRST before student record
      if (userIdToDelete) {
        try {
          const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);
          if (deleteUserError) {
            console.error("Error deleting auth user:", deleteUserError);
            // Continue anyway
          }
        } catch (authError: any) {
          console.error("Error deleting auth user:", authError);
          // Continue anyway
        }
      }

      // 9. Finally, delete student record
      const { error: studentError } = await supabaseAdmin
        .from("students")
        .delete()
        .eq("id", studentId);

      if (studentError || attendanceError || resultsError || studentSubjectsError) {
        throw new Error(
          studentError?.message ||
          attendanceError?.message ||
          resultsError?.message ||
          "Failed to delete some student data"
        );
      }

      return NextResponse.json({ success: true });
    }

    // For other actions, check permission
    const permission = await checkIsAdmin();
    if (!permission.authorized) {
      return NextResponse.json(
        { error: permission.error },
        { status: permission.status }
      );
    }


    // Transfer students to another class with subject reassignment
    if (action === "transfer-students") {
      const { studentIds, targetClassId } = body;

      if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
        return NextResponse.json(
          { error: "Student IDs required" },
          { status: 400 }
        );
      }

      if (!targetClassId) {
        return NextResponse.json(
          { error: "Target class ID required" },
          { status: 400 }
        );
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      let transferred = 0;
      let failed = 0;

      try {
        // Fetch target class details
        const { data: targetClass, error: classError } = await supabaseAdmin
          .from("classes")
          .select("id, name")
          .eq("id", targetClassId)
          .single();

        if (classError || !targetClass) {
          throw new Error("Target class not found");
        }

        for (const studentId of studentIds) {
          try {
            // 1. Fetch student details (department_id, religion_id)
            const { data: student, error: studentError } = await supabaseAdmin
              .from("students")
              .select("id, department_id, religion_id")
              .eq("id", studentId)
              .single();

            if (studentError || !student) {
              throw new Error("Student not found");
            }

            // 2. Delete old results for current term only
            const { data: currentTerm } = await supabaseAdmin
              .from("terms")
              .select("id")
              .eq("is_current", true)
              .single();

            if (currentTerm) {
              await supabaseAdmin
                .from("results")
                .delete()
                .eq("student_id", studentId)
                .eq("term_id", currentTerm.id);
            }

            // 3. Delete old student_subjects
            await supabaseAdmin
              .from("student_subjects")
              .delete()
              .eq("student_id", studentId);

            // 4. Delete old optional subjects
            await supabaseAdmin
              .from("student_optional_subjects")
              .delete()
              .eq("student_id", studentId);

            // 5. Update student's class
            await supabaseAdmin
              .from("students")
              .update({ class_id: targetClassId })
              .eq("id", studentId);

            // 6. Fetch available subject_classes for target class
            const { data: subjectClasses, error: scError } = await supabaseAdmin
              .from("subject_classes")
              .select(`
                id,
                subject_id,
                is_optional,
                department_id,
                religion_id,
                subjects!subject_classes_subject_id_fkey (
                  id,
                  name
                )
              `)
              .eq("class_id", targetClassId);

            if (scError) throw scError;

            // 7. Filter subjects based on student's department_id and religion_id
            const filteredSubjects = (subjectClasses || []).filter((sc: any) => {
              // Filter by department_id if applicable
              if (sc.department_id && student.department_id) {
                if (sc.department_id !== student.department_id) {
                  return false;
                }
              }

              // Filter by religion_id if applicable
              if (sc.religion_id && student.religion_id) {
                if (sc.religion_id !== student.religion_id) {
                  return false;
                }
              }

              return true;
            });

            // 8. Auto-select all compulsory subjects
            const subjectsToAssign = filteredSubjects
              .filter((sc: any) => !sc.is_optional)
              .map((sc: any) => ({
                student_id: studentId,
                subject_class_id: sc.id,
              }));

            // 9. Insert compulsory subjects if any
            if (subjectsToAssign.length > 0) {
              const { error: insertError } = await supabaseAdmin
                .from("student_subjects")
                .insert(subjectsToAssign);

              if (insertError) throw insertError;
            }

            transferred++;
          } catch (error) {
            console.error(`Failed to transfer student ${studentId}:`, error);
            failed++;
          }
        }

        return NextResponse.json({
          success: true,
          transferred,
          failed,
          message: `Transferred ${transferred} student(s) with automatic subject assignments.`
        });
      } catch (error: any) {
        throw new Error(`Transfer failed: ${error.message}`);
      }
    }

    // Update teacher details
    if (action === "update-teacher") {
      const permission = await checkIsAdmin();
      if (!permission.authorized) {
        return NextResponse.json(
          { error: permission.error },
          { status: permission.status }
        );
      }

      const { teacherId, teacherData, oldEmail } = body;

      if (!teacherId || !teacherData) {
        return NextResponse.json(
          { error: "Teacher ID and teacher data required" },
          { status: 400 }
        );
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      try {
        const { first_name, last_name, qualification, specialization, address, status, phone, email, photo_url } = teacherData;

        // Get current teacher record
        const { data: currentTeacher } = await supabaseAdmin
          .from("teachers")
          .select("user_id, email, school_id")
          .eq("id", teacherId)
          .single();

        // Check if email is being changed
        const emailChanged = email && oldEmail && email !== oldEmail;

        // Update teacher record
        const updateData: any = {
          first_name,
          last_name,
          qualification,
          specialization,
          address,
          status,
          phone,
        };

        // Add photo_url if provided
        if (photo_url) {
          updateData.photo_url = photo_url;
        }

        if (emailChanged) {
          updateData.email = email;
          // Reset activation when email changes
          updateData.activation_used = false;
          updateData.is_active = false;
        }

        const { error: updateError } = await supabaseAdmin
          .from("teachers")
          .update(updateData)
          .eq("id", teacherId);

        if (updateError) throw updateError;

        // If email changed, handle auth and send activation email
        if (emailChanged) {
          try {
            // Case 1: Teacher already has an auth account
            if (currentTeacher?.user_id) {
              // Update the auth user email
              const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
                currentTeacher.user_id,
                { email }
              );

              if (updateAuthError) {
                console.error("Error updating auth user email:", updateAuthError);
              }
            } else {
              // Case 2: Teacher doesn't have an auth account, create one
              const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: crypto.randomUUID(),
                email_confirm: true,
                user_metadata: { role: "teacher" },
              });

              if (authError) {
                console.error("Error creating auth user:", authError);
              } else if (authData?.user?.id) {
                // Update teacher record with the new user_id
                await supabaseAdmin
                  .from("teachers")
                  .update({ user_id: authData.user.id })
                  .eq("id", teacherId);
              }
            }

            // Generate activation token
            const rawToken = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

            // Update activation token
            await supabaseAdmin
              .from("teachers")
              .update({
                activation_token_hash: tokenHash,
                activation_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
              })
              .eq("id", teacherId);

            const schoolName = await resolveSchoolName(
              supabaseAdmin,
              currentTeacher?.school_id
            );

            const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/teacher/activate?token=${rawToken}`;

            const mailError = await sendEmailSafe({
              to: email,
              fromName: buildSchoolSenderName(schoolName),
              subject: `Activate Your Updated Teacher Account - ${schoolName}`,
              html: `
                <p>Hello ${first_name},</p>
                <p>Your email address has been updated for <strong>${schoolName}</strong> in School Deck.</p>
                <p>Click the link below to activate your account with the new email:</p>
                <p><a href="${activationLink}">Activate Account</a></p>
                <p>This link expires in 24 hours.</p>
              `,
            });

            if (mailError) {
              throw new Error(mailError);
            }
          } catch (emailError: any) {
            console.error("Error handling email change:", emailError);
            // Continue anyway - teacher record was updated
          }
        }

        return NextResponse.json({
          success: true,
          emailChanged,
        });
      } catch (error: any) {
        throw new Error(`Failed to update teacher: ${error.message}`);
      }
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("Error in POST:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

