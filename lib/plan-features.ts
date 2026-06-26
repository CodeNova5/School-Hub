// ============================================================================
// PLAN FEATURES — Tier definitions and feature-to-plan mapping
// ============================================================================
//
// Three tiers:
//   Basic   → Core school operations
//   Pro     → Growth & engagement features
//   Premium → Full competitive advantage (everything unlocked)
// ============================================================================

import type { PlanFeature, SchoolPlan } from '@/lib/types';

// ── Plan Display Info ───────────────────────────────────────────────────────

export const PLAN_INFO: Record<SchoolPlan, {
  label: string;
  labelShort: string;
  description: string;
  color: string;       // Tailwind color class
  badgeColor: string;  // Badge background
  priceHint: string;
}> = {
  basic: {
    label: 'Basic',
    labelShort: 'Basic',
    description: 'Core school management — everything a school needs to operate',
    color: 'text-green-600',
    badgeColor: 'bg-green-100 text-green-800',
    priceHint: 'Free / Low cost',
  },
  pro: {
    label: 'Pro',
    labelShort: 'Pro',
    description: 'Growth & engagement features for medium-to-large schools',
    color: 'text-blue-600',
    badgeColor: 'bg-blue-100 text-blue-800',
    priceHint: 'Mid tier',
  },
  premium: {
    label: 'Premium',
    labelShort: 'Premium',
    description: 'Full competitive advantage with all premium features',
    color: 'text-purple-600',
    badgeColor: 'bg-purple-100 text-purple-800',
    priceHint: 'Top tier',
  },
};

// ── Feature-to-Plan Mapping ─────────────────────────────────────────────────
// Each feature is mapped to the minimum plan required to access it.
// Basic features are not listed here — they're always available.

export const FEATURE_PLAN_MAP: Record<PlanFeature, SchoolPlan> = {
  // Pro features
  finance: 'pro',
  payroll: 'pro',
  notifications: 'pro',
  calendar: 'pro',
  families: 'pro',
  assignments: 'pro',
  subject_analytics: 'pro',
  parents_guardians: 'pro',
  student_id_cards: 'pro',
  teacher_id_cards: 'pro',

  // Premium features
  ai_assistant: 'premium',
  website_builder: 'premium',
  jamb_cbt: 'premium',
  question_bank: 'premium',
  live_classes: 'premium',
  lesson_notes: 'premium',
  admissions: 'premium',
  alumni: 'premium',
  audit_trail: 'premium',
};

// ── Feature Metadata ────────────────────────────────────────────────────────

export interface FeatureMeta {
  key: PlanFeature;
  label: string;
  labelShort: string;
  description: string;
  category: 'engagement' | 'premium';
  icon: string; // Emoji icon for quick reference
}

