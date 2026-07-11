/**
 * api-admin-guard.ts
 * ------------------
 * Reusable permission guard for Next.js API route handlers.
 *
 * This serves as a second layer of defense beyond the middleware.
 * Individual route handlers can call `requireAdminPermission` to verify
 * the current user is authenticated as an admin AND has the required
 * permission for the operation.
 *
 * Usage:
 *   import { requireAdminPermission } from "@/lib/api-admin-guard";
 *   import { createServerSupabaseClient } from "@/lib/supabase-server";
 *
 *   export async function GET(req: NextRequest) {
 *     const supabase = await createServerSupabaseClient();
 *     const auth = await requireAdminPermission(supabase, "inventory:read");
 *     if (!auth.allowed) return auth.response;
 *
 *     // auth.user, auth.schoolId, auth.isPrimaryAdmin are available
 *     // ... handle the request
 *   }
 *
 *   export async function POST(req: NextRequest) {
 *     const supabase = await createServerSupabaseClient();
 *     const auth = await requireAdminPermission(supabase, "inventory:write");
 *     if (!auth.allowed) return auth.response;
 *     // ... handle the request
 *   }
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPermission } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────

export interface AdminAuthResult {
  /** Whether the request is allowed to proceed */
  allowed: true;
  /** The authenticated user */
  user: NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]>;
  /** The admin's school_id */
  schoolId: string;
  /** Whether this admin is a primary (full-access) admin */
  isPrimaryAdmin: boolean;
  /** The admin's record ID from the admins table (null for super admins) */
  adminId: string | null;
}

export interface AdminAuthError {
  /** Whether the request is allowed to proceed */
  allowed: false;
  /** A NextResponse with the appropriate error status code */
  response: NextResponse;
}

export type AdminAuthGuardResult = AdminAuthResult | AdminAuthError;

interface AdminAuthData {
  user: AdminAuthResult["user"];
  schoolId: string;
  isPrimaryAdmin: boolean;
  adminId: string | null;
  /** Whether the user is a super admin (platform owner, bypasses all checks) */
  isSuperAdmin: boolean;
}

type AdminAuthResultData =
  | (AdminAuthData & { _tag: "super_admin" })
  | (AdminAuthData & { _tag: "admin"; record: { id: string; school_id: string; is_primary_admin: boolean; is_active: boolean } });

// ── Error Response Helpers ────────────────────────────────────────────────

function unauthorized(message = "Authentication required"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message = "You don't have permission to access this resource"): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// ── Private Auth Helper (fetches user + admin record once) ────────────────

/**
 * Authenticate the request and load the admin record from the database.
 * This is intentionally private — use the public `require*` functions instead.
 *
 * Returns null on auth failure (caller handles the error response with
 * appropriate status code based on context).
 */
async function getAdminAuth(
  supabase: SupabaseClient
): Promise<AdminAuthResultData | null> {
  // ── Step 1: Authenticate ──
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  // ── Step 2: Super admin bypass ──
  const role = user.user_metadata?.role;
  if (role === "super_admin") {
    let schoolId = user.user_metadata?.school_id as string | undefined;
    if (!schoolId) {
      try {
        const { data: sid } = await supabase.rpc("get_my_school_id");
        if (sid) schoolId = sid as string;
      } catch {
        // Ignore
      }
    }
    if (!schoolId) return null;

    return {
      user,
      schoolId,
      isPrimaryAdmin: true,
      adminId: null,
      isSuperAdmin: true,
      _tag: "super_admin" as const,
    };
  }

  // ── Step 3: Look up admin record ──
  const { data: adminRecord, error: adminError } = await supabase
    .from("admins")
    .select("id, school_id, is_primary_admin, is_active")
    .eq("user_id", user.id)
    .single();

  if (adminError || !adminRecord) return null;
  if (!adminRecord.is_active) return null;

  return {
    user,
    schoolId: adminRecord.school_id,
    isPrimaryAdmin: adminRecord.is_primary_admin,
    adminId: adminRecord.id,
    isSuperAdmin: false,
    _tag: "admin" as const,
    record: adminRecord,
  };
}

// ── Main Guard Functions ──────────────────────────────────────────────────

/**
 * Verify the request is from an authenticated admin admin without checking
 * a specific permission. Use this for routes accessible to any admin
 * (dashboard, overview stats, etc.).
 */
