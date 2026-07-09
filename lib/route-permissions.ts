/**
 * route-permissions.ts
 * --------------------
 * Maps admin URL path patterns to required permission namespaces.
 * Used by the middleware to check if the current admin has access to a page.
 *
 * Paths not listed here are accessible to ALL admins (primary or sub-admin).
 * Only paths with granular access control need entries here.
 *
 * Permission naming convention: "namespace:action"
 *   - namespace: the feature area (e.g. "inventory", "finance")
 *   - action: "read" (view) or "write" (create/edit/delete)
 */

import type { AdminPermission, AdminPermissionNamespace } from "@/lib/types";

interface RoutePermissionEntry {
  /** Glob-like path pattern. Supports exact paths and prefix matches. */
  pattern: string;
  /** Required permission. "read" means view access, "write" means manage access. */
  permission: AdminPermission;
  /** If true, the pattern matches this exact path only. If false, matches prefix. */
  exact?: boolean;
}

/**
 * Route-to-permission mappings for the /admin portal.
 * Ordered most-specific-first; the first match wins.
 */
const ADMIN_ROUTE_PERMISSIONS: RoutePermissionEntry[] = [
  // ── School Structure ──
  { pattern: "/admin/school-config", permission: "structure:read" },

  // ── Subjects ──
  { pattern: "/admin/subjects", permission: "subjects:read" },
  { pattern: "/admin/subject-classes", permission: "subjects:read" },

  // ── Students ──
  { pattern: "/admin/students", permission: "students:read" },
  { pattern: "/admin/students/new", permission: "students:write", exact: true },
  { pattern: "/admin/enrollment", permission: "students:write" },

  // ── Teachers ──
  { pattern: "/admin/teachers", permission: "teachers:read" },

  // ── Classes ──
  { pattern: "/admin/classes", permission: "classes:read" },

  // ── Results ──
  { pattern: "/admin/results", permission: "results:read" },
  { pattern: "/admin/result-settings", permission: "results:read" },

  // ── Timetable ──
  { pattern: "/admin/timetable", permission: "timetable:read" },

  // ── Inventory / Stock ──
  { pattern: "/admin/inventory", permission: "inventory:read" },

  // ── Finance ──
  { pattern: "/admin/finance", permission: "finance:read" },
  { pattern: "/admin/billing", permission: "finance:read" },
  { pattern: "/admin/payments", permission: "finance:read" },

  // ── Notifications ──
  { pattern: "/admin/notifications", permission: "notifications:write" },
  { pattern: "/admin/whatsapp", permission: "notifications:write" },

  // ── Website Builder ──
  { pattern: "/admin/website", permission: "website:read" },

  // ── Admissions ──
  { pattern: "/admin/admissions", permission: "admissions:read" },

  // ── Alumni ──
  { pattern: "/admin/alumni", permission: "alumni:read" },

  // ── Question Bank / CBT ──
  { pattern: "/admin/question-bank", permission: "question_bank:read" },
  { pattern: "/admin/cbt", permission: "question_bank:read" },
  { pattern: "/admin/jamb", permission: "question_bank:read" },

  // ── Live Classes ──
  { pattern: "/admin/live-classes", permission: "live_classes:read" },

  // ── Lesson Notes ──
  { pattern: "/admin/lesson-notes", permission: "lesson_notes:read" },

  // ── Audit Trail ──
  { pattern: "/admin/audit", permission: "audit:read" },

  // ── Settings ──
  { pattern: "/admin/settings", permission: "settings:read" },

  // ── Admin Management (this feature itself) ──
  { pattern: "/admin/admin-users", permission: "user_management:write" },

  // ── API route mappings for permission enforcement in the middleware ──
  // These are checked when the middleware processes /api/admin/* routes

  // Inventory API
  { pattern: "/api/admin/inventory", permission: "inventory:read" },

  // Finance API (POST/PUT/DELETE require write)
  { pattern: "/api/admin/finance", permission: "finance:read" },
  { pattern: "/api/admin/billing", permission: "finance:read" },

  // Students API
  { pattern: "/api/admin/students", permission: "students:read" },

  // Teachers API
  { pattern: "/api/admin/teachers", permission: "teachers:read" },

  // Results API
  { pattern: "/api/admin/results", permission: "results:read" },

  // Admissions API
  { pattern: "/api/admin/admissions", permission: "admissions:read" },

  // Alumni API
  { pattern: "/api/admin/alumni", permission: "alumni:read" },
  { pattern: "/api/admin/alumni/applications", permission: "alumni:write" },
  { pattern: "/api/admin/alumni/profiles", permission: "alumni:read" },

  // Website Builder API
  { pattern: "/api/admin/website", permission: "website:read" },

  // Notifications & Communications API
  { pattern: "/api/admin/notifications", permission: "notifications:write" },
  { pattern: "/api/admin/emails", permission: "notifications:write" },
  { pattern: "/api/admin/whatsapp", permission: "notifications:write" },
  { pattern: "/api/admin/send-email", permission: "notifications:write" },
  { pattern: "/api/admin/send-notification", permission: "notifications:write" },
  { pattern: "/api/admin/send-whatsapp", permission: "notifications:write" },

  // Payroll API (finance sub-feature)
  { pattern: "/api/admin/payroll", permission: "finance:read" },

  // JAMB/CBT Access API (question bank sub-feature)
  { pattern: "/api/admin/jamb-access", permission: "question_bank:read" },

  // Question Bank API
  { pattern: "/api/admin/question-bank", permission: "question_bank:read" },

  // Audit Logs API
  { pattern: "/api/admin/audit-logs", permission: "audit:read" },

  // History (class history) API
  { pattern: "/api/admin/history", permission: "classes:read" },

  // Promotions API
  { pattern: "/api/admin/promotions", permission: "classes:write" },

  // Guardians, Parents, Families (student-related)
  { pattern: "/api/admin/guardians", permission: "students:read" },
  { pattern: "/api/admin/parents", permission: "students:read" },
  { pattern: "/api/admin/families", permission: "students:read" },

  // Student email verification & updates (student write actions)
  { pattern: "/api/admin/student-email-verification", permission: "students:write" },
  { pattern: "/api/admin/parent-email-verification", permission: "students:write" },
  { pattern: "/api/admin/update-student", permission: "students:write" },

  // Subscription API (settings sub-feature)
  { pattern: "/api/admin/subscription", permission: "settings:read" },

  // Admin management API
  { pattern: "/api/admin/admin-users", permission: "user_management:write" },
  { pattern: "/api/admin/admin-roles", permission: "user_management:write" },

  // ── Additional page routes not covered above ──

  // Payroll pages
  { pattern: "/admin/payroll", permission: "finance:read" },

  // Audit pages (not matched by /admin/audit since path uses hyphen)
  { pattern: "/admin/audit-logs", permission: "audit:read" },

  // Promotions pages
  { pattern: "/admin/promotions", permission: "classes:write" },

  // Guardians/Parents/Families pages
  { pattern: "/admin/guardians", permission: "students:read" },
  { pattern: "/admin/parents", permission: "students:read" },
  { pattern: "/admin/families", permission: "students:read" },

  // History pages
  { pattern: "/admin/history", permission: "classes:read" },

  // Email verification pages
  { pattern: "/admin/student-email-verification", permission: "students:write" },
  { pattern: "/admin/parent-email-verification", permission: "students:write" },

  // Subscription pages
  { pattern: "/admin/subscription", permission: "settings:read" },
];

