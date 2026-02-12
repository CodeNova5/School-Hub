import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import nodemailer from "nodemailer";

const supabase = createRouteHandlerClient({ cookies });

// Middleware to check if user is admin
async function checkIsAdmin() {
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

// GET: Fetch admins
export async function GET(req: NextRequest) {
  const permission = await checkIsAdmin();
  if (!permission.authorized) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.status }
    );
  }

  try {
    const { data: adminsData, error: adminsError } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: false });

    if (adminsError) throw adminsError;

    const { data: userRoleLinks, error: roleLinksError } = await supabase
      .from("user_role_links")
      .select(`
        user_id,
        roles (
          id,
          name
        )
      `);

    if (roleLinksError) throw roleLinksError;

    const adminUsers = (adminsData || []).map((admin: any) => {
      const userRole = (userRoleLinks || []).find(
        (link: any) => link.user_id === admin.user_id
      );
      const roleInfo = Array.isArray(userRole?.roles) ? userRole?.roles[0] : userRole?.roles;

      return {
        id: admin.user_id,
        name: admin.name,
        email: admin.email,
        role: roleInfo?.name || "super_admin",
        is_active: admin.is_active,
        status: admin.status,
      };
    });

    return NextResponse.json({ admins: adminUsers });
  } catch (error: any) {
    console.error("Error in GET:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch data" },
      { status: 500 }
    );
  }
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

    const { email, name } = body;

    // Create new admin (always as super_admin)
    if (action === "create" && email && name) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: existingAdmin } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingAdmin) {
        return NextResponse.json(
          { error: "Admin with this email already exists" },
          { status: 400 }
        );
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: Math.random().toString(36).slice(-12),
        email_confirm: false,
      });

      if (authError) throw authError;

      // Create admin record
      const { error: adminError } = await supabaseAdmin
        .from("admins")
        .insert({
          user_id: authData.user.id,
          email,
          name,
          is_active: true,
          status: "pending",
        });

      if (adminError) throw adminError;

      // Get super_admin role
      const { data: superAdminRole } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", "super_admin")
        .single();

      if (superAdminRole) {
        // Add super_admin role to user
        await supabaseAdmin
          .from("user_role_links")
          .insert({ user_id: authData.user.id, role_id: superAdminRole.id });
      }

      return NextResponse.json({ success: true });
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
            // 1. Fetch student details (department, religion)
            const { data: student, error: studentError } = await supabaseAdmin
              .from("students")
              .select("id, department, religion")
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
                subjects (
                  id,
                  name,
                  is_optional,
                  department,
                  religion
                )
              `)
              .eq("class_id", targetClassId);

            if (scError) throw scError;

            // 7. Filter subjects based on student's department and religion
            const filteredSubjects = (subjectClasses || []).filter((sc: any) => {
              const subject = sc.subjects;
              
              // Filter by department if applicable
              if (subject.department && student.department) {
                if (subject.department !== student.department) {
                  return false;
                }
              }

              // Filter by religion if applicable
              if (subject.religion && student.religion) {
                if (subject.religion !== student.religion) {
                  return false;
                }
              }

              return true;
            });

            // 8. Auto-select all compulsory subjects
            const subjectsToAssign = filteredSubjects
              .filter((sc: any) => !sc.subjects.is_optional)
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
        const { first_name, last_name, qualification, specialization, address, status, phone, email } = teacherData;

        // Get current teacher record
        const { data: currentTeacher } = await supabaseAdmin
          .from("teachers")
          .select("user_id, email")
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

            // Send activation email via nodemailer
            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });

            const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/teacher/activate?token=${rawToken}`;

            await transporter.sendMail({
              from: `"School Hub" <${process.env.EMAIL_USER}>`,
              to: email,
              subject: "Activate Your Updated Teacher Account",
              html: `
                <p>Hello ${first_name},</p>
                <p>Your email address has been updated.</p>
                <p>Click the link below to activate your account with the new email:</p>
                <p><a href="${activationLink}">Activate Account</a></p>
                <p>This link expires in 24 hours.</p>
              `,
            });
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

// DELETE: Remove admin
export async function DELETE(req: NextRequest) {
  const permission = await checkIsAdmin();
  if (!permission.authorized) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.status }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Remove role links
    await supabase
      .from("user_role_links")
      .delete()
      .eq("user_id", userId);

    // Delete admin record
    await supabaseAdmin
      .from("admins")
      .delete()
      .eq("user_id", userId);

    // Delete auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) throw deleteUserError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete admin" },
      { status: 500 }
    );
  }
}
