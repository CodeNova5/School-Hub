"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  Check,
  AlertCircle,
  Clock,
  Calendar,
  GraduationCap,
  CreditCard,
  ChevronRight,
  BookOpen,
  Gift,
  Info,
  CheckCircle2,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  formatPrice,
  getPlanIcon,
  getPlanIconBg,
  getPlanColor,
  GrantCoverageSection,
} from "./subscription-utils";
import type {
  Subscription,
  Plan,
  CurrentTermInfo,
  TermsBySessionGroup,
  ActiveGrant,
} from "./subscription-types";

// ── Types ─────────────────────────────────────────────────────────────────

interface AvailableTerm {
  id: string;
  name: string;
  session_name: string;
  session_id: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  weeks: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

// ── Props ─────────────────────────────────────────────────────────────────

interface PlansTabProps {
  subscription: Subscription | null | undefined;
  plans: Plan[] | undefined;
  currentPlanKey: string;
  isGrantBased: boolean;
  activeGrants: ActiveGrant[] | null | undefined;
  currentTerm: CurrentTermInfo | null | undefined;
  termsBySession: TermsBySessionGroup[] | undefined;
}

// ── Plan Card ─────────────────────────────────────────────────────────────

function PlanCard({
  planKey,
  currentPlanKey,
  selectedPlanKey,
  billingInterval,
  onSelect,
}: {
  planKey: string;
  currentPlanKey: string;
  selectedPlanKey: string;
  billingInterval: "termly" | "yearly";
  onSelect: (key: string) => void;
}) {
  const { getPlanInfo } = usePlanDisplayInfo();
  const info = getPlanInfo(planKey);
  const isCurrent = planKey === currentPlanKey;
  const isSelected = planKey === selectedPlanKey;
  const Icon = getPlanIcon(planKey);
  const planPrice = billingInterval === "termly"
    ? (info.termly_price || info.monthly_price * 3)
    : info.yearly_price;

  return (
    <button
      type="button"
      onClick={() => onSelect(planKey)}
      className={`
        relative text-left p-4 rounded-xl border-2 transition-all duration-200
        ${isSelected
          ? "border-blue-500 bg-blue-50/70 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/20"
          : isCurrent
            ? "border-emerald-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
            : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
        }
      `}
    >
      {/* Badges */}
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${getPlanIconBg(planKey)}`}>
          <Icon className={`h-5 w-5 ${getPlanColor(planKey)}`} />
        </div>
        <div className="flex items-center gap-1">
          {isCurrent && (
            <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
              Current
            </span>
          )}
          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm shadow-blue-500/30">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold text-sm text-gray-900">{info.label_short}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{info.description}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        {planPrice === 0 ? (
          <span className="text-lg font-bold text-gray-900">Free</span>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-gray-900">{formatPrice(planPrice)}</span>
            <span className="text-xs text-gray-400">/{billingInterval === "termly" ? "term" : "yr"}</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function SubscriptionPlansTab({
  subscription,
  plans,
  currentPlanKey,
  isGrantBased,
  activeGrants,
  currentTerm,
  termsBySession,
}: PlansTabProps) {
  const router = useRouter();
  const { getPlanInfo, isLoading: plansLoading } = usePlanDisplayInfo();

  // ── Selection State ──
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(currentPlanKey);
  const [billingInterval, setBillingInterval] = useState<"termly" | "yearly">(
    subscription?.billing_interval === "yearly" ? "yearly" : "termly"
  );
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // ── Available terms ──
  const [availableTerms, setAvailableTerms] = useState<AvailableTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);

  // Always fetch terms (needed for both termly selector and yearly well)
  useEffect(() => {
    setTermsLoading(true);
    fetch("/api/school/subscription/available-terms")
      .then((res) => res.json())
      .then((data) => {
        if (data.terms && data.terms.length > 0) {
          setAvailableTerms(data.terms);
          // Only auto-select if termly and no selection yet
          if (billingInterval === "termly" && !selectedTermId) {
            const currentOrFirst = data.terms.find((t: AvailableTerm) => t.is_current) || data.terms[0];
            setSelectedTermId(currentOrFirst.id);
          }
        }
      })
      .catch((err) => console.error("Failed to load terms:", err))
      .finally(() => setTermsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset term selection when switching to yearly
  useEffect(() => {
    if (billingInterval === "yearly") {
      setSelectedTermId(null);
    } else if (availableTerms.length > 0 && !selectedTermId) {
      const currentOrFirst = availableTerms.find((t) => t.is_current) || availableTerms[0];
      setSelectedTermId(currentOrFirst.id);
    }
  }, [billingInterval, availableTerms, selectedTermId]);

  // ── Derived state ──
  const selectedPlanInfo = getPlanInfo(selectedPlanKey);
  const PlanIcon = getPlanIcon(selectedPlanKey);
  const price = billingInterval === "termly"
    ? (selectedPlanInfo.termly_price || selectedPlanInfo.monthly_price * 3)
    : selectedPlanInfo.yearly_price;
  const selectedTerm = availableTerms.find((t) => t.id === selectedTermId) || null;
  const isDifferentPlan = selectedPlanKey !== currentPlanKey;
  const hasUpgradedPlan = PLAN_KEYS_IN_ORDER.indexOf(selectedPlanKey as typeof PLAN_KEYS_IN_ORDER[number]) > PLAN_KEYS_IN_ORDER.indexOf(currentPlanKey as typeof PLAN_KEYS_IN_ORDER[number]);

  // Yearly coverage: show 3 terms (current + next 2 upcoming)
  const yearlyTerms = availableTerms.slice(0, 3);

  // Savings calculation
  const termlyPrice = selectedPlanInfo.termly_price || selectedPlanInfo.monthly_price * 3;
  const yearlySavings = termlyPrice * 3 - selectedPlanInfo.yearly_price;
  const savingsPercent = yearlySavings > 0
    ? Math.round((yearlySavings / (termlyPrice * 3)) * 100)
    : 0;

  const planColors = {
    iconBg: selectedPlanKey === "basic" ? "bg-slate-100 text-slate-600"
      : selectedPlanKey === "pro" ? "bg-blue-100 text-blue-600"
      : "bg-purple-100 text-purple-600",
    color: selectedPlanKey === "basic" ? "text-slate-900"
      : selectedPlanKey === "pro" ? "text-blue-600"
      : "text-purple-600",
    border: selectedPlanKey === "basic" ? "border-slate-200 dark:border-slate-700"
      : selectedPlanKey === "pro" ? "border-blue-200 dark:border-blue-800"
      : "border-purple-200 dark:border-purple-800",
    buttonBg: selectedPlanKey === "basic"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : selectedPlanKey === "pro"
        ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        : "bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700",
    shadow: selectedPlanKey === "pro" ? "shadow-blue-500/20" : selectedPlanKey === "premium" ? "shadow-purple-500/20" : "",
    accent: selectedPlanKey === "basic" ? "text-slate-600" : selectedPlanKey === "pro" ? "text-blue-600" : "text-purple-600",
  };

  // ── Handle proceed ──
  const handleProceed = useCallback(() => {
    const params = new URLSearchParams();
    params.set("plan", selectedPlanKey);
    params.set("interval", billingInterval);
    if (billingInterval === "termly" && selectedTermId) {
      params.set("termId", selectedTermId);
    } else if (billingInterval === "yearly") {
      // Pass all 3 terms for yearly coverage
      const yearlyTermIds = availableTerms.slice(0, 3).map((t) => t.id).join(",");
      if (yearlyTermIds) params.set("termIds", yearlyTermIds);
    }
    params.set("from", "/admin/subscription");
    router.push(`/checkout?${params.toString()}`);
  }, [selectedPlanKey, billingInterval, selectedTermId, availableTerms, router]);

  // ── Can proceed? ──
  const canProceed = selectedPlanKey && !(billingInterval === "termly" && !selectedTermId);

  return (
    <div className="space-y-8 mt-0">
      {/* ═══════════════════════════════════════════════════════════
          SECTION: Billing Interval (prominent, at top)
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-indigo-500" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing Interval</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="inline-flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200">
            <button
              onClick={() => setBillingInterval("termly")}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                ${billingInterval === "termly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              <GraduationCap className="h-4 w-4" />
              Per Term
            </button>
            <button
              onClick={() => setBillingInterval("yearly")}
              className={`
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all
                ${billingInterval === "yearly"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
                }
              `}
            >
              <Calendar className="h-4 w-4" />
              Yearly
            </button>
          </div>

          {billingInterval === "yearly" && savingsPercent > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">
                Save {savingsPercent}% with yearly billing
              </span>
            </div>
          )}

          {billingInterval === "termly" && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Info className="h-3.5 w-3.5" />
              Pay as you go — one term at a time
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION: Choose Your Plan
         ═══════════════════════════════════════════════════════════ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-slate-500" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">Choose Your Plan</h2>
            <p className="text-xs text-gray-400">Pick the plan that fits your school&apos;s needs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLAN_KEYS_IN_ORDER.map((key) => (
            <PlanCard
              key={key}
              planKey={key}
              currentPlanKey={currentPlanKey}
              selectedPlanKey={selectedPlanKey}
              billingInterval={billingInterval}
              onSelect={setSelectedPlanKey}
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION: Coverage Detail
         ═══════════════════════════════════════════════════════════ */}
      {billingInterval === "termly" ? (
        /* ── Termly: Term Selector ── */
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-500" />
              Select Term to Pay
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {termsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : availableTerms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-center">
                <BookOpen className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                <p className="text-xs font-medium text-amber-800">No upcoming terms available</p>
                <p className="text-[10px] text-amber-600 mt-0.5">Set up your academic calendar first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableTerms.map((term) => {
                  const isSelected = selectedTermId === term.id;
                  const isCurrent = term.is_current;
                  const daysUntilStart = Math.ceil(
                    (new Date(term.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => setSelectedTermId(term.id)}
                      className={`
                        w-full text-left rounded-lg border-2 p-3.5 transition-all duration-200
                        ${isSelected
                          ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/20"
                          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{term.name}</span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-500">{term.session_name} Session</span>
                            {isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Current
                              </span>
                            )}
                            {daysUntilStart > 0 && !isCurrent && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                Starts in {daysUntilStart}d
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDateRange(term.start_date, term.end_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                            <Clock className="h-2.5 w-2.5" />
                            {term.weeks}wk
                          </span>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
                          }`}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── Yearly: Coverage Well ── */
        <Card className="shadow-sm border-gray-200 overflow-hidden">
          <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white pb-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600" />
              Yearly Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {termsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : yearlyTerms.length === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4 text-center">
                <BookOpen className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                <p className="text-xs font-medium text-amber-800">No terms available</p>
                <p className="text-[10px] text-amber-600 mt-0.5">Set up your academic calendar to see yearly coverage.</p>
              </div>
            ) : (
              <div>
                {/* Introductory text */}
                <p className="text-xs text-gray-500 mb-4">
                  Your yearly plan covers <strong className="text-gray-800">3 consecutive terms</strong> — a full academic year.
                  You&apos;ll be billed once annually with no charges during breaks.
                </p>

                {/* Term cards with connector */}
                <div className="relative">
                  {/* Vertical connector line (desktop: horizontal) */}
                  <div className="hidden sm:block absolute top-1/2 left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] h-0.5 bg-gradient-to-r from-blue-200 via-indigo-300 to-purple-200 -translate-y-1/2 rounded-full" />
                  <div className="sm:hidden absolute top-[calc(16.67%+12px)] bottom-[calc(16.67%+12px)] left-6 w-0.5 bg-gradient-to-b from-blue-200 via-indigo-300 to-purple-200 rounded-full" />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {yearlyTerms.map((term, index) => {
                      const isCurrent = term.is_current;

                      return (
                        <div
                          key={term.id}
                          className="relative bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                        >
                          {/* Step number */}
                          <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm z-10">
                            {index + 1}
                          </div>

                          <div className="pt-1">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{term.name}</p>
                                <p className="text-[10px] text-gray-400">{term.session_name} Session</p>
                              </div>
                              {isCurrent && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                  <Zap className="h-2 w-2" />
                                  Now
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-2">
                              <Calendar className="h-3 w-3" />
                              <span>{formatShortDate(term.start_date)} – {formatShortDate(term.end_date)}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                <Clock className="h-2.5 w-2.5" />
                                {term.weeks} weeks
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <Check className="h-2.5 w-2.5" />
                                Covered
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Savings summary */}
                {savingsPercent > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200">
                    <div className="flex items-center gap-2 text-xs text-emerald-800">
                      <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        <strong>Save {formatPrice(yearlySavings)} ({savingsPercent}%)</strong> compared to paying per term.
                        That&apos;s like getting {yearlyTerms.length > 0 ? `${Math.round(yearlySavings / termlyPrice * 10) / 10} ` : ""}terms free!
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION: Payment Summary + CTA
         ═══════════════════════════════════════════════════════════ */}
      <Card className={`shadow-sm border-gray-200 overflow-hidden ${planColors.border}`}>
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <Shield className="h-4 w-4 text-gray-400" />
                Plan
              </span>
              <span className="font-semibold text-gray-900 flex items-center gap-1.5">
                {getPlanIconBg(selectedPlanKey) && (
                  <span className={`p-1 rounded ${getPlanIconBg(selectedPlanKey)}`}>
                    <PlanIcon className="h-3.5 w-3.5" />
                  </span>
                )}
                {selectedPlanInfo.label_short}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4 text-gray-400" />
                Billing
              </span>
              <span className="font-medium text-gray-900 capitalize">
                {billingInterval === "termly" ? "Per Term" : "Yearly"}
              </span>
            </div>
            {billingInterval === "termly" && selectedTerm && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <GraduationCap className="h-4 w-4 text-gray-400" />
                  Term
                </span>
                <span className="text-right">
                  <span className="font-medium text-gray-900">{selectedTerm.name}</span>
                  <span className="text-xs text-gray-400 ml-1">· {selectedTerm.session_name}</span>
                </span>
              </div>
            )}
            {billingInterval === "yearly" && yearlyTerms.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  Terms covered
                </span>
                <span className="font-medium text-gray-900 text-right">
                  {yearlyTerms.map((t) => t.name).join(", ")}
                </span>
              </div>
            )}

            {/* Pricing breakdown for yearly */}
            {billingInterval === "yearly" && yearlySavings > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Per term price (×3)</span>
                  <span>{formatPrice(termlyPrice * 3)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-600">
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Yearly discount
                  </span>
                  <span>-{formatPrice(yearlySavings)}</span>
                </div>
                <div className="border-t border-gray-200 pt-1.5 flex items-center justify-between font-semibold text-gray-900">
                  <span>Yearly total</span>
                  <span>{formatPrice(selectedPlanInfo.yearly_price)}</span>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total Due Today</span>
              <span className="text-xl font-bold text-gray-900">
                {isGrantBased ? (
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <Gift className="h-4 w-4" />
                    Granted
                  </span>
                ) : (
                  formatPrice(price)
                )}
              </span>
            </div>
          </div>

          {/* Info notices */}
          {isGrantBased && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Your school has an active grant. You can still select and review plan options here.</span>
            </div>
          )}

          {isDifferentPlan && hasUpgradedPlan && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>You&apos;re upgrading from <strong>{getPlanInfo(currentPlanKey).label_short}</strong> to <strong>{selectedPlanInfo.label_short}</strong>. The new plan will take effect immediately.</span>
            </div>
          )}

          {isDifferentPlan && !hasUpgradedPlan && selectedPlanKey !== currentPlanKey && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>You&apos;re switching from <strong>{getPlanInfo(currentPlanKey).label_short}</strong> to <strong>{selectedPlanInfo.label_short}</strong>.</span>
            </div>
          )}

          {/* CTA */}
          <Button
            onClick={handleProceed}
            disabled={!canProceed}
            className={`w-full text-white shadow-lg ${planColors.buttonBg} ${planColors.shadow} hover:scale-[1.02] active:scale-[0.98] transition-all`}
            size="lg"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            {isGrantBased ? "View Payment Options" : "Proceed to Payment"}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>

          <p className="text-[10px] text-center text-gray-400">
            Payments are processed securely via Paystack. You&apos;ll be redirected to complete payment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
