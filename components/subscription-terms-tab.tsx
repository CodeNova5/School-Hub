"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  GraduationCap,
  BookOpen,
  Clock,
  CheckCircle2,
  Gift,
  CreditCard,
} from "lucide-react";
import {
  formatPrice,
  formatShortDate,
  getTermGrantCoverage,
  TermProgressBar,
  GrantCoverageSection,
} from "./subscription-utils";
import type {
  Subscription,
  TermsBySessionGroup,
  ActiveGrant,
} from "./subscription-types";

interface TermsTabProps {
  subscription: Subscription | null | undefined;
  termsBySession: TermsBySessionGroup[] | undefined;
  currentPlanKey: string;
  isGrantBased: boolean;
  activeGrants: ActiveGrant[] | null | undefined;
}

export function SubscriptionTermsTab({
  subscription,
  termsBySession,
  currentPlanKey,
  isGrantBased,
  activeGrants,
}: TermsTabProps) {
  const router = useRouter();

  return (
    <div className="space-y-6 mt-0">
      {/* Grant Coverage Section (collapsible) */}
      {isGrantBased && activeGrants && termsBySession && termsBySession.length > 0 && (
        <GrantCoverageSection grants={activeGrants} termsBySession={termsBySession} />
      )}

      {/* Terms Overview */}
      {termsBySession && termsBySession.length > 0 ? (
        <div className="space-y-6">
          {termsBySession.map((group) => {
            const activeGrantsList = activeGrants || [];
            const grantCoveredCount = group.terms.filter((t) => getTermGrantCoverage(t, activeGrantsList)).length;
            const paidCount = group.terms.filter((t) => t.status === "paid").length;
            const totalCount = group.terms.length;
            const allCovered = grantCoveredCount + paidCount === totalCount;
            const someCovered = grantCoveredCount > 0 || paidCount > 0;

            return (
              <Card key={group.session_name} className="shadow-sm border-gray-200">
                <CardHeader className="border-b pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GraduationCap className={`h-5 w-5 ${
                        allCovered ? "text-emerald-600" :
                        someCovered ? "text-amber-500" :
                        "text-slate-400"
                      }`} />
                      <CardTitle className="text-base">{group.session_name} Session</CardTitle>
                    </div>
                    <Badge variant="outline" className={`${
                      allCovered ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      someCovered ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-slate-50 text-slate-500 border-slate-200"
                    }`}>
                      {allCovered
                        ? "All Covered"
                        : someCovered
                          ? `${paidCount + grantCoveredCount}/${totalCount} Covered`
                          : "Not Covered"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {formatShortDate(group.terms[0].start_date)} — {formatShortDate(group.terms[group.terms.length - 1].end_date)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {group.terms.map((term) => {
                    const grantCover = getTermGrantCoverage(term, activeGrantsList);
                    const isGrantCovered = !!grantCover;
                    const displayStatus = term.status === "paid"
                      ? "paid"
                      : isGrantCovered
                        ? "grant_covered"
                        : term.status;

                    return (
                      <div
                        key={term.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          displayStatus === "paid"
                            ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50"
                            : displayStatus === "grant_covered"
                              ? "bg-amber-50/70 border-amber-200 hover:bg-amber-100/50"
                              : displayStatus === "past"
                                ? "bg-slate-50 border-slate-200 hover:bg-slate-100/50"
                                : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {/* Status dot */}
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          displayStatus === "paid" ? "bg-emerald-500" :
                          displayStatus === "grant_covered" ? "bg-amber-500" :
                          displayStatus === "past" ? "bg-slate-400" :
                          "bg-amber-400"
                        }`} />

                        {/* Term info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              displayStatus === "paid" ? "text-emerald-900" :
                              displayStatus === "grant_covered" ? "text-amber-900" :
                              displayStatus === "past" ? "text-slate-500" :
                              "text-slate-800"
                            }`}>
                              {term.name}
                            </span>
                            <span className="text-[10px] text-slate-400">·</span>
                            <span className="text-xs text-slate-500">
                              {formatShortDate(term.start_date)} — {formatShortDate(term.end_date)}
                            </span>
                          </div>
                          {term.is_current && (
                            <TermProgressBar startDate={term.start_date} endDate={term.end_date} />
                          )}
                        </div>

                        {/* Meta + Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                            <Clock className="h-2.5 w-2.5" />
                            {term.weeks}wk
                          </span>

                          {/* Status badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            displayStatus === "paid"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : displayStatus === "grant_covered"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : displayStatus === "past"
                                  ? "bg-slate-100 text-slate-500 border-slate-200"
                                  : "bg-amber-100 text-amber-700 border-amber-200"
                          }`}>
                            {displayStatus === "paid" ? <><CheckCircle2 className="h-2.5 w-2.5" /> Paid</>
                              : displayStatus === "grant_covered" ? <><Gift className="h-2.5 w-2.5" /> Granted</>
                              : displayStatus === "past" ? "Past"
                              : "Unpaid"}
                          </span>

                          {/* Pay button for unpaid (non-grant) terms */}
                          {displayStatus === "unpaid" && subscription?.termly_price && subscription.termly_price > 0 && !isGrantBased && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2.5 text-[11px]"
                              onClick={() =>
                                router.push(
                                  `/checkout?plan=${currentPlanKey}&interval=termly&termId=${term.id}`
                                )
                              }
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Pay {formatPrice(subscription.termly_price)}
                            </Button>
                          )}

                          {/* Grant source label for grant-covered terms */}
                          {displayStatus === "grant_covered" && grantCover && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 gap-1">
                              <Gift className="h-2.5 w-2.5" />
                              {grantCover.grant_type === "term"
                                ? grantCover.term_name || "Term grant"
                                : grantCover.grant_type === "session"
                                  ? `${grantCover.session_name || "Session"} grant`
                                  : "Custom grant"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="shadow-sm border-gray-200">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">No terms available</p>
            <p className="text-xs text-gray-400 mt-1">
              Terms will appear here once your academic calendar is set up
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