// ── Public paths that don't require any permission check ──
const PUBLIC_ADMIN_PATHS: string[] = [
  "/admin/login",
  "/admin/activate",
  "/admin/reset-password",
  "/admin/unauthorized",
  "/admin/upgrade",
];

const ADMIN_DASHBOARD = "/admin";

// ── Write-action HTTP methods ──
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ── Helper Functions ──────────────────────────────────────────────────────

/**
 * Check if a path is a public admin path (login, activate, etc.) that
 * should bypass permission checks entirely.
 */
export function isPublicAdminPath(pathname: string): boolean {
  return PUBLIC_ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

/**
 * Get the required permission for a given admin pathname.
 * Returns null if the path is public, the dashboard, or not restricted.
 */
export function getRequiredPermission(
  pathname: string,
  method?: string
): AdminPermission | null {
  // Dashboard is always accessible
  if (pathname === ADMIN_DASHBOARD || pathname === ADMIN_DASHBOARD + "/") {
    return null;
  }

  // Public paths bypass permission checks
  if (isPublicAdminPath(pathname)) {
    return null;
  }

  // Check for a matching route permission entry
  // First try exact matches, then prefix matches
  for (const entry of ADMIN_ROUTE_PERMISSIONS) {
    if (entry.exact) {
      if (pathname === entry.pattern) {
        return resolveMethodPermission(entry.permission, method);
      }
    } else {
      // Prefix match
      if (pathname === entry.pattern || pathname.startsWith(entry.pattern + "/")) {
        return resolveMethodPermission(entry.permission, method);
      }
    }
  }

  // Path is not gated — allow access (admin pages not listed are unrestricted)
  return null;
}

/**
 * For API routes with write methods (POST/PUT/DELETE), upgrade "read" to "write".
 * For GET requests, keep "read" as-is.
 */
function resolveMethodPermission(
  permission: AdminPermission,
  method?: string
): AdminPermission {
  if (!method || !WRITE_METHODS.has(method)) {
    return permission;
  }

  // If the permission is already "write", keep it
  if (permission.endsWith(":write")) {
    return permission;
  }

  // Upgrade "read" to "write" for mutation HTTP methods
  const ns = permission.split(":")[0] as AdminPermissionNamespace;
  return `${ns}:write` as AdminPermission;
}

/**
 * Determine the permission action based on the HTTP method.
 */
export function getActionForMethod(method: string): "read" | "write" {
  return WRITE_METHODS.has(method) ? "write" : "read";
}

/**
 * Get a display-friendly name for a permission.
 */
export function getRoutePermissionLabel(permission: AdminPermission): string {
  const [ns, action] = permission.split(":");
  const namespaceLabel = ns.charAt(0).toUpperCase() + ns.slice(1).replace(/_/g, " ");
  const actionLabel = action === "read" ? "View" : "Manage";
  return `${namespaceLabel}: ${actionLabel}`;
}
