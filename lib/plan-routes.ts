// ============================================================================
// PLAN ROUTES — Route-to-feature mapping for middleware plan enforcement
// ============================================================================
//
// Maps URL path patterns to plan features so the middleware can check whether
// the school's plan allows access to a given page.
//
// Only gated features (Pro & Premium) are listed here. Basic features are
// always available and don't need route entries.
// ============================================================================

import type { PlanFeature, SchoolPlan } from '@/lib/types';
import { hasFeature } from '@/lib/plan-features';

// ── Route-to-Feature Mapping ──────────────────────────────────────────────
//
// Each entry maps a path prefix to the feature it represents.
// The middleware checks if the current pathname starts with any of these
// prefixes and, if so, verifies the school's plan allows that feature.
//
// Format: [pathPrefix, featureKey]
//
// Paths not listed here are considered "always available" (Basic features).

type RouteEntry = [pathPrefix: string, feature: PlanFeature, portal: string];

export const FEATURE_ROUTES: RouteEntry[] = [
  // ── Pro Features: Admin ──
  ['/admin/finance',             'finance',            'admin'],
  ['/admin/payroll',             'payroll',            'admin'],
  ['/admin/notifications',       'notifications',      'admin'],
  ['/admin/calendar',            'calendar',           'admin'],
  ['/admin/families',            'families',           'admin'],
  ['/admin/parents',             'parents_guardians',  'admin'],
  ['/admin/students/id-cards',   'student_id_cards',   'admin'],
  ['/admin/teachers/id-cards',   'teacher_id_cards',   'admin'],

  // ── Pro Features: Teacher ──
  ['/teacher/assignments',       'assignments',        'teacher'],
  ['/teacher/payroll',           'payroll',            'teacher'],

  // ── Pro Features: Student ──
  ['/student/assignments',       'assignments',        'student'],

  // ── Pro Features: Admin (subject analytics) ──
  ['/admin/subject-classes',     'subject_analytics',  'admin'],
  ['/admin/subjects',            'subject_analytics',  'admin'],

  // ── Premium Features: Admin ──
  ['/admin/ai-assistant',        'ai_assistant',       'admin'],
  ['/admin/website-builder',     'website_builder',    'admin'],
  ['/admin/jamb',                'jamb_cbt',           'admin'],
  ['/admin/question-bank',       'question_bank',      'admin'],
  ['/admin/admissions',          'admissions',         'admin'],
  ['/admin/alumni',              'alumni',             'admin'],
  ['/admin/audit-logs',          'audit_trail',        'admin'],

  // ── Premium Features: Teacher ──
  ['/teacher/ai-assistant',      'ai_assistant',       'teacher'],
  ['/teacher/lesson-notes',      'lesson_notes',       'teacher'],
  ['/teacher/question-bank',     'question_bank',      'teacher'],
  ['/teacher/live-classes',      'live_classes',       'teacher'],

  // ── Premium Features: Student ──
  ['/student/ai-assistant',      'ai_assistant',       'student'],
  ['/student/jamb',              'jamb_cbt',           'student'],
  ['/student/live-classes',      'live_classes',       'student'],

  // ── Premium Features: Parent ──
  ['/parent/ai-assistant',       'ai_assistant',       'parent'],
];

// Cache the longest prefix per parent path to avoid partial mismatches.
// e.g., '/admin/students/id-cards' should match before '/admin/students'.
// We sort by path length descending so longest prefix matches first.
export const SORTED_FEATURE_ROUTES = [...FEATURE_ROUTES].sort(
  (a, b) => b[0].length - a[0].length
);

// ── Helper Functions ───────────────────────────────────────────────────────

/**
 * Find the feature associated with a given pathname and portal.
 * Returns null if the path is not a gated feature.
 *
 * Uses longest-prefix matching so that e.g. /admin/students/id-cards
 * correctly maps to student_id_cards rather than not matching at all.
 */
export function getFeatureForPath(
  pathname: string,
  portal: string
): { feature: PlanFeature; pathPrefix: string } | null {
  for (const [prefix, feature, routePortal] of SORTED_FEATURE_ROUTES) {
    if (routePortal !== portal) continue;
    // Exact match or path starts with prefix followed by / or end of string
    if (
      pathname === prefix ||
      pathname.startsWith(prefix + '/')
    ) {
      return { feature, pathPrefix: prefix };
    }
  }
  return null;
}

/**
 * Determine the portal from a pathname.
 */
export function getPortalFromPath(pathname: string): string | null {
  const portals = ['admin', 'teacher', 'student', 'parent'];
  for (const portal of portals) {
    if (pathname === `/${portal}` || pathname.startsWith(`/${portal}/`)) {
      return portal;
    }
  }
  return null;
}

/**
 * Check if a school plan allows access to a specific path.
 * Returns true if the path is not gated, or if the plan includes the feature.
 */
