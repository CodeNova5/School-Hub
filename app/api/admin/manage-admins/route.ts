import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has manage_admins permission
  const { data: hasPermission } = await supabase.rpc("has_permission", {
    p_key: "manage_admins",
  });

  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all admins with their roles and permissions
  const { data: admins, error: adminsError } = await supabase
    .from("user_role_links")
    .select(
      `
      user_id,
      roles (
        id,
        name
      )
    `
    )
    .order("user_id");

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 500 });
  }

  // Get user details from auth.users
  interface AdminRole {
    id: string;
    name: string;
  }

  interface Admin {
    user_id: string;
    roles: AdminRole[];
  }

  interface UserInfo {
    id: string;
    email: string;
  }

  interface Permission {
    id: string;
    key: string;
  }

  interface RolePermission {
    role_id: string;
    permission_id: string;
    permissions: Permission[];
  }

  const userIds: string[] = Array.from(
    new Set((admins as Admin[] | undefined)?.map((a: Admin) => a.user_id) || [])
  );
  
  const { data: users, error: usersError } = await supabase.rpc(
    "get_admin_users",
    { user_ids: userIds }
  );

  // Get all available permissions
  const { data: permissions, error: permissionsError } = await supabase
    .from("permissions")
    .select("*")
    .order("key");

  if (permissionsError) {
    return NextResponse.json(
      { error: permissionsError.message },
      { status: 500 }
    );
  }

  // Get role permissions
  const { data: rolePermissions, error: rolePermError } = await supabase
    .from("role_permissions")
    .select(
      `
      role_id,
      permission_id,
      permissions (
        id,
        key
      )
    `
    );

  if (rolePermError) {
    return NextResponse.json({ error: rolePermError.message }, { status: 500 });
  }

  // Combine the data
  const adminUsers = (admins as Admin[] | undefined)?.map((admin: Admin) => {
    const userInfo = (users as UserInfo[] | undefined)?.find(
      (u: UserInfo) => u.id === admin.user_id
    );
    // If multiple roles, pick the first one for display, or adjust as needed
    const primaryRole = admin.roles && admin.roles.length > 0 ? admin.roles[0] : null;
    const rolePerms = (rolePermissions as RolePermission[] | undefined)
      ?.filter((rp: RolePermission) => rp.role_id === primaryRole?.id)
      .flatMap((rp: RolePermission) => rp.permissions?.map((perm) => perm.key) || []) || [];

    return {
      id: admin.user_id,
      email: userInfo?.email,
      role: primaryRole?.name,
      role_id: primaryRole?.id,
      permissions: rolePerms,
    };
  }) || [];

  return NextResponse.json({
    admins: adminUsers,
    permissions,
    rolePermissions,
  });
}

export async function POST(req: NextRequest) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has manage_admins permission
  const { data: hasPermission } = await supabase.rpc("has_permission", {
    p_key: "manage_admins",
  });

  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, roleId, permissions } = body;

  // First, remove existing role links for this user
  await supabase.from("user_role_links").delete().eq("user_id", userId);

  // Add new role
  if (roleId) {
    const { error: roleError } = await supabase
      .from("user_role_links")
      .insert({ user_id: userId, role_id: roleId });

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 500 });
    }
  }

  // If custom permissions are provided (for admin role), update role_permissions
  if (permissions && Array.isArray(permissions)) {
    // Get or create an admin role for this user
    const { data: adminRole } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "admin")
      .single();

    if (adminRole && roleId === adminRole.id) {
      // Remove existing permissions for this role
      await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", adminRole.id);

      // Add new permissions
      const permissionInserts = permissions.map((permId: string) => ({
        role_id: adminRole.id,
        permission_id: permId,
      }));

      await supabase.from("role_permissions").insert(permissionInserts);
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has manage_admins permission
  const { data: hasPermission } = await supabase.rpc("has_permission", {
    p_key: "manage_admins",
  });

  if (!hasPermission) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "User ID required" },
      { status: 400 }
    );
  }

  // Remove role links
  const { error } = await supabase
    .from("user_role_links")
    .delete()
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
