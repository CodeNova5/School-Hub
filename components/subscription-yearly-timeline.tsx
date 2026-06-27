"use client";

import { useEffect, useState, useCallback } from "react";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  Calendar,
  CheckCircle2,
  CircleDot,
  ChevronRight,
  Clock,
  BookOpen,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────

interface YearlyCoveredTerm {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

interface SubscriptionData {
  subscription: {
    id: string;
    billing_interval: "termly" | "yearly";
    status: string;
    plan_key: string;
    current_term_id: string | null;
    current_period_end: string | null;
    next_billing_date: string | null;
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
  } | null;
  yearly_covered_terms: YearlyCoveredTerm[] | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function SubscriptionYearlyTimeline() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    try {
      setLoading(true);
      const res = await fetch("/api/admin/subscription");
      if (!res.ok) return;

      const json: SubscriptionData = await res.json();
      setData(json);
    } catch (err) {
      console.error("Yearly timeline: Error fetching data:", err);
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

  const subscription = data?.subscription;
  const effectiveStatus = data?.status?.status || subscription?.status || "active";
  const terms = data?.yearly_covered_terms;

  // Dismissed
  if (dismissed) return null;

  // Only show for yearly subscribers with covered terms
  if (
    !subscription ||
    subscription.billing_interval !== "yearly" ||
    effectiveStatus !== "active" ||
    !terms ||
    terms.length === 0
  ) {
    return null;
  }

  // Determine which term (if any) is the "current" one
  const now = new Date();
  let currentTermIdx = -1;

  // If there's a current_term from the API, find it
  if (data?.current_term) {
    currentTermIdx = terms.findIndex((t) => t.id === data.current_term!.id);
  }

  // Fallback: find by date
  if (currentTermIdx < 0) {
    currentTermIdx = terms.findIndex(
      (t) =>
        new Date(t.start_date) <= now &&
        new Date(t.end_date) >= now
    );
  }

  // If none is current, use the last one as the "active" for highlighting
  const highlightedIdx = currentTermIdx >= 0 ? currentTermIdx : terms.length - 1;

  return (
    <div className="w-full rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20 dark:border-violet-800 p-4 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-violet-900 dark:text-violet-200 text-sm">
                Yearly Coverage
              </h3>
              <p className="text-sm text-violet-700 dark:text-violet-300 mt-1">
                Your yearly plan covers{" "}
                <span className="font-semibold">{terms.length} terms</span>.
                Next renewal:{" "}
                <span className="font-semibold">
                  {subscription.next_billing_date
                    ? new Date(subscription.next_billing_date).toLocaleDateString(
                        "en-NG",
                        { year: "numeric", month: "long", day: "numeric" }
                      )
                    : "—"}
                </span>
              </p>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1 rounded-md text-violet-400 hover:text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Timeline */}
          <div className="mt-4">
            <div className="relative">
              {/* Vertical connecting line */}
              <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-violet-200 dark:bg-violet-700" />

              <div className="space-y-3">
                {terms.map((term, idx) => {
                  const isCurrent = idx === highlightedIdx;
                  const isPast = new Date(term.end_date) < now;
                  const isLast = idx === terms.length - 1;

                  return (
                    <div key={term.id} className="flex items-start gap-3 relative">
                      {/* Timeline dot */}
                      <div className="flex-shrink-0 relative z-10 mt-1">
                        {isCurrent ? (
                          <div className="h-8 w-8 rounded-full bg-violet-500 flex items-center justify-center ring-4 ring-violet-100 dark:ring-violet-900/50">
                            <CircleDot className="h-4 w-4 text-white" />
                          </div>
                        ) : isPast ? (
                          <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                            <Calendar className="h-4 w-4 text-violet-500 dark:text-violet-400" />
                          </div>
                        )}
                      </div>

                      {/* Term info */}
                      <div
                        className={`flex-1 min-w-0 rounded-lg px-3.5 py-2.5 transition-all ${
                          isCurrent
                            ? "bg-violet-100 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700"
                            : "bg-white/60 dark:bg-gray-800/40 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`text-sm font-semibold truncate ${
                                isCurrent
                                  ? "text-violet-900 dark:text-violet-200"
                                  : "text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {term.name}
                            </span>
                            <span className="text-xs text-violet-500 dark:text-violet-400 shrink-0">
                              · {term.session_name}
                            </span>
                          </div>

                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-violet-500 px-2 py-0.5 rounded-full shrink-0">
                              <ChevronRight className="h-2.5 w-2.5" />
                              Current
                            </span>
                          )}
                          {isPast && !isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-100 dark:bg-green-900/50 dark:text-green-400 px-2 py-0.5 rounded-full shrink-0">
                              Done
                            </span>
                          )}
                          {!isCurrent && !isPast && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-400 px-2 py-0.5 rounded-full shrink-0">
                              Upcoming
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDateRange(term.start_date, term.end_date)}
                          </span>
                          <span className="text-[10px] font-medium text-violet-500 bg-violet-100 dark:bg-violet-900/50 dark:text-violet-400 px-1.5 py-0.5 rounded-full">
                            <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                            {term.weeks}wk
                          </span>
                        </div>

                        {/* Progress indicator for current term */}
                        {isCurrent && (
                          <div className="mt-2">
                            <div className="w-full h-1.5 bg-violet-200 dark:bg-violet-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-500 rounded-full transition-all"
                                style={{
                                  width: `${
                                    Math.min(
                                      100,
                                      Math.max(
                                        0,
                                        ((now.getTime() -
                                          new Date(term.start_date).getTime()) /
                                          (new Date(term.end_date).getTime() -
                                            new Date(term.start_date).getTime())) *
                                          100
                                      )
                                    )
                                  }%`,
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-violet-500 dark:text-violet-400 mt-0.5">
                              In progress
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            {subscription.current_period_end && (
              <div className="mt-3 flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400">
                <Calendar className="h-3 w-3" />
                <span>
                  Period ends:{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString(
                    "en-NG",
                    { year: "numeric", month: "long", day: "numeric" }
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
