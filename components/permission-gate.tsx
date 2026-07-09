"use client";

import React from "react";
import {
  useAdminPermissions,
  type UseAdminPermissionsResult,
} from "@/hooks/use-admin-permissions";
import type { AdminPermission } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────

export type PermissionGateMode =
  /** Hide children when permission is denied (default) */
  | "hide"
  /** Disable children when permission is denied (adds opacity + cursor-not-allowed) */
  | "disable";

export interface PermissionGateProps {
  /** Children to render when permission is granted */
  children: React.ReactNode;

  /** Require a specific permission (e.g. "inventory:read") */
  permission?: AdminPermission;

  /** Require at least one of these permissions */
  any?: AdminPermission[];

  /** Require ALL of these permissions */
  all?: AdminPermission[];

  /**
   * What to do when permission is denied:
   * - "hide" (default): Children are not rendered at all
   * - "disable": Children are rendered with reduced opacity and pointer-events disabled.
   *   Useful for showing a disabled/read-only state of UI controls.
   */
  mode?: PermissionGateMode;

  /**
   * Optional fallback content to show when permission is denied.
   * Overrides the behavior of `mode`.
   */
  fallback?: React.ReactNode;

  /**
   * Optional loading skeleton to show while permissions are loading.
   * If not provided, nothing is rendered during loading.
   */
  loading?: React.ReactNode;
}

// ── Internal Gate Component ───────────────────────────────────────────────

function GateContent({
  children,
  hasAccess,
  isLoading,
  mode,
  fallback,
  loading,
}: {
  children: React.ReactNode;
  hasAccess: boolean;
  isLoading: boolean;
  mode: PermissionGateMode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}) {
  if (isLoading) {
    if (loading !== undefined) return <>{loading}</>;
    return null;
  }

  if (!hasAccess) {
    if (fallback !== undefined) return <>{fallback}</>;

    if (mode === "disable") {
      return (
        <div
          className="pointer-events-none select-none opacity-40"
          aria-disabled="true"
          title="You don't have permission to access this"
        >
          {children}
        </div>
      );
    }

    // mode === "hide"
    return null;
  }

  return <>{children}</>;
}

// ── Main Component ────────────────────────────────────────────────────────

/**
 * Conditionally renders children based on admin permissions.
 *
 * Usage:
 *   // Basic — hides content if admin lacks "inventory:read"
 *   <PermissionGate permission="inventory:read">
 *     <InventoryPanel />
 *   </PermissionGate>
 *
 *   // Any permission — shows if admin has at least one listed
 *   <PermissionGate any={["inventory:read", "finance:read"]}>
 *     <Reports />
 *   </PermissionGate>
 *
 *   // All permissions — requires all listed
 *   <PermissionGate all={["students:read", "students:write"]}>
 *     <StudentEditor />
 *   </PermissionGate>
 *
 *   // Disable mode — renders children but makes them non-interactive
 *   <PermissionGate permission="inventory:write" mode="disable">
 *     <Button>Delete Item</Button>
 *   </PermissionGate>
 *
 *   // Custom fallback
 *   <PermissionGate permission="finance:write" fallback={<ReadOnlyBadge />}>
 *     <FinanceForm />
 *   </PermissionGate>
 *
 *   // Loading skeleton
 *   <PermissionGate permission="inventory:read" loading={<Skeleton />}>
 *     <InventoryList />
 *   </PermissionGate>
 *
 *   // Using with the hook directly (for complex conditional logic)
 *   const { hasPermission, isLoading } = useAdminPermissions();
 *   // ... custom logic ...
 */
export function PermissionGate({
  children,
  permission,
  any: anyPermissions,
  all: allPermissions,
  mode = "hide",
  fallback,
  loading,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } =
    useAdminPermissions();

  // Determine access
  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (anyPermissions && anyPermissions.length > 0) {
    hasAccess = hasAnyPermission(anyPermissions);
  } else if (allPermissions && allPermissions.length > 0) {
    hasAccess = hasAllPermissions(allPermissions);
  } else {
    // No permission requirement — always allow
    hasAccess = true;
  }

  return (
    <GateContent
      hasAccess={hasAccess}
      isLoading={isLoading}
      mode={mode}
      fallback={fallback}
      loading={loading}
    >
      {children}
    </GateContent>
  );
}

// ── Render Props Variant ──────────────────────────────────────────────────

export interface PermissionGateRenderPropsProps {
  children: (props: {
    allowed: boolean;
    isLoading: boolean;
    permissions: UseAdminPermissionsResult;
  }) => React.ReactNode;
  permission?: AdminPermission;
  any?: AdminPermission[];
  all?: AdminPermission[];
}

/**
 * Render props variant — gives you full control over what to render
 * based on the permission state.
 *
 * Usage:
 *   <PermissionGateRenderProps permission="inventory:write">
 *     {({ allowed, isLoading, permissions }) => (
 *       <Button disabled={!allowed}>
 *         {isLoading ? "Checking..." : allowed ? "Edit" : "View Only"}
 *       </Button>
 *     )}
 *   </PermissionGateRenderProps>
 */
export function PermissionGateRenderProps({
  children,
  permission,
  any: anyPermissions,
  all: allPermissions,
}: PermissionGateRenderPropsProps) {
  const permissions = useAdminPermissions();
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } =
    permissions;

  let allowed = false;

  if (permission) {
    allowed = hasPermission(permission);
  } else if (anyPermissions && anyPermissions.length > 0) {
    allowed = hasAnyPermission(anyPermissions);
  } else if (allPermissions && allPermissions.length > 0) {
    allowed = hasAllPermissions(allPermissions);
  } else {
    allowed = true;
  }

  return <>{children({ allowed, isLoading, permissions })}</>;
}
