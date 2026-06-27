"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import {
  Check,
  X,
  Zap,
  Shield,
  Star,
  Sparkles,
  ArrowLeft,
  Clock,
  Calendar,
  ChevronRight,
  GraduationCap,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}



// ── Loading Skeleton ──────────────────────────────────────────────────────

function SubscriptionSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-6 text-center mb-12 animate-pulse">
          <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          <div className="h-4 w-96 bg-slate-200 dark:bg-slate-800 rounded-lg mx-auto" />
          <div className="h-9 w-48 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-6" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-4 p-8 rounded-2xl border bg-white/50 dark:bg-slate-900/50">
              <div className="h-6 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="space-y-2 pt-4">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-5 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

function SubscriptionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getPlanInfo, isLoading: plansLoading } = usePlanDisplayInfo();
  const { planFeatures, featureMetadata, isLoading: featuresLoading, error: featuresError, isFeatureEnabled } = usePlanFeatures();

  // ── State ──
  const [billingInterval, setBillingInterval] = useState<"termly" | "yearly">("termly");
  const [mounted, setMounted] = useState(false);

  // ── Query params from upgrade flow ──
  const featureKey = searchParams.get("feature");
  const currentPlan = searchParams.get("plan");
  const returnPath = searchParams.get("from");

  // ── Animate in ──
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(timer);
  }, []);

  // ── Loading ──
  if (plansLoading || featuresLoading) {
    return <SubscriptionSkeleton />;
  }

  // ── Error ──
  if (featuresError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3 p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <X className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Failed to load plans</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{featuresError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Gather all features for comparison table ──
  const allFeatureKeys = featureMetadata ? Object.keys(featureMetadata) : [];
  // Categorize features by their DB category
  const proFeatures = allFeatureKeys.filter((k) => featureMetadata?.[k]?.category === "engagement");
  const premiumFeatures = allFeatureKeys.filter((k) => featureMetadata?.[k]?.category === "premium");



  const animClass = mounted
    ? "opacity-100 translate-y-0"
    : "opacity-0 translate-y-6";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Decorative Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-gradient-to-br from-blue-100/30 to-indigo-100/20 dark:from-blue-900/10 dark:to-indigo-900/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-tr from-purple-100/20 to-pink-100/10 dark:from-purple-900/5 dark:to-pink-900/5 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-16 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <div className={`text-center mb-10 sm:mb-14 transition-all duration-500 ease-out ${animClass}`}>
          {returnPath && (
            <button
              onClick={() => router.push(returnPath)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mb-6"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to dashboard
            </button>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Choose Your Plan
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
            {featureKey && currentPlan
              ? `Upgrade your plan to unlock ${featureMetadata?.[featureKey]?.label ?? "this feature"}. Pick the tier that fits your school.`
              : "Pick the plan that fits your school. Upgrade or downgrade anytime."}
          </p>

          {currentPlan && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">
              <Shield className="h-4 w-4" />
              Current plan:{" "}
              <span className="font-semibold">{getPlanInfo(currentPlan).label_short}</span>
            </div>
          )}

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-3 mt-8 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all duration-300">
            <button
              onClick={() => setBillingInterval("termly")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                billingInterval === "termly"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Per Term
              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                Recommended
              </span>
            </button>
            <button
              onClick={() => setBillingInterval("yearly")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                billingInterval === "yearly"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Yearly
              <span className="text-[10px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                Best value
              </span>
            </button>
          </div>
        </div>

        {/* ── Plan Cards ── */}
        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 transition-all duration-500 delay-100 ease-out ${animClass}`}>
          {PLAN_KEYS_IN_ORDER.map((key, index) => {
            const info = getPlanInfo(key);
            const isCurrentPlan = currentPlan === key;
            const price = billingInterval === "termly" ? (info.termly_price || info.monthly_price * 3) : info.yearly_price;

            return (
              <div
                key={key}
                className={`
                  relative flex flex-col rounded-2xl border-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
                  transition-all duration-300 hover:shadow-xl
                  ${info.border_color}
                  ${isCurrentPlan ? "ring-2 ring-offset-2 ring-offset-transparent opacity-90" : ""}
                  ${key === "premium" ? "scale-[1.02] lg:scale-105 shadow-xl" : "shadow-sm hover:scale-[1.01]"}
                  ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
                `}
                style={{ transitionDelay: `${150 + index * 100}ms` }}
              >
                {/* Popular Badge */}
                {key === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
                      <Star className="h-3 w-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-lg">
                      <Shield className="h-3 w-3" />
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Card Header */}
                <div className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2.5 rounded-xl ${info.icon_bg}`}>
                      {key === "basic" ? (
                        <Shield className={`h-5 w-5 ${info.color}`} />
                      ) : key === "pro" ? (
                        <Zap className={`h-5 w-5 ${info.color}`} />
                      ) : (
                        <Sparkles className={`h-5 w-5 ${info.color}`} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {info.label_short}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{info.name}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                    {info.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    {price === 0 ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">Free</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
                            {formatPrice(price)}
                          </span>
                          <span className="text-sm text-slate-400 dark:text-slate-500">
                            /{billingInterval === "termly" ? "term" : "yr"}
                          </span>
                        </div>
                        {billingInterval === "yearly" && info.monthly_price > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {formatPrice(info.monthly_price)}/mo billed annually
                          </p>
                        )}
                        {billingInterval === "termly" && info.yearly_price > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            3 terms per year · No charges during holidays
                          </p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{info.price_hint}</p>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => {
                      if (isCurrentPlan) return;
                      const params = new URLSearchParams();
                      if (featureKey) params.set("feature", featureKey);
                      params.set("plan", key);
                      params.set("interval", billingInterval);
                      if (returnPath) params.set("from", returnPath);
                      router.push(`/checkout?${params.toString()}`);
                    }}
                    disabled={isCurrentPlan}
                    className={`
                      w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                      transition-all duration-200
                      ${isCurrentPlan
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default"
                        : key === "basic"
                          ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 shadow-md hover:shadow-lg"
                          : key === "pro"
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
                            : "bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
                      }
                      hover:scale-[1.02] active:scale-[0.98]
                      focus:outline-none focus:ring-2 focus:ring-offset-2
                    `}
                  >
                    {isCurrentPlan ? (
                      <>
                        <Check className="h-4 w-4" />
                        Current Plan
                      </>
                    ) : (
                      <>
                        {key === "basic" ? "Get Started" : "Upgrade"}
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Feature List */}
                <div className="px-6 sm:px-8 pb-6 sm:pb-8 flex-1">
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4">
                      {key === "basic"
                        ? "Core Features"
                        : key === "pro"
                          ? "Everything in Basic, plus:"
                          : "Everything in Pro, plus:"}
                    </p>

                    {/* Show all features for this plan */}
                    <ul className="space-y-3">
                      {/* Pro features section */}
                      {proFeatures.map((featKey) => {
                        const meta = featureMetadata?.[featKey];
                        const enabled = isFeatureEnabled(key, featKey);
                        return (
                          <li key={featKey} className={`flex items-start gap-3 text-sm ${enabled ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                            {enabled ? (
                              <span className={`flex-shrink-0 mt-0.5 ${info.color}`}>
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="flex-shrink-0 mt-0.5 text-slate-300 dark:text-slate-600">
                                <X className="h-4 w-4" />
                              </span>
                            )}
                            <span className="flex items-center gap-2">
                              {meta?.icon && <span className="text-xs">{meta.icon}</span>}
                              <span>{meta?.label_short ?? featKey}</span>
                            </span>
                          </li>
                        );
                      })}

                      {/* Separator for premium features */}
                      {key !== "basic" && premiumFeatures.length > 0 && (
                        <li className="pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Premium
                          </p>
                        </li>
                      )}

                      {/* Premium features section */}
                      {premiumFeatures.map((featKey) => {
                        const meta = featureMetadata?.[featKey];
                        const enabled = isFeatureEnabled(key, featKey);
                        return (
                          <li key={featKey} className={`flex items-start gap-3 text-sm ${enabled ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
                            {enabled ? (
                              <span className={`flex-shrink-0 mt-0.5 ${info.color}`}>
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <span className="flex-shrink-0 mt-0.5 text-slate-300 dark:text-slate-600">
                                <X className="h-4 w-4" />
                              </span>
                            )}
                            <span className="flex items-center gap-2">
                              {meta?.icon && <span className="text-xs">{meta.icon}</span>}
                              <span>{meta?.label_short ?? featKey}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className={`mt-12 text-center transition-all duration-500 delay-700 ease-out ${mounted ? "opacity-100" : "opacity-0"}`}>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {billingInterval === "termly"
              ? "Termly billing aligns with your school calendar. Pay once per term — no charges during holidays."
              : "All plans include core school management features."}
            Prices are in Nigerian Naira (₦).
            <br />
            Need help choosing?{" "}
            <button className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
              Contact support
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Wrap in Suspense for useSearchParams ─────────────────────────────────

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<SubscriptionSkeleton />}>
      <SubscriptionPageContent />
    </Suspense>
  );
}
