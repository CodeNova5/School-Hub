import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { roleId, permissionIds } = body;

  if (!roleId) {
    return NextResponse.json({ error: "Role ID required" }, { status: 400 });
  }

  // Remove existing permissions for this role
  await supabase.from("role_permissions").delete().eq("role_id", roleId);

  // Add new permissions
  if (permissionIds && permissionIds.length > 0) {
    const permissionInserts = permissionIds.map((permId: string) => ({
      role_id: roleId,
      permission_id: permId,
    }));

    const { error } = await supabase
      .from("role_permissions")
      .insert(permissionInserts);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
