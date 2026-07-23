'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Crown, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ── Types ─────────────────────────────────────────────────────────────────

interface SubscriptionData {
  subscription: {
    id: string;
    billing_interval: 'termly' | 'yearly';
    status: string;
    plan_key: string;
    current_term_id: string | null;
    next_billing_date: string | null;
  } | null;
  school: {
    plan: string;
    name: string;
  } | null;
  status: {
    status: string;
    should_degrade: boolean;
    degrade_reason: string;
  } | null;
  current_term: {
    id: string;
    name: string;
    end_date: string;
    session_name: string;
  } | null;
}

// ── Plan Display Config ───────────────────────────────────────────────────

const PLAN_CONFIG: Record<string, { name: string; color: string; bgGradient: string; icon: string }> = {
  basic: {
    name: 'Basic',
    color: 'text-gray-700',
    bgGradient: 'from-gray-50 to-slate-50',
    icon: '📋',
  },
  standard: {
    name: 'Standard',
    color: 'text-blue-700',
    bgGradient: 'from-blue-50 to-indigo-50',
    icon: '⭐',
  },
  professional: {
    name: 'Professional',
    color: 'text-amber-700',
    bgGradient: 'from-amber-50 to-orange-50',
    icon: '👑',
  },
  enterprise: {
    name: 'Enterprise',
    color: 'text-purple-700',
    bgGradient: 'from-purple-50 to-violet-50',
    icon: '🏢',
  },
};

function getPlanConfig(planKey: string) {
  return PLAN_CONFIG[planKey] || PLAN_CONFIG.basic;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function PlanStatusBanner() {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/admin/subscription');
      if (!res.ok) {
        throw new Error('Failed to fetch subscription data');
      }

      const data: SubscriptionData = await res.json();
      setSubscriptionData(data);
    } catch (err) {
      console.error('Plan status banner: Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subscription info');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolLoading) {
      fetchData();
    }
  }, [schoolLoading, fetchData]);

  // ── Render guards ────────────────────────────────────────────────────

  if (schoolLoading || loading) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !subscriptionData) {
    // Still show a basic banner even if there's an error
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-slate-50 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Crown className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">School Hub Account</h3>
              <p className="text-sm text-gray-500">Manage your subscription plan</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/admin/subscription')}
            className="gap-2"
          >
            View Subscription
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  const { subscription, school, status, current_term } = subscriptionData;
  const planKey = subscription?.plan_key || school?.plan || 'basic';
  const planConfig = getPlanConfig(planKey);
  const isActive = status?.status === 'active' || (!status && subscription);

  // Calculate subscription end date
  let subscriptionEndDate: string | null = null;
  if (current_term?.end_date) {
    subscriptionEndDate = current_term.end_date;
  } else if (subscription?.next_billing_date) {
    subscriptionEndDate = subscription.next_billing_date;
  }

  return (
    <div
      className={`w-full rounded-xl border border-amber-200 bg-gradient-to-r ${planConfig.bgGradient} p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Plan Icon */}
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
            <span className="text-xl">{planConfig.icon}</span>
          </div>

          {/* Plan Info */}
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold text-sm ${planConfig.color}`}>
                You are on the {planConfig.name} Plan
              </h3>
              {isActive && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <CheckCircle className="h-3 w-3" />
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              {subscriptionEndDate ? (
                <>Your subscription is active until <span className="font-medium">{formatDate(subscriptionEndDate)}</span></>
              ) : (
                <>Your subscription is <span className="font-medium">{status?.status || 'active'}</span></>
              )}
              {subscription?.billing_interval && (
                <span className="text-gray-400 ml-1">· {subscription.billing_interval === 'yearly' ? 'Annual' : 'Termly'}</span>
              )}
            </p>
          </div>
        </div>

        {/* View Subscription Button */}
        <Button
          size="sm"
          onClick={() => router.push('/admin/subscription')}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
        >
          View Subscription
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
