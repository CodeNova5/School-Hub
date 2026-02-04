import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import crypto from "crypto";


export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
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


  // Get all admins with their roles and permissions, joining with admins table for name/email
  const { data: admins, error: adminsError } = await supabase
    .from("user_role_links")
    .select(`
      user_id,
      role_id,
      roles (
        id,
        name
      ),
      admins (
        id,
        name,
        email
      )
    `)
    .order("user_id");

  if (adminsError) {
    return NextResponse.json({ error: adminsError.message }, { status: 500 });
  }

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
  const adminUsers = (admins as any[] | undefined)?.map((admin: any) => {
    // If multiple roles, pick the first one for display, or adjust as needed
    const primaryRole = admin.roles && admin.roles.length > 0 ? admin.roles[0] : null;
    // Get permission IDs (not keys) for this role
    const rolePerms = (rolePermissions as any[] | undefined)
      ?.filter((rp: any) => rp.role_id === primaryRole?.id)
      .map((rp: any) => rp.permission_id) || [];

    return {
      id: admin.user_id,
      name: admin.admins?.name || '',
      email: admin.admins?.email || '',
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
  const supabase = createRouteHandlerClient({ cookies });
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
  const { userId, roleId, permissions, email, name } = body;

  // If email and name are provided, create a new admin user
  if (email && name) {
    try {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Check if admin already exists
      const { data: existingAdmin } = await supabaseAdmin
        .from("admins")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingAdmin) {
        return NextResponse.json(
          { error: "An admin with this email already exists" },
          { status: 400 }
        );
      }

      // Create auth user
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { role: "admin", name },
        });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: authError?.message || "Failed to create auth user" },
          { status: 400 }
        );
      }

      // Insert admin record
      const { data: admin, error: adminError } = await supabaseAdmin
        .from("admins")
        .insert({
          name,
          email,
          user_id: authData.user.id,
          is_active: false,
          status: "inactive",
        })
        .select()
        .single();

      if (adminError || !admin) {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json({ error: adminError?.message }, { status: 400 });
      }

      // Assign role
      if (roleId) {
        const { error: roleError } = await supabaseAdmin
          .from("user_role_links")
          .insert({ user_id: authData.user.id, role_id: roleId });

        if (roleError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return NextResponse.json({ error: roleError.message }, { status: 500 });
        }
      }

      // If custom permissions are provided (for admin role), update role_permissions
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        const { data: adminRole } = await supabaseAdmin
          .from("roles")
          .select("id")
          .eq("name", "admin")
          .single();

        if (adminRole && roleId === adminRole.id) {
          // Remove existing permissions for this role
          await supabaseAdmin
            .from("role_permissions")
            .delete()
            .eq("role_id", adminRole.id);

          // Add new permissions
          const permissionInserts = permissions.map((permId: string) => ({
            role_id: adminRole.id,
            permission_id: permId,
          }));

          await supabaseAdmin.from("role_permissions").insert(permissionInserts);
        }
      }

      // Generate activation token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await supabaseAdmin
        .from("admins")
        .update({
          activation_token_hash: tokenHash,
          activation_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
        })
        .eq("id", admin.id);

      // Send activation email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const activationLink = `${process.env.NEXT_PUBLIC_APP_URL}/admin/activate?token=${rawToken}`;

      await transporter.sendMail({
        from: `"School Hub" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Activate Your Admin Account",
        html: `
          <p>Hello ${name},</p>
          <p>Your administrator account has been created.</p>
          <p>Click the link below to activate your account and set your password:</p>
          <p><a href="${activationLink}">Activate Account</a></p>
          <p>This link expires in 24 hours.</p>
        `,
      });

      return NextResponse.json({ success: true, admin });
    } catch (err: any) {
      console.error(err);
      return NextResponse.json(
        { error: err.message || "Unexpected server error" },
        { status: 500 }
      );
    }
  }

  // Existing update logic for editing existing admin
  if (!userId || !roleId) {
    return NextResponse.json(
      { error: "User ID and role ID are required" },
      { status: 400 }
    );
  }

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
  const supabase = createRouteHandlerClient({ cookies });
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

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Remove role links
    await supabase
      .from("user_role_links")
      .delete()
      .eq("user_id", userId);

    // 2. Delete admin record (if exists)
    await supabaseAdmin
      .from("admins")
      .delete()
      .eq("user_id", userId);

    // 3. Delete auth user (this will cascade delete sessions and everything)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      return NextResponse.json(
        { error: "Failed to delete user authentication" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete admin" },
      { status: 500 }
    );
  }
}
