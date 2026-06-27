"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  CreditCard,
  ArrowRight,
  X,
  RefreshCw,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────

type SubscriptionStatus = "active" | "past_due" | "expired" | "none";

interface StatusResult {
  status: SubscriptionStatus;
  should_degrade: boolean;
  degrade_reason: string;
  plan_id: string | null;
  billing_interval: string | null;
  next_billing_date: string | null;
  grace_period_ends_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Expired";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function getGraceEndLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-NG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function getNextBillingLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

// ── Live Countdown ────────────────────────────────────────────────────────

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      setDisplay(formatCountdown(target - now));
    };

    update();
    const interval = setInterval(update, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
      {display}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

interface SubscriptionGraceBannerProps {
  /** Optional callback when banner is dismissed */
  onDismiss?: () => void;
}

export function SubscriptionGraceBanner({
  onDismiss,
}: SubscriptionGraceBannerProps) {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc("check_school_subscription_status", { p_school_id: schoolId });

      if (error) {
        console.error("Grace banner: Failed to check subscription status:", error);
        return;
      }

      setStatus(data as unknown as StatusResult);
    } catch (err) {
      console.error("Grace banner: Error:", err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolLoading) {
      fetchStatus();
    }
  }, [schoolLoading, fetchStatus]);

  // Don't show anything while loading school context
  if (schoolLoading) return null;

  // Show skeleton while loading status
  if (loading) {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    );
  }

  // No status returned or active — nothing to show
  if (!status || status.status === "active" || status.status === "none") {
    return null;
  }

  // Dismissed — nothing to show
  if (dismissed) return null;

  // ── Past Due — Within Grace Period ──────────────────────────────────────
  if (status.status === "past_due" && !status.should_degrade) {
    const graceEnd = status.grace_period_ends_at;
    return (
      <div className="w-full rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 dark:border-amber-800 p-4 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                  Payment Past Due
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Your subscription payment is overdue. All features are still available
                  during the grace period.
                </p>
              </div>

              {/* Dismiss */}
              <button
                onClick={() => {
                  setDismissed(true);
                  onDismiss?.();
                }}
                className="flex-shrink-0 p-1 rounded-md text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Grace period details */}
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
              {graceEnd && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-800 dark:text-amber-200">
                    Grace period ends{" "}
                    <span className="font-semibold">
                      {getGraceEndLabel(graceEnd)}
                    </span>
                  </span>
                  <CountdownTimer targetDate={graceEnd} />
                </div>
              )}

              {status.next_billing_date && (
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <CreditCard className="h-4 w-4 text-amber-500" />
                  <span>
                    Amount due:{" "}
                    {getNextBillingLabel(status.next_billing_date)}
                  </span>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="mt-4 flex gap-3">
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                onClick={() => router.push("/subscription")}
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                Pay Now
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
                onClick={() => router.push("/admin/settings")}
              >
                Update Payment Method
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Grace Period Expired or Subscription Expired ────────────────────────
  if (
    status.status === "past_due" ||
    status.status === "expired"
  ) {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20 dark:border-red-800 p-4 shadow-sm">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 text-sm">
                  {status.status === "expired"
                    ? "Subscription Expired"
                    : "Grace Period Expired"}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {status.status === "expired"
                    ? "Your subscription has expired. Paid features have been locked."
                    : status.degrade_reason || "Your grace period has ended. Paid features have been locked."}
                </p>
              </div>

              <button
                onClick={() => {
                  setDismissed(true);
                  onDismiss?.();
                }}
                className="flex-shrink-0 p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Action */}
            <div className="mt-4 flex gap-3">
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
                onClick={() => router.push("/subscription")}
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                {status.status === "expired" ? "Reactivate Subscription" : "Renew Now"}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-800 hover:bg-red-100 dark:border-red-700 dark:text-red-200"
                onClick={() => router.push("/admin")}
              >
                <Shield className="h-4 w-4 mr-1.5" />
                View Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
