// ============================================================================
// PLAN FEATURES — Remaining helpers not yet moved to DB
// ============================================================================
//
// Most plan data is now DB-driven (subscription_plans, subscription_features,
// subscription_plan_features). This file only retains helpers that haven't
// been moved to the DB yet.
// ============================================================================

import type { SchoolPlan } from '@/lib/types';

// ============================================================================
// Student Limits per Plan
// ============================================================================

/**
 * Maximum number of active students allowed per plan tier.
 * `null` means unlimited.
 */
export const PLAN_STUDENT_LIMITS: Record<SchoolPlan, number | null> = {
  basic: 50,
  pro: 500,
  premium: null, // Unlimited
};

/**
 * Get the student limit for a given plan.
 * Returns `null` for unlimited plans (premium).
 */
export function getStudentLimit(plan: SchoolPlan): number | null {
  return PLAN_STUDENT_LIMITS[plan] ?? null;
}

/**
 * Check if a school can add more students based on their current plan.
 *
 * @param plan - The school's current plan key
 * @param currentStudentCount - Current number of active students
 * @returns Object with `allowed` boolean and an optional `message`
 */
export function checkStudentLimit(
  plan: SchoolPlan,
  currentStudentCount: number
): { allowed: boolean; limit: number | null; remaining: number | null; message?: string } {
  const limit = getStudentLimit(plan);

  // Unlimited plan
  if (limit === null) {
    return { allowed: true, limit: null, remaining: null };
  }

  const remaining = limit - currentStudentCount;

  if (remaining <= 0) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      message: `Student limit reached (${limit}). Please upgrade your plan to add more students.`,
    };
  }

  return { allowed: true, limit, remaining };
}

/**
 * Get a human-readable label for a student limit.
 */
export function formatStudentLimit(plan: SchoolPlan): string {
  const limit = getStudentLimit(plan);
  if (limit === null) return 'Unlimited students';
  return `Up to ${limit.toLocaleString()} students`;
}

// ============================================================================
// Plan upgrade helpers
// ============================================================================

/**
 * Get the next plan upgrade path.
 * @param plan The school's current plan
 * @returns The next plan, or null if already on the highest plan
 */
export function getUpgradePlan(plan: SchoolPlan): SchoolPlan | null {
  if (plan === 'basic') return 'pro';
  if (plan === 'pro') return 'premium';
  return null; // Already on premium
}
