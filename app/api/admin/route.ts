import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

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

      // 2. Delete results
      const { error: resultsError } = await supabaseAdmin
        .from("results")
        .delete()
        .eq("student_id", studentId);

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
