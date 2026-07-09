"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { AdminPermission } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────

export interface UseAdminPermissionsResult {
  /** Raw list of permission strings (e.g. ["inventory:read", "inventory:write"]) */
  permissions: AdminPermission[];
  /** Whether the current user is a super admin (platform owner) */
  isSuperAdmin: boolean;
  /** Whether the current user is a primary admin (school owner) */
  isPrimaryAdmin: boolean;
  /** Whether the permissions are still loading */
  isLoading: boolean;
  /** Error message if the fetch failed */
  error: string | null;
  /** Check if the admin has a specific permission */
  hasPermission: (permission: AdminPermission) => boolean;
  /** Check if the admin has at least one of the listed permissions */
  hasAnyPermission: (permissions: AdminPermission[]) => boolean;
  /** Check if the admin has ALL of the listed permissions */
  hasAllPermissions: (permissions: AdminPermission[]) => boolean;
  /** Refetch permissions from the server */
  refetch: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────

/**
 * Fetch and check admin permissions on the client side.
 *
 * Uses the `get_my_admin_permissions` RPC function from the database,
 * which returns the union of all permissions from all assigned roles.
 *
 * For super admins and primary admins, the RPC returns `['*']` (wildcard),
 * which means all permissions are granted.
 *
 * Usage:
 *   const { hasPermission, isLoading } = useAdminPermissions();
 *
 *   if (isLoading) return <Skeleton />;
 *   if (hasPermission("inventory:read")) return <InventoryPanel />;
 */
export function useAdminPermissions(): UseAdminPermissionsResult {
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check user role first
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        if (mountedRef.current) {
          setPermissions([]);
          setIsSuperAdmin(false);
          setIsPrimaryAdmin(false);
          setError("Not authenticated");
        }
        return;
      }

      const role = user.user_metadata?.role;
      const isSuper = role === "super_admin";

      if (isSuper) {
        // Super admins have wildcard access
        if (mountedRef.current) {
          setIsSuperAdmin(true);
          setIsPrimaryAdmin(true);
          setPermissions(["*" as AdminPermission]);
          setError(null);
        }
        return;
      }

      // Fetch permissions via RPC
      const { data: perms, error: rpcError } = await supabase
        .rpc("get_my_admin_permissions");

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // Check if the admin is a primary admin
      const { data: adminRecord } = await supabase
        .from("admins")
        .select("is_primary_admin")
        .eq("user_id", user.id)
        .single();

      if (mountedRef.current) {
        setPermissions((perms ?? []) as AdminPermission[]);
        setIsSuperAdmin(false);
        setIsPrimaryAdmin(adminRecord?.is_primary_admin ?? false);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "Failed to load permissions");
        setPermissions([]);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchPermissions();
    return () => { mountedRef.current = false; };
  }, [fetchPermissions]);

  // ── Permission Check Helpers ──

  const hasPermission = useCallback(
    (permission: AdminPermission): boolean => {
      // Wildcard means all permissions
      if (permissions.includes("*" as AdminPermission)) return true;

      // Exact match
      if (permissions.includes(permission)) return true;

      // Write implies read
      if (permission.endsWith(":read")) {
        const writePerm = permission.replace(":read", ":write") as AdminPermission;
        if (permissions.includes(writePerm)) return true;
      }

      // Namespace wildcard
      const ns = permission.split(":")[0];
      const nsWildcard = `${ns}:*` as AdminPermission;
      if (permissions.includes(nsWildcard)) return true;

      return false;
    },
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (checkPerms: AdminPermission[]): boolean => {
      return checkPerms.some((p) => hasPermission(p));
    },
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (checkPerms: AdminPermission[]): boolean => {
      return checkPerms.every((p) => hasPermission(p));
    },
    [hasPermission]
  );

  return {
    permissions,
    isSuperAdmin,
    isPrimaryAdmin,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refetch: fetchPermissions,
  };
}
