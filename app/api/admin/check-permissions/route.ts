import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies: () => req.cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // Check user role links
  const { data: roleLinks, error: roleLinkError } = await supabase
    .from("user_role_links")
    .select("*, roles(*)")
    .eq("user_id", user.id);

  // Check permissions
  const { data: canAccess } = await supabase.rpc("can_access_admin");
  const { data: hasAdminFull } = await supabase.rpc("has_permission", {
    p_key: "admin_full",
  });

  // Get all role permissions for user's roles
  const { data: rolePerms } = await supabase
    .from("role_permissions")
    .select("*, permissions(*)");

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    roleLinks,
    roleLinkError,
    canAccess,
    hasAdminFull,
    rolePerms,
  });
}
