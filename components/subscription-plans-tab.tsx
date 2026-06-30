"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePlanDisplayInfo, PLAN_KEYS_IN_ORDER } from "@/hooks/use-plan-display-info";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Shield,
  Zap,
  Sparkles,
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

  // ── Available terms (for termly billing) ──
  const [availableTerms, setAvailableTerms] = useState<AvailableTerm[]>([]);
  const [termsLoading, setTermsLoading] = useState(false);

  // ── Fetch available terms ──
  useEffect(() => {
    if (billingInterval !== "termly") {
      setAvailableTerms([]);
      setSelectedTermId(null);
      return;
    }
    setTermsLoading(true);
    fetch("/api/school/subscription/available-terms")
      .then((res) => res.json())
      .then((data) => {
        if (data.terms && data.terms.length > 0) {
          setAvailableTerms(data.terms);
          const currentOrFirst = data.terms.find((t: AvailableTerm) => t.is_current) || data.terms[0];
          setSelectedTermId(currentOrFirst.id);
        }
      })
      .catch((err) => console.error("Failed to load terms:", err))
      .finally(() => setTermsLoading(false));
  }, [billingInterval]);

  // ── Derived state ──
  const selectedPlanInfo = getPlanInfo(selectedPlanKey);
  const PlanIcon = getPlanIcon(selectedPlanKey);
  const price = billingInterval === "termly"
    ? (selectedPlanInfo.termly_price || selectedPlanInfo.monthly_price * 3)
    : selectedPlanInfo.yearly_price;
  const selectedTerm = availableTerms.find((t) => t.id === selectedTermId) || null;
  const isDifferentPlan = selectedPlanKey !== currentPlanKey;
  const hasUpgradedPlan = PLAN_KEYS_IN_ORDER.indexOf(selectedPlanKey as typeof PLAN_KEYS_IN_ORDER[number]) > PLAN_KEYS_IN_ORDER.indexOf(currentPlanKey as typeof PLAN_KEYS_IN_ORDER[number]);

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
  };

  // ── Handle proceed ──
  const handleProceed = useCallback(() => {
    const params = new URLSearchParams();
    params.set("plan", selectedPlanKey);
    params.set("interval", billingInterval);
    if (billingInterval === "termly" && selectedTermId) {
      params.set("termId", selectedTermId);
    }
    params.set("from", "/admin/subscription");
    router.push(`/checkout?${params.toString()}`);
  }, [selectedPlanKey, billingInterval, selectedTermId, router]);

  // ── Can proceed? ──
  const canProceed = selectedPlanKey && !(billingInterval === "termly" && !selectedTermId);

  return (
    <div className="space-y-6 mt-0">
      {/* ── Section: Choose Your Plan ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-slate-500" />
          <h2 className="text-base font-semibold text-gray-900">Choose Your Plan</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLAN_KEYS_IN_ORDER.map((key) => {
            const info = getPlanInfo(key);
            const isCurrent = key === currentPlanKey;
            const isSelected = key === selectedPlanKey;
            const Icon = getPlanIcon(key);
            const planPrice = billingInterval === "termly"
              ? (info.termly_price || info.monthly_price * 3)
              : info.yearly_price;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPlanKey(key)}
                className={`
                  relative text-left p-4 rounded-xl border-2 transition-all duration-200
                  ${isSelected
                    ? "border-blue-500 bg-blue-50/70 shadow-md shadow-blue-500/10"
                    : isCurrent
                      ? "border-emerald-200 bg-white hover:border-blue-300 hover:bg-blue-50/30"
                      : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
                  }
                `}
              >
                {/* Badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${getPlanIconBg(key)}`}>
                    <Icon className={`h-5 w-5 ${getPlanColor(key)}`} />
                  </div>
                  <div className="flex items-center gap-1">
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                        Current
                      </span>
                    )}
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
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
          })}
        </div>
      </div>

      {/* ── Section: Billing & Term Selection ── */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-indigo-500" />
            Billing &amp; Term Selection
          </CardTitle>
          <CardDescription className="text-xs">
            Choose how often you pay and which term(s) to cover
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {/* Billing Toggle */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Billing Interval</p>
            <div className="inline-flex items-center gap-2 p-1 rounded-lg bg-gray-100 border border-gray-200">
              <button
                onClick={() => setBillingInterval("termly")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-all ${
                  billingInterval === "termly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Per Term
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Recommended
                </span>
              </button>
              <button
                onClick={() => setBillingInterval("yearly")}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-all ${
                  billingInterval === "yearly"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Yearly
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Best value
                </span>
              </button>
            </div>
          </div>

          {/* Term Selector (termly only) */}
          {billingInterval === "termly" && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Term</p>
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
                            ? "border-blue-500 bg-blue-50 shadow-sm"
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
            </div>
          )}

          {/* Yearly note */}
          {billingInterval === "yearly" && (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-purple-800">Yearly Billing</p>
                  <p className="text-[10px] text-purple-600 mt-0.5">
                    Your yearly plan covers 3 consecutive terms (full academic year). 
                    You'll be billed once annually — no charges during holidays.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section: Payment Summary ── */}
      <Card className={`shadow-sm border-gray-200 overflow-hidden ${planColors.border}`}>
        <CardHeader className="border-b bg-gradient-to-r from-gray-50 to-white pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Payment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Summary rows */}
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
              <span>You're upgrading from <strong>{getPlanInfo(currentPlanKey).label_short}</strong> to <strong>{selectedPlanInfo.label_short}</strong>. The new plan will take effect immediately.</span>
            </div>
          )}

          {isDifferentPlan && !hasUpgradedPlan && selectedPlanKey !== currentPlanKey && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>You're switching from <strong>{getPlanInfo(currentPlanKey).label_short}</strong> to <strong>{selectedPlanInfo.label_short}</strong>.</span>
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
            Payments are processed securely via Paystack. You'll be redirected to complete payment.
          </p>
        </CardContent>
      </Card>

      {/* ── Terms by Session ── */}
      {termsBySession && termsBySession.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="h-4 w-4 text-slate-400" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Terms by Session</p>
          </div>

          {/* Grant Coverage */}
          {isGrantBased && activeGrants && termsBySession.length > 0 && (
            <GrantCoverageSection grants={activeGrants} termsBySession={termsBySession} />
          )}

          <div className="space-y-3">
            {termsBySession.map((group) => {
              const paidCount = group.terms.filter((t) => t.status === "paid").length;
              const totalCount = group.terms.length;

              return (
                <div
                  key={group.session_name}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                >
                  {/* Session Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-indigo-500" />
                      <div>
                        <span className="text-sm font-semibold text-gray-900">{group.session_name}</span>
                        <span className="text-xs text-gray-400 ml-2">Session</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-500">
                      {paidCount}/{totalCount} paid
                    </span>
                  </div>

                  {/* Terms List */}
                  <div className="divide-y divide-gray-50">
                    {group.terms.map((term) => {
                      const isPaid = term.status === "paid";
                      const isPast = term.status === "past";
                      const isUnpaid = term.status === "unpaid";

                      const statusColor = isPaid
                        ? "text-emerald-600 bg-emerald-50 border-emerald-200"
                        : isPast
                          ? "text-gray-400 bg-gray-50 border-gray-200"
                          : "text-amber-600 bg-amber-50 border-amber-200";

                      const statusLabel = isPaid ? "Paid" : isPast ? "Past" : "Unpaid";

                      return (
                        <div
                          key={term.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Status dot */}
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              isPaid ? "bg-emerald-500" : isPast ? "bg-gray-300" : "bg-amber-500"
                            }`} />
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-900">{term.name}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {term.weeks}wk
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Date range */}
                            <span className="text-[11px] text-gray-400 hidden sm:inline">
                              {new Date(term.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – {new Date(term.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                            </span>
                            {/* Status badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColor}`}>
                              {isPaid && <CheckCircle2 className="h-2.5 w-2.5" />}
                              {isUnpaid && <AlertCircle className="h-2.5 w-2.5" />}
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
