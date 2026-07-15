"use client";

import { useEffect, useState, useCallback } from "react";

interface PlanFeaturesResult {
  /** Map of plan_key → array of enabled feature keys (from DB) */
  planFeatures: Record<string, string[]> | null;
  /** Map of feature_key → { label, label_short, description, icon, category } (from DB) */
  featureMetadata: Record<string, {
    label: string;
    label_short: string;
    description: string;
    icon: string;
    category: string;
  }> | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Check if a specific feature is enabled for a given plan.
   * Falls back to the hardcoded FEATURE_PLAN_MAP logic if DB data hasn't loaded.
   */
  isFeatureEnabled: (plan: string, featureKey: string) => boolean;
  /**
   * Get all locked features for a given plan (features NOT enabled).
   * Falls back to hardcoded getLockedFeatures() if DB data hasn't loaded.
   */
  getLockedFeatures: (plan: string, allFeatures: string[]) => string[];
  /**
   * Get the minimum plan that enables this feature.
   * Returns 'pro' or 'premium', or null if not found.
   */
  getRequiredPlan: (featureKey: string) => string | null;
}

// Hardcoded fallback: all known paid feature keys
const ALL_PAID_FEATURES = [
  'finance', 'payroll', 'notifications', 'calendar', 'families',
  'assignments', 'subject_analytics', 'parents_guardians',
  'student_id_cards', 'teacher_id_cards',
  'inventory_management',
  'ai_assistant', 'website_builder', 'jamb_cbt', 'question_bank',
  'live_classes', 'lesson_notes', 'admissions', 'alumni', 'audit_trail',
];

// Hardcoded fallback: pro features
const PRO_FEATURES = new Set([
  'finance', 'payroll', 'notifications', 'calendar', 'families',
  'assignments', 'subject_analytics', 'parents_guardians',
  'student_id_cards', 'teacher_id_cards',
  'inventory_management',
]);

// Hardcoded fallback: premium features
const PREMIUM_FEATURES = new Set([
  'inventory_management',
  'ai_assistant', 'website_builder', 'jamb_cbt', 'question_bank',
  'live_classes', 'lesson_notes', 'admissions', 'alumni', 'audit_trail',
]);

export function usePlanFeatures(): PlanFeaturesResult {
  const [planFeatures, setPlanFeatures] = useState<Record<string, string[]> | null>(null);
  const [featureMetadata, setFeatureMetadata] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      try {
        setIsLoading(true);
        const [planRes, metaRes] = await Promise.all([
          fetch("/api/school/plan-features"),
          fetch("/api/features"),
        ]);

        if (planRes.ok) {
          const planData = await planRes.json();
          if (!cancelled) {
            setPlanFeatures(planData.planFeatures ?? null);
          }
        }

        if (metaRes.ok) {
          const metaData = await metaRes.json();
          if (!cancelled) {
            setFeatureMetadata(metaData.features ?? null);
          }
        }

        if (!cancelled) {
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  const isFeatureEnabled = useCallback(
    (plan: string, featureKey: string): boolean => {
      if (planFeatures && planFeatures[plan]) {
        return planFeatures[plan].includes(featureKey);
      }
      if (plan === 'premium') return true;
      if (plan === 'pro') return PRO_FEATURES.has(featureKey);
      return false;
    },
    [planFeatures]
  );

  const getLockedFeatures = useCallback(
    (plan: string, allFeatures: string[]): string[] => {
      if (planFeatures && planFeatures[plan]) {
        const enabled = new Set(planFeatures[plan]);
        return allFeatures.filter((f) => !enabled.has(f));
      }
      if (plan === 'premium') return [];
      if (plan === 'pro') return ALL_PAID_FEATURES.filter((f) => !PRO_FEATURES.has(f));
      return [...ALL_PAID_FEATURES];
    },
    [planFeatures]
  );

  const getRequiredPlan = useCallback(
    (featureKey: string): string | null => {
      if (planFeatures) {
        for (const [plan, features] of Object.entries(planFeatures)) {
          if (features.includes(featureKey)) {
            return plan;
          }
        }
        return null;
      }
      if (PRO_FEATURES.has(featureKey)) return 'pro';
      if (PREMIUM_FEATURES.has(featureKey)) return 'premium';
      return null;
    },
    [planFeatures]
  );

  return {
    planFeatures,
    featureMetadata,
    isLoading,
    error,
    isFeatureEnabled,
    getLockedFeatures,
    getRequiredPlan,
  };
}
