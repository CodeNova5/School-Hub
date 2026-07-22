"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PlanDisplayInfo {
  plan_key: string;
  name: string;
  label_short: string;
  description: string;
  price_hint: string;
  monthly_price: number;
  termly_price: number;
  yearly_price: number;
}

// ── Hardcoded Fallback ─────────────────────────────────────────────────────
// Used when DB data hasn't loaded yet — matches the seed values so there's no
// visual flash when the DB data loads.
//
// Note: CSS/styling classes are now hardcoded in the helper functions in
// subscription-utils.tsx — NOT stored in the database or returned from the API.

const FALLBACK_PLANS: Record<string, PlanDisplayInfo> = {
  basic: {
    plan_key: "basic",
    name: "Basic",
    label_short: "Basic",
    description: "Core school management — everything a school needs to operate",
    price_hint: "Free / Low cost",
    termly_price: 0,
    monthly_price: 0,
    yearly_price: 0,
  },
  pro: {
    plan_key: "pro",
    name: "Pro",
    label_short: "Pro",
    description: "Growth & engagement features for medium-to-large schools",
    price_hint: "Mid tier",
    termly_price: 99700,
    monthly_price: 29900,
    yearly_price: 299000,
  },
  premium: {
    plan_key: "premium",
    name: "Premium",
    label_short: "Premium",
    description: "Full competitive advantage with all premium features",
    price_hint: "Top tier",
    termly_price: 233000,
    monthly_price: 69900,
    yearly_price: 699000,
  },
};

// ── Hook ───────────────────────────────────────────────────────────────────

interface UsePlanDisplayInfoResult {
  /** Map of plan_key → PlanDisplayInfo. Null while loading. */
  plans: Record<string, PlanDisplayInfo> | null;
  /** True while initial fetch is in progress */
  isLoading: boolean;
  /** Any fetch error */
  error: string | null;
  /**
   * Get plan display info for a given plan key.
   * Falls back to hardcoded values if DB data hasn't loaded yet.
   */
  getPlanInfo: (planKey: string) => PlanDisplayInfo;
}

export function usePlanDisplayInfo(): UsePlanDisplayInfoResult {
  const [plans, setPlans] = useState<Record<string, PlanDisplayInfo> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPlans() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/plans");
        if (!res.ok) {
          throw new Error(`Failed to load plans: ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled && data.plans) {
          const map: Record<string, PlanDisplayInfo> = {};
          for (const plan of data.plans) {
            map[plan.plan_key] = plan;
          }
          setPlans(map);
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

    fetchPlans();
    return () => { cancelled = true; };
  }, []);

  const getPlanInfo = useCallback(
    (planKey: string): PlanDisplayInfo => {
      if (plans && plans[planKey]) return plans[planKey];
      return FALLBACK_PLANS[planKey] ?? FALLBACK_PLANS.basic;
    },
    [plans]
  );

  return {
    plans,
    isLoading,
    error,
    getPlanInfo,
  };
}

// ── Convenience: plan_keys in order ────────────────────────────────────────

export const PLAN_KEYS_IN_ORDER = ["basic", "pro", "premium"] as const;
