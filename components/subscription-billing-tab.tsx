"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Receipt,
  ArrowRight,
  Gift,
  BookOpen,
} from "lucide-react";
import {
  formatPrice,
  formatDate,
  formatShortDate,
  formatDateTime,
  getTransactionBadge,
  TermProgressBar,
} from "./subscription-utils";
import type {
  Subscription,
  Plan,
  Transaction,
  CurrentTermInfo,
  UpcomingTerm,
  YearlyCoveredTerm,
} from "./subscription-types";

interface BillingTabProps {
  subscription: Subscription | null | undefined;
  plans: Plan[] | undefined;
  transactions: Transaction[] | undefined;
  currentTerm: CurrentTermInfo | null | undefined;
  upcomingTerms: UpcomingTerm[] | null | undefined;
  yearlyCoveredTerms: YearlyCoveredTerm[] | null | undefined;
  isGrantBased: boolean;
  currentPlanKey: string;
}

export function SubscriptionBillingTab({
  subscription,
  plans,
  transactions,
  currentTerm,
  upcomingTerms,
  yearlyCoveredTerms,
  isGrantBased,
  currentPlanKey,
}: BillingTabProps) {
  const router = useRouter();

  return (
    <div className="space-y-6 mt-0">
      {/* Subscription Timeline */}
      {upcomingTerms && upcomingTerms.length > 0 && (
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b pb-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-600" />
                Subscription Timeline
              </CardTitle>
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                {upcomingTerms.length} upcoming
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {subscription?.billing_interval === "yearly" || isGrantBased
                ? "Your subscription covers consecutive terms. Pre-pay for upcoming terms in advance."
                : "Your current subscription covers one term at a time. Pre-pay for upcoming terms in advance."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-0">
              {/* ── Paid terms ── */}
              {yearlyCoveredTerms ? (
                /* Yearly: show all 3 covered terms as paid */
                yearlyCoveredTerms.map((ct, idx) => (
                  <div key={ct.id} className="relative pb-6 pl-8 border-l-2 border-emerald-300 last:border-l-2">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{ct.name}</p>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{ct.session_name}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            idx === yearlyCoveredTerms.length - 1
                              ? "bg-blue-100 text-blue-700 border-blue-200"
                              : "bg-emerald-100 text-emerald-700 border-emerald-200"
                          }`}>
                            {idx === yearlyCoveredTerms.length - 1 ? (
                              <><Calendar className="h-2.5 w-2.5" /> Current</>
                            ) : (
                              <><CheckCircle2 className="h-2.5 w-2.5" /> Paid</>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatShortDate(ct.start_date)} – {formatShortDate(ct.end_date)}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                        <Clock className="h-2.5 w-2.5" />
                        {ct.weeks}wk
                      </span>
                    </div>
                    <TermProgressBar startDate={ct.start_date} endDate={ct.end_date} />
                    {idx === yearlyCoveredTerms.length - 1 && (
                      <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Currently in session — renewal: {formatDate(subscription?.next_billing_date)}
                      </p>
                    )}
                  </div>
                ))
              ) : currentTerm ? (
                /* Termly: show single covered term as paid */
                <div className="relative pb-6 pl-8 border-l-2 border-emerald-300 last:border-l-2">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{currentTerm.name}</p>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{currentTerm.session_name}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Paid
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatShortDate(currentTerm.start_date)} – {formatShortDate(currentTerm.end_date)}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                      <Clock className="h-2.5 w-2.5" />
                      {currentTerm.weeks}wk
                    </span>
                  </div>
                  <TermProgressBar startDate={currentTerm.start_date} endDate={currentTerm.end_date} />
                  <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    Paid — covered by current subscription
                  </p>
                </div>
              ) : null}

              {/* ── Upcoming terms (pay in advance) ── */}
              {upcomingTerms.map((term, idx) => {
                const daysUntilStart = Math.ceil(
                  (new Date(term.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isYearly = subscription?.billing_interval === "yearly" || isGrantBased;
                const batchIndex = Math.floor(idx / 3);
                const inBatch = idx % 3;
                const isFirstInBatch = inBatch === 0;
                return (
                  <div key={term.id} className={`relative pb-6 pl-8 border-l-2 border-slate-200 last:border-l-2 last:pb-0 ${isFirstInBatch && isYearly && batchIndex > 0 ? "mt-4 pt-2" : ""}`}>
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{term.name}</p>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">{term.session_name}</span>
                          {isYearly ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Term {inBatch + 1} of 3
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                              Starts in {daysUntilStart}d
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatShortDate(term.start_date)} – {formatShortDate(term.end_date)}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {term.weeks}wk
                      </span>
                    </div>
                    {/* Show a pay button for the first term in each batch */}
                    {isFirstInBatch && isYearly && !isGrantBased ? (
                      <div className="mt-3 p-3 rounded-lg border border-dashed border-purple-200 bg-purple-50">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-purple-800">
                              Academic Year {batchIndex + 1}
                            </p>
                            <p className="text-[10px] text-purple-600 mt-0.5">
                              Covers 3 terms — same plan, renewed annually
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm shrink-0"
                            onClick={() =>
                              router.push(
                                `/checkout?plan=${currentPlanKey}&interval=yearly&termId=${term.id}`
                              )
                            }
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                            Pre-pay Year {batchIndex + 1} — {formatPrice(subscription?.yearly_price || 0)}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ) : !isYearly && !isGrantBased ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                          onClick={() =>
                            router.push(
                              `/checkout?plan=${currentPlanKey}&interval=termly&termId=${term.id}`
                            )
                          }
                        >
                          <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                          Pay in Advance — {formatPrice(subscription?.termly_price || 0)}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    ) : isGrantBased ? (
                      <div className="mt-2">
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Gift className="h-3 w-3 mr-1" />
                          Covered by active grant
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing History */}
      <Card className="shadow-sm border-gray-200">
        <CardHeader className="border-b pb-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-600" />
              Billing History
            </CardTitle>
            {transactions && transactions.length > 0 && (
              <Badge variant="secondary">{transactions.length} transactions</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!transactions || transactions.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No billing history yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Transactions will appear here once you make a payment
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Reference</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Plan</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const plan = plans?.find((p) => p.id === tx.plan_id);
                    return (
                      <TableRow key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(tx.created_at)}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                            {tx.reference}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {plan?.name || "Unknown"}
                          <span className="text-xs text-gray-400 ml-1">
                            ({tx.billing_interval})
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(tx.amount)}
                        </TableCell>
                        <TableCell>{getTransactionBadge(tx.status)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
