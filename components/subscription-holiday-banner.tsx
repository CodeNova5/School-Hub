"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  Umbrella,
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
  current_term: {
    id: string;
    name: string;
    session_name: string;
    start_date: string;
    end_date: string;
    is_current: boolean;
    weeks: number;
    next_term: {
      id: string;
      name: string;
      session_name: string;
      start_date: string;
      end_date: string;
      weeks: number;
    } | null;
  } | null;
}

// ── Component ─────────────────────────────────────────────────────────────

export function SubscriptionHolidayBanner() {
  const router = useRouter();
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Banner content derived after fetching
  const [nextTerm, setNextTerm] = useState<{
    id: string;
    name: string;
    session_name: string;
    start_date: string;
    end_date: string;
    weeks: number;
  } | null>(null);
  const [currentTermName, setCurrentTermName] = useState("");
  const [currentTermSession, setCurrentTermSession] = useState("");
  const [planKey, setPlanKey] = useState("basic");

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);

      const res = await fetch("/api/admin/subscription");
      if (!res.ok) return;

      const data: SubscriptionData = await res.json();
      const subscription = data.subscription;
      const effectiveStatus = data.status?.status || subscription?.status || "active";

      // Only show for termly + active
      if (subscription?.billing_interval !== "termly" || effectiveStatus !== "active") {
        setLoading(false);
        return;
      }

      const term = data.current_term;
      if (!term || !term.next_term) {
        setLoading(false);
        return;
      }

      // Check if the current term has ended
      const now = new Date();
      if (new Date(term.end_date) >= now) {
        setLoading(false);
        return;
      }

      setNextTerm(term.next_term);
      setCurrentTermName(term.name);
      setCurrentTermSession(term.session_name);
      setPlanKey(subscription.plan_key || data.school?.plan || "basic");
    } catch (err) {
      console.error("Holiday banner: Error fetching data:", err);
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
    <div className="w-full rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/20 dark:border-teal-800 p-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
            <Umbrella className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-teal-900 dark:text-teal-200 text-sm">
                On Holiday Break
              </h3>
              <p className="text-sm text-teal-700 dark:text-teal-300 mt-1">
                <span className="font-semibold">{currentTermName} · {currentTermSession}</span>{" "}
                has ended. Your school is currently on break — all features remain available.
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1 rounded-md text-teal-400 hover:text-teal-600 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Next term details */}
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-teal-500" />
              <span className="text-teal-800 dark:text-teal-200">
                <span className="font-semibold">{nextTerm.name}</span>
                <span className="text-teal-500 ml-1">· {nextTerm.session_name}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-teal-500" />
              <span className="text-teal-800 dark:text-teal-200">
                Starts{" "}
                {new Date(nextTerm.start_date).toLocaleDateString("en-NG", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-teal-500" />
              <span className="text-teal-800 dark:text-teal-200">{nextTerm.weeks} weeks</span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
              onClick={() =>
                router.push(
                  `/checkout?plan=${planKey}&interval=termly&termId=${nextTerm.id}`
                )
              }
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              Pay for {nextTerm.name}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-teal-300 text-teal-800 hover:bg-teal-100 dark:border-teal-700 dark:text-teal-200"
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
