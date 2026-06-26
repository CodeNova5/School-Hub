// ============================================================================
// PLAN FEATURES — Remaining helpers not yet moved to DB
// ============================================================================
//
// Most plan data is now DB-driven (subscription_plans, subscription_features,
// subscription_plan_features). This file only retains helpers that haven't
// been moved to the DB yet.
// ============================================================================

import type { SchoolPlan } from '@/lib/types';

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
