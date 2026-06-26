"use client";

import { useState, useEffect } from "react";
import { X, Shield, ArrowUp } from "lucide-react";
import { useSchoolContext } from "@/hooks/use-school-context";
import { PLAN_INFO, getUpgradePlan, getLockedFeatures, FEATURE_META } from "@/lib/plan-features";
import type { SchoolPlan } from "@/lib/types";

const DISMISS_COOKIE_KEY = "upgrade_banner_dismissed";

export function UpgradeBanner() {
  const { schoolPlan, isLoading } = useSchoolContext();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isLoading || !schoolPlan) return;

    // Only show for Basic and Pro (not Premium)
    if (schoolPlan === "premium") {
      setVisible(false);
      return;
    }

    // Check if the user dismissed the banner in this session
    const dismissedFlag = sessionStorage.getItem(DISMISS_COOKIE_KEY);
    if (dismissedFlag) {
      setDismissed(true);
      setVisible(false);
      return;
    }

    // Show the banner with a slight delay for a smooth entrance
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, [schoolPlan, isLoading]);

  function handleDismiss() {
    setDismissed(true);
    setVisible(false);
    sessionStorage.setItem(DISMISS_COOKIE_KEY, "true");
  }

  if (!visible || dismissed || isLoading || !schoolPlan) return null;

  const upgradePlan = getUpgradePlan(schoolPlan);
  const lockedFeatures = getLockedFeatures(schoolPlan);
  const currentInfo = PLAN_INFO[schoolPlan];
  const upgradeInfo = upgradePlan ? PLAN_INFO[upgradePlan] : null;

  // Pick up to 3 locked features to showcase
  const showcaseFeatures = lockedFeatures
    .slice(0, 3)
    .map((f) => FEATURE_META[f])
    .filter(Boolean);

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border-2 mb-6 transition-all duration-300 ease-out
        ${schoolPlan === "basic"
          ? "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40"
          : "border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40"
        }
      `}
    >
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
        aria-label="Dismiss upgrade banner"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col sm:flex-row items-start gap-4 p-5 pr-10">
        {/* Icon */}
        <div
          className={`
            flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl
            ${schoolPlan === "basic"
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
              : "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300"
            }
          `}
        >
          <Shield className="h-6 w-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground">Current plan:</span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${currentInfo.badgeColor}`}>
              <Shield className="h-3 w-3" />
              {currentInfo.label}
            </span>
            {upgradeInfo && (
              <>
                <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${upgradeInfo.badgeColor}`}>
                  <Shield className="h-3 w-3" />
                  {upgradeInfo.label}
                </span>
              </>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {schoolPlan === "basic"
              ? "Unlock growth features like Finance, Payroll, Notifications, and more."
              : "Go Premium to unlock AI Assistant, Website Builder, JAMB CBT, Question Bank, and more."
            }
          </p>

          {/* Feature teaser */}
          {showcaseFeatures.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {showcaseFeatures.map((meta) => (
                <span
                  key={meta.key}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/70 dark:bg-gray-900/50 text-xs text-muted-foreground border"
                >
                  <span>{meta.icon}</span>
                  {meta.labelShort}
                </span>
              ))}
              {lockedFeatures.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs text-muted-foreground">
                  +{lockedFeatures.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        {upgradeInfo && (
          <div className="flex-shrink-0 self-start sm:self-center">
            <button
              className={`
                inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]
                ${schoolPlan === "basic"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-purple-600 hover:bg-purple-700"
                }
              `}
              // Placeholder — replace with actual upgrade flow when available
              onClick={() => alert(`Upgrade to ${upgradeInfo.label} — coming soon!`)}
            >
              <ArrowUp className="h-4 w-4" />
              Upgrade to {upgradeInfo.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
