"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  GraduationCap,
  Calendar,
  Clock,
  CreditCard,
  ArrowRight,
  X,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────

interface SubscriptionData {
  subscription: {
    id: string;
    billing_interval: "termly" | "yearly";
    status: string;
    plan_key: string;
    current_term_id: string | null;
  } | null;
  school: { plan: string } | null;
  status: { status: string } | null;
}

interface AvailableTerm {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  weeks: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function SubscriptionTermBanner() {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Banner content derived after fetching
  const [nextTerm, setNextTerm] = useState<AvailableTerm | null>(null);
  const [planKey, setPlanKey] = useState<string>("basic");
  const [daysUntilStart, setDaysUntilStart] = useState(0);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);

      // Fetch subscription and available terms in parallel
      const [subRes, termsRes] = await Promise.all([
        fetch("/api/admin/subscription"),
        fetch("/api/school/subscription/available-terms"),
      ]);

      if (!subRes.ok || !termsRes.ok) return;

      const subData: SubscriptionData = await subRes.json();
      const termsData: { terms: AvailableTerm[] } = await termsRes.json();

      const subscription = subData.subscription;
      const effectiveStatus = subData.status?.status || subscription?.status || "active";

      // Only show for termly, active subscriptions
      if (subscription?.billing_interval !== "termly" || effectiveStatus !== "active") {
        setLoading(false);
        return;
      }

      const terms = termsData.terms || [];
      if (terms.length === 0) {
        setLoading(false);
        return;
      }

      // Find which term is the "next unpaid" one
      // If subscription has a current_term_id, find the term after it
      // Otherwise, the first available term is the one
      let nextTermIndex = -1;

      if (subscription.current_term_id) {
        const currentIdx = terms.findIndex((t) => t.id === subscription.current_term_id);
        if (currentIdx >= 0 && currentIdx < terms.length - 1) {
          nextTermIndex = currentIdx + 1;
        }
      }

      // If no current_term_id or no term after it, the first upcoming term is the candidate
      if (nextTermIndex < 0) {
        // Find the first term whose start_date is in the future
        const now = new Date();
        const futureIdx = terms.findIndex((t) => new Date(t.start_date) > now);
        if (futureIdx >= 0) {
          nextTermIndex = futureIdx;
        }
      }

      if (nextTermIndex < 0) {
        setLoading(false);
        return;
      }

      const candidate = terms[nextTermIndex];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const termStart = new Date(candidate.start_date);
      termStart.setHours(0, 0, 0, 0);

      const daysUntil = Math.ceil(
        (termStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Show banner if term starts within the next 14 days but hasn't started yet
      if (daysUntil > 0 && daysUntil <= 14) {
        setNextTerm(candidate);
        setPlanKey(subscription.plan_key || subData.school?.plan || "basic");
        setDaysUntilStart(daysUntil);
      }
    } catch (err) {
      console.error("Term banner: Error fetching data:", err);
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

  if (schoolLoading) return null;

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

  if (!nextTerm || dismissed) return null;

  return (
    <div className="w-full rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 dark:border-blue-800 p-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                {daysUntilStart <= 3
                  ? "Term starts soon — Pay now"
                  : "Next term approaching"}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                <span className="font-semibold">
                  {nextTerm.name} · {nextTerm.session_name}
                </span>{" "}
                starts{" "}
                <span className="font-semibold">
                  {formatShortDate(nextTerm.start_date)}
                </span>
                {daysUntilStart > 0 && (
                  <span className="text-blue-500">
                    {" "}({daysUntilStart} day{daysUntilStart !== 1 ? "s" : ""} away)
                  </span>
                )}
                . Pay now to ensure uninterrupted access during the next term.
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1 rounded-md text-blue-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Term details */}
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-blue-800 dark:text-blue-200">
                {formatShortDate(nextTerm.start_date)} —{" "}
                {new Date(nextTerm.end_date).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-blue-800 dark:text-blue-200">
                {nextTerm.weeks} weeks
              </span>
            </div>
          </div>

          {/* Action */}
          <div className="mt-4 flex gap-3">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              onClick={() =>
                router.push(
                  `/checkout?plan=${planKey}&interval=termly&termId=${nextTerm.id}`
                )
              }
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              Pay Now
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 text-blue-800 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-200"
              onClick={() => router.push("/admin/subscription")}
            >
              <BookOpen className="h-4 w-4 mr-1.5" />
              View Subscription
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