export function canAccessPathByPlan(
  plan: SchoolPlan,
  pathname: string
): { allowed: boolean; feature: PlanFeature | null; pathPrefix: string | null } {
  const portal = getPortalFromPath(pathname);
  if (!portal) {
    return { allowed: true, feature: null, pathPrefix: null };
  }

  const matched = getFeatureForPath(pathname, portal);
  if (!matched) {
    // Path is not a gated feature — always allowed
    return { allowed: true, feature: null, pathPrefix: null };
  }

  const allowed = hasFeature(plan, matched.feature);
  return {
    allowed,
    feature: allowed ? null : matched.feature,
    pathPrefix: matched.pathPrefix,
  };
}

/**
 * Get the dashboard path for a given portal.
 */
export function getDashboardPath(portal: string): string {
  return `/${portal}`;
}

// ============================================================================
// API ROUTE MAPPING — Plan enforcement for API routes
// ============================================================================
//
// Maps API path prefixes to their corresponding plan features.
// These routes are checked in the middleware alongside page routes.
// ============================================================================

/**
 * API routes that should NEVER be blocked by plan enforcement.
 * These include webhooks, public endpoints, super admin, etc.
 */
export const API_EXCLUDED_ROUTES: string[] = [
  // Paystack webhook — called by Paystack, not by the user
  '/api/finance/paystack/webhook',
  // Super admin — no school plan applies
  '/api/super-admin',
  // Public portal auth endpoints (activate, reset password)
  '/api/admin/activate',
  '/api/admin/reset-password',
  '/api/teacher/activate',
  '/api/teacher/reset-password',
  '/api/teacher/validate-reset-token',
  '/api/student/activate',
  '/api/student/reset-password',
  '/api/student/validate-reset-token',
  '/api/parent/activate',
  '/api/parent/reset-password',
  '/api/parent/validate-reset-token',
  '/api/parent/validate-activation',
  // School public data
  '/api/school',
  // File uploads
  '/api/upload',
];

/**
 * API route-to-feature mapping.
 * Format: [apiPathPrefix, feature, portal|null]
 * When portal is null, the feature doesn't belong to a specific portal
 * and just needs auth + plan check.
 */
export const API_FEATURE_ROUTES: [pathPrefix: string, feature: PlanFeature, portal: string | null][] = [
  // ── Pro Features ──
  ['/api/admin/finance',             'finance',            'admin'],
  ['/api/admin/payroll',             'payroll',            'admin'],
  ['/api/admin/notifications',       'notifications',      'admin'],
  ['/api/admin/send-notification',   'notifications',      'admin'],
  ['/api/admin/families',            'families',           'admin'],
  ['/api/admin/parents',             'parents_guardians',  'admin'],
  ['/api/admin/guardians',           'parents_guardians',  'admin'],
  ['/api/admin/emails',              'notifications',      'admin'],
  ['/api/admin/send-email',          'notifications',      'admin'],
  ['/api/teacher/payroll',           'payroll',            'teacher'],
  ['/api/student/finance',           'finance',            'student'],
  ['/api/student/upload-assignment',  'assignments',        'student'],
  ['/api/parent/finance',            'finance',            'parent'],
  ['/api/finance/paystack/initialize', 'finance',           null],
  ['/api/finance/paystack/verify',   'finance',            null],
  ['/api/notifications',             'notifications',      null],

  // ── Premium Features ──
  ['/api/admin/alumni',              'alumni',             'admin'],
  ['/api/admin/audit-logs',          'audit_trail',        'admin'],
  ['/api/admin/jamb-access',         'jamb_cbt',           'admin'],
  ['/api/admin/question-bank',       'question_bank',      'admin'],
  ['/api/admin/website',             'website_builder',    'admin'],
  ['/api/teacher/lesson-notes',      'lesson_notes',       'teacher'],
  ['/api/teacher/live-sessions',     'live_classes',       'teacher'],
  ['/api/teacher/question-bank',     'question_bank',      'teacher'],
  ['/api/student/jamb',              'jamb_cbt',           'student'],
  ['/api/student/live-sessions',     'live_classes',       'student'],
  ['/api/admissions',                'admissions',         null],
  ['/api/ai-assistant',              'ai_assistant',       null],
  ['/api/alumni',                    'alumni',             null],

];

// Sorted longest-first for accurate prefix matching
export const SORTED_API_FEATURE_ROUTES = [...API_FEATURE_ROUTES].sort(
  (a, b) => b[0].length - a[0].length
);

/**
 * Check if an API path matches an excluded route (no plan check).
 */
export function isApiPathExcluded(pathname: string): boolean {
  for (const prefix of API_EXCLUDED_ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return true;
    }
  }
  return false;
}

/**
 * Find the feature associated with a given API pathname.
 * Returns null if the API path is not a gated feature.
 */
export function getApiFeatureForPath(
  pathname: string
): { feature: PlanFeature; pathPrefix: string; portal: string | null } | null {
  for (const [prefix, feature, portal] of SORTED_API_FEATURE_ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return { feature, pathPrefix: prefix, portal };
    }
  }
  return null;
}