export const FEATURE_META: Record<PlanFeature, FeatureMeta> = {
  // ── Pro Features ──
  finance: {
    key: 'finance',
    label: 'Finance & Fee Management',
    labelShort: 'Finance',
    description: 'Fee templates, billing, receipts, Paystack integration',
    category: 'engagement',
    icon: '💰',
  },
  payroll: {
    key: 'payroll',
    label: 'Teacher Payroll',
    labelShort: 'Payroll',
    description: 'Salary configuration, payment processing, subaccount setup',
    category: 'engagement',
    icon: '💵',
  },
  notifications: {
    key: 'notifications',
    label: 'Push Notifications',
    labelShort: 'Notifications',
    description: 'Send and manage push notifications to users',
    category: 'engagement',
    icon: '🔔',
  },
  calendar: {
    key: 'calendar',
    label: 'School Calendar',
    labelShort: 'Calendar',
    description: 'School events, holidays, and exam schedules',
    category: 'engagement',
    icon: '📅',
  },
  families: {
    key: 'families',
    label: 'Family Management',
    labelShort: 'Families',
    description: 'Group students into families for consolidated management',
    category: 'engagement',
    icon: '👪',
  },
  assignments: {
    key: 'assignments',
    label: 'Assignments',
    labelShort: 'Assignments',
    description: 'Create, distribute, and grade assignments',
    category: 'engagement',
    icon: '📝',
  },
  subject_analytics: {
    key: 'subject_analytics',
    label: 'Subject Classes & Analytics',
    labelShort: 'Subject Analytics',
    description: 'Per-subject analytics, performance tracking, allocations',
    category: 'engagement',
    icon: '📊',
  },
  parents_guardians: {
    key: 'parents_guardians',
    label: 'Parents & Guardians',
    labelShort: 'Parents',
    description: 'Parent account management and student linking',
    category: 'engagement',
    icon: '👨‍👩‍👧‍👦',
  },
  student_id_cards: {
    key: 'student_id_cards',
    label: 'Student ID Card Generator',
    labelShort: 'Student ID Cards',
    description: 'Generate and print student identification cards',
    category: 'engagement',
    icon: '🪪',
  },
  teacher_id_cards: {
    key: 'teacher_id_cards',
    label: 'Teacher ID Card Generator',
    labelShort: 'Teacher ID Cards',
    description: 'Generate and print teacher identification cards',
    category: 'engagement',
    icon: '🪪',
  },

  // ── Premium Features ──
  ai_assistant: {
    key: 'ai_assistant',
    label: 'AI Assistant',
    labelShort: 'AI Assistant',
    description: 'AI-powered data query assistant for admin, teachers, students, and parents',
    category: 'premium',
    icon: '🤖',
  },
  website_builder: {
    key: 'website_builder',
    label: 'School Website Builder',
    labelShort: 'Website Builder',
    description: 'Drag-and-drop school website builder with custom subdomain',
    category: 'premium',
    icon: '🌐',
  },
  jamb_cbt: {
    key: 'jamb_cbt',
    label: 'JAMB CBT Practice',
    labelShort: 'JAMB CBT',
    description: 'JAMB exam simulation and practice platform for students',
    category: 'premium',
    icon: '🎯',
  },
  question_bank: {
    key: 'question_bank',
    label: 'Question Bank',
    labelShort: 'Question Bank',
    description: 'Create, organize, and reuse assessment questions',
    category: 'premium',
    icon: '📚',
  },
  live_classes: {
    key: 'live_classes',
    label: 'Live Classes (Zoom)',
    labelShort: 'Live Classes',
    description: 'Zoom-integrated live virtual classes',
    category: 'premium',
    icon: '📡',
  },
  lesson_notes: {
    key: 'lesson_notes',
    label: 'AI Lesson Notes',
    labelShort: 'Lesson Notes',
    description: 'AI-generated lesson notes for teachers',
    category: 'premium',
    icon: '📖',
  },
  admissions: {
    key: 'admissions',
    label: 'Online Admissions',
    labelShort: 'Admissions',
    description: 'Online application management with approve/reject workflow',
    category: 'premium',
    icon: '📋',
  },
  alumni: {
    key: 'alumni',
    label: 'Alumni Management',
    labelShort: 'Alumni',
    description: 'Alumni profiles, directory, and community features',
    category: 'premium',
    icon: '🎓',
  },
  audit_trail: {
    key: 'audit_trail',
    label: 'Audit Trail',
    labelShort: 'Audit Trail',
    description: 'Track all admin actions with detailed audit logs',
    category: 'premium',
    icon: '📜',
  },
};

// ── Grouped Features by Plan ────────────────────────────────────────────────

export const FEATURES_BY_PLAN: Record<SchoolPlan, PlanFeature[]> = {
  basic: [],
  pro: (Object.entries(FEATURE_PLAN_MAP) as [PlanFeature, SchoolPlan][])
    .filter(([, plan]) => plan === 'pro')
    .map(([feature]) => feature),
  premium: (Object.entries(FEATURE_PLAN_MAP) as [PlanFeature, SchoolPlan][])
    .filter(([, plan]) => plan === 'premium')
    .map(([feature]) => feature),
};

// ── Helper Functions ────────────────────────────────────────────────────────

/**
 * Check if a school's plan allows access to a specific feature.
 * @param plan   The school's current plan
 * @param feature The feature to check
 * @returns true if the feature is available on this plan
 */
export function hasFeature(plan: SchoolPlan, feature: PlanFeature): boolean {
  if (plan === 'premium') return true; // Premium has everything
  if (plan === 'pro') {
    // Pro has all pro features + basic features (which aren't in the map)
    const requiredPlan = FEATURE_PLAN_MAP[feature];
    return requiredPlan === 'pro'; // Only pro-level features
  }
  // Basic has no paid features
  return false;
}

/**
 * Get all features that are locked for a given plan.
 * @param plan The school's current plan
 * @returns Array of features that this plan cannot access
 */
export function getLockedFeatures(plan: SchoolPlan): PlanFeature[] {
  if (plan === 'premium') return [];
  if (plan === 'pro') return FEATURES_BY_PLAN.premium;
  return [...FEATURES_BY_PLAN.pro, ...FEATURES_BY_PLAN.premium];
}

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

/**
 * Get the plan required for a feature's human-readable name.
 * @param feature The feature key
 * @returns The minimum plan name required
 */
export function getRequiredPlan(feature: PlanFeature): SchoolPlan {
  return FEATURE_PLAN_MAP[feature];
}

/**
 * All plans ordered from lowest to highest.
 */
export const ALL_PLANS: SchoolPlan[] = ['basic', 'pro', 'premium'];

/**
 * Check if plan A is sufficient to access features of plan B.
 * (e.g., premium >= pro, pro >= basic)
 */
export function isPlanAtLeast(plan: SchoolPlan, minimum: SchoolPlan): boolean {
  const rank: Record<SchoolPlan, number> = { basic: 0, pro: 1, premium: 2 };
  return rank[plan] >= rank[minimum];
}
