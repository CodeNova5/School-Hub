"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Users, TrendingUp, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface LimitInfo {
  plan: string;
  active_student_count: number;
  student_limit: number | null;
  remaining: number | null;
  allowed: boolean;
  message: string | null;
}

export function StudentLimitBanner() {
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/admin/check-student-limit")
      .then((res) => res.json())
      .then((data) => {
        setLimitInfo(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !limitInfo || dismissed) return null;

  // Unlimited plan — no banner needed
  if (limitInfo.student_limit === null) return null;

  const usagePercent = Math.round(
    (limitInfo.active_student_count / limitInfo.student_limit) * 100
  );

  const isCritical = usagePercent >= 90;
  const isWarning = usagePercent >= 75;

  if (!isWarning && !isCritical) return null;

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 ${
        isCritical
          ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
          : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
            isCritical
              ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
              : "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
          }`}>
            {isCritical ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-semibold ${
                isCritical ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"
              }`}>
                {isCritical
                  ? "Student limit nearly reached"
                  : "Approaching student limit"}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                isCritical
                  ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700"
                  : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700"
              }`}>
                {limitInfo.active_student_count}/{limitInfo.student_limit}
              </span>
            </div>

            <Progress
              value={usagePercent}
              className={`h-2 max-w-xs ${
                isCritical
                  ? "[&>div]:bg-red-500"
                  : "[&>div]:bg-amber-500"
              }`}
            />

            <p className={`text-xs ${
              isCritical ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
            }`}>
              {limitInfo.remaining && limitInfo.remaining > 0
                ? `You have ${limitInfo.remaining} slot${limitInfo.remaining === 1 ? "" : "s"} remaining on your ${limitInfo.plan === "basic" ? "Free" : "Pro"} plan (${limitInfo.student_limit.toLocaleString()} max).`
                : `You've reached the ${limitInfo.student_limit.toLocaleString()} student limit on your ${limitInfo.plan === "basic" ? "Free" : "Pro"} plan.`}
            </p>

            {(!limitInfo.allowed || isCritical) && (
              <Link href="/admin/subscription">
                <Button
                  size="sm"
                  className={`h-8 text-xs font-medium ${
                    isCritical
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-amber-600 hover:bg-amber-700 text-white"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                  Upgrade Plan
                </Button>
              </Link>
            )}
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className={`p-1 rounded-md transition-colors flex-shrink-0 ${
            isCritical
              ? "hover:bg-red-100 text-red-400 dark:hover:bg-red-900/50"
              : "hover:bg-amber-100 text-amber-400 dark:hover:bg-amber-900/50"
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