export async function requireAdmin(
  supabase: SupabaseClient
): Promise<AdminAuthGuardResult> {
  try {
    const auth = await getAdminAuth(supabase);
    if (!auth) {
      // Middleware already ensures the user is authenticated before reaching
      // API handlers. A null auth here means the admin record is missing or
      // deactivated — always a 403.
      return { allowed: false, response: forbidden("Admin access denied") };
    }

    return {
      allowed: true,
      user: auth.user,
      schoolId: auth.schoolId,
      isPrimaryAdmin: auth.isPrimaryAdmin,
      adminId: auth.adminId,
    };
  } catch (err: any) {
    console.error("[api-admin-guard] requireAdmin error:", err);
    return { allowed: false, response: errorResponse(err.message || "Internal server error", 500) };
  }
}

/**
 * Verify the current request is authenticated as an admin with the
 * required permission.
 *
 * @param supabase - An authenticated Supabase client (created via createRouteHandlerClient)
 * @param permission - The required permission, e.g. "inventory:read" or "inventory:write"
 * @returns An AdminAuthResult (allowed) or AdminAuthError (denied with response)
 */
export async function requireAdminPermission(
  supabase: SupabaseClient,
  permission: AdminPermission
): Promise<AdminAuthGuardResult> {
  try {
    const auth = await getAdminAuth(supabase);

    if (!auth) {
      // Determine error type
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { allowed: false, response: unauthorized() };
      }
      return { allowed: false, response: forbidden("Admin account not found or deactivated") };
    }

    // Super admins and primary admins bypass permission checks
    if (auth.isSuperAdmin || auth.isPrimaryAdmin) {
      return {
        allowed: true,
        user: auth.user,
        schoolId: auth.schoolId,
        isPrimaryAdmin: true,
        adminId: auth.adminId,
      };
    }

    // Sub-admin: check specific permission via RPC
    const { data: hasPermission, error: rpcError } = await supabase.rpc(
      "check_my_admin_permission",
      { p_permission: permission }
    );

    if (rpcError) {
      console.error("[api-admin-guard] RPC error:", rpcError);
      return { allowed: false, response: errorResponse("Permission check failed", 500) };
    }

    if (!hasPermission) {
      return { allowed: false, response: forbidden() };
    }

    return {
      allowed: true,
      user: auth.user,
      schoolId: auth.schoolId,
      isPrimaryAdmin: false,
      adminId: auth.adminId,
    };
  } catch (err: any) {
    console.error("[api-admin-guard] Unexpected error:", err);
    return { allowed: false, response: errorResponse(err.message || "Internal server error", 500) };
  }
}

/**
 * Check that the admin has at least one of the listed permissions.
 * Efficient — only fetches auth data once, then checks permissions.
 *
 * Example:
 *   const auth = await requireAnyAdminPermission(supabase, ["inventory:read", "finance:read"]);
 */
export async function requireAnyAdminPermission(
  supabase: SupabaseClient,
  permissions: AdminPermission[]
): Promise<AdminAuthGuardResult> {
  if (permissions.length === 0) {
    return requireAdmin(supabase);
  }

  try {
    const auth = await getAdminAuth(supabase);

    if (!auth) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { allowed: false, response: unauthorized() };
      }
      return { allowed: false, response: forbidden("Admin account not found or deactivated") };
    }

    // Super admins and primary admins bypass permission checks
    if (auth.isSuperAdmin || auth.isPrimaryAdmin) {
      return {
        allowed: true,
        user: auth.user,
        schoolId: auth.schoolId,
        isPrimaryAdmin: true,
        adminId: auth.adminId,
      };
    }

    // Sub-admin: try each permission until one passes
    let lastRpcError: unknown = null;
    for (const permission of permissions) {
      const { data: hasPermission, error: rpcError } = await supabase.rpc(
        "check_my_admin_permission",
        { p_permission: permission }
      );

      if (rpcError) {
        lastRpcError = rpcError;
        continue;
      }

      if (hasPermission) {
        return {
          allowed: true,
          user: auth.user,
          schoolId: auth.schoolId,
          isPrimaryAdmin: false,
          adminId: auth.adminId,
        };
      }
    }

    if (lastRpcError) {
      console.error("[api-admin-guard] RPC error in requireAnyAdminPermission:", lastRpcError);
      return { allowed: false, response: errorResponse("Permission check failed", 500) };
    }

    return {
      allowed: false,
      response: forbidden("You don't have any of the required permissions"),
    };
  } catch (err: any) {
    console.error("[api-admin-guard] Unexpected error:", err);
    return { allowed: false, response: errorResponse(err.message || "Internal server error", 500) };
  }
}
