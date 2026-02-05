import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabase = createRouteHandlerClient({ cookies });

// Middleware to check permission
async function checkPermission(requiredPermission: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, error: "Unauthorized", status: 401 };
  }

  const { data: hasPermission } = await supabase.rpc("has_permission", {
    p_key: requiredPermission,
  });

  if (!hasPermission) {
    return { authorized: false, error: "Forbidden", status: 403 };
  }

  return { authorized: true };
}

// GET: Fetch admins, roles, permissions
export async function GET(req: NextRequest) {
  const permission = await checkPermission("manage_admins");
  if (!permission.authorized) {
    return NextResponse.json(
      { error: permission.error },
      { status: permission.status }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Fetch admins
    if (action === "admins" || !action) {
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

      const { data: permissions, error: permissionsError } = await supabase
        .from("permissions")
        .select("*")
        .order("key");

      if (permissionsError) throw permissionsError;

      const { data: rolePermissions, error: rolePermError } = await supabase
        .from("role_permissions")
        .select(`
          role_id,
          permission_id,
          permissions (
            id,
            key
          )
        `);

      if (rolePermError) throw rolePermError;

      const adminUsers = (adminsData || []).map((admin: any) => {
        const userRole = (userRoleLinks || []).find(
          (link: any) => link.user_id === admin.user_id
        );
        const roleInfo = Array.isArray(userRole?.roles) ? userRole?.roles[0] : userRole?.roles;
        const rolePerms = (rolePermissions || [])
          .filter((rp: any) => rp.role_id === roleInfo?.id)
          .map((rp: any) => rp.permissions[0]?.id || rp.permission_id) || [];

        return {
          id: admin.user_id,
          name: admin.name,
          email: admin.email,
          role: roleInfo?.name,
          role_id: roleInfo?.id,
          permissions: rolePerms,
          is_active: admin.is_active,
          status: admin.status,
        };
      });

      return NextResponse.json({
        admins: adminUsers,
        permissions,
        rolePermissions,
      });
    }

    // Fetch roles
    if (action === "roles") {
      const { data: roles, error } = await supabase
        .from("roles")
        .select("*")
        .order("name");

      if (error) throw error;
      return NextResponse.json({ roles });
    }

    throw new Error("Invalid action");
  } catch (error: any) {
    console.error("Error in GET:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch data" },
      { status: 500 }
    );
  }
}

// POST: Create admin, update admin, update role permissions, delete student
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

      // 1. Delete attendance records
      await supabaseAdmin
        .from("attendance")
        .delete()
        .eq("student_id", studentId);

      // 2. Delete results
      await supabaseAdmin
        .from("results")
        .delete()
        .eq("student_id", studentId);

      // 3. Delete class assignments
      await supabaseAdmin
        .from("class_assignments")
        .delete()
        .eq("student_id", studentId);

      // 4. Delete session/term links
      await supabaseAdmin
        .from("student_sessions")
        .delete()
        .eq("student_id", studentId);

      await supabaseAdmin
        .from("student_terms")
        .delete()
        .eq("student_id", studentId);

      // 5. Delete auth user if userId is provided
      if (userId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (authError: any) {
          console.error("Error deleting auth user:", authError);
          // Continue anyway, auth user might not exist
        }
      }

      // 6. Delete student record
      await supabaseAdmin
        .from("students")
        .delete()
        .eq("id", studentId);

      return NextResponse.json({ success: true });
    }

    // For other actions, check permission
    const permission = await checkPermission("manage_admins");
    if (!permission.authorized) {
      return NextResponse.json(
        { error: permission.error },
        { status: permission.status }
      );
    }

    const { email, name, userId, roleId, permissions: perms, permissionIds } = body;

    // Create new admin
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

      // Add role
      if (roleId) {
        await supabaseAdmin
          .from("user_role_links")
          .insert({ user_id: authData.user.id, role_id: roleId });
      }

      // Add permissions if admin role
      if (perms && Array.isArray(perms) && roleId) {
        const adminRole = await supabaseAdmin
          .from("roles")
          .select("id")
          .eq("name", "admin")
          .single();

        if (adminRole.data && roleId === adminRole.data.id) {
          const permissionInserts = perms.map((permId: string) => ({
            role_id: adminRole.data.id,
            permission_id: permId,
          }));
          await supabaseAdmin.from("role_permissions").insert(permissionInserts);
        }
      }

      return NextResponse.json({ success: true });
    }

    // Update admin role and permissions
    if (action === "update" && userId && roleId) {
      await supabase
        .from("user_role_links")
        .delete()
        .eq("user_id", userId);

      const { error: roleError } = await supabase
        .from("user_role_links")
        .insert({ user_id: userId, role_id: roleId });

      if (roleError) throw roleError;

      // Update permissions if admin role
      if (perms && Array.isArray(perms)) {
        const { data: adminRole } = await supabase
          .from("roles")
          .select("id")
          .eq("name", "admin")
          .single();

        if (adminRole && roleId === adminRole.id) {
          await supabase
            .from("role_permissions")
            .delete()
            .eq("role_id", adminRole.id);

          const permissionInserts = perms.map((permId: string) => ({
            role_id: adminRole.id,
            permission_id: permId,
          }));

          await supabase.from("role_permissions").insert(permissionInserts);
        }
      }

      return NextResponse.json({ success: true });
    }

    // Update role permissions
    if (action === "update-permissions" && roleId && permissionIds) {
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId);

      const permissionInserts = permissionIds.map((permId: string) => ({
        role_id: roleId,
        permission_id: permId,
      }));

      await supabase.from("role_permissions").insert(permissionInserts);
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
  const permission = await checkPermission("manage_admins");
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