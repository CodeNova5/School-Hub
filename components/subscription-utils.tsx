"use client";

import { useState } from "react";
import { usePlanDisplayInfo } from "@/hooks/use-plan-display-info";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Zap,
  Sparkles,
  Calendar,
  GraduationCap,
  Layers,
  Timer,
  Gift,
  Info,
  ChevronRight,
  ChevronDown,
  FileText,
  User,
  Umbrella,
  X,
} from "lucide-react";
import type { ActiveGrant, TermWithStatus, TermsBySessionGroup } from "./subscription-types";

// ── Price / Date Helpers ──────────────────────────────────────────────────

export function formatPrice(amount: number): string {
  if (amount === 0) return "Free";
  return `₦${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

// ── Badge Helpers ─────────────────────────────────────────────────────────

export function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Active</Badge>;
    case "past_due":
      return <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" /> Past Due</Badge>;
    case "expired":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
    case "cancelled":
      return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Cancelled</Badge>;
    case "trialing":
      return <Badge variant="info" className="gap-1"><Clock className="h-3 w-3" /> Trialing</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function getTransactionBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Success</Badge>;
    case "pending":
      return <Badge variant="warning" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    case "abandoned":
      return <Badge variant="secondary" className="gap-1">Abandoned</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── Plan Helpers ──────────────────────────────────────────────────────────

export function getPlanIcon(planKey: string) {
  switch (planKey) {
    case "basic":
      return Shield;
    case "pro":
      return Zap;
    case "premium":
      return Sparkles;
    default:
      return Shield;
  }
}

export function getPlanIconBg(planKey: string): string {
  switch (planKey) {
    case "basic":
      return "bg-slate-100 text-slate-600";
    case "pro":
      return "bg-blue-100 text-blue-600";
    case "premium":
      return "bg-purple-100 text-purple-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function getPlanColor(planKey: string): string {
  switch (planKey) {
    case "basic":
      return "text-slate-900";
    case "pro":
      return "text-blue-600";
    case "premium":
      return "text-purple-600";
    default:
      return "text-slate-900";
  }
}

export function getPlanBadgeColor(planKey: string): string {
  switch (planKey) {
    case "basic":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "pro":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "premium":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export function getIntervalLabel(billingInterval: string | undefined, activeGrants?: ActiveGrant[] | null): string {
  if (activeGrants && activeGrants.length > 0) {
    const grantTypes = activeGrants.map((g) => g.grant_type);
    if (grantTypes.includes("term")) return "Per Term";
    if (grantTypes.includes("session")) return "Per Session";
    return "Custom Period";
  }
  switch (billingInterval) {
    case "termly":
      return "Per Term";
    case "yearly":
      return "Yearly";
    default:
      return billingInterval ?? "—";
  }
}

export function getIntervalIcon(billingInterval: string | undefined, activeGrants?: ActiveGrant[] | null) {
  if (activeGrants && activeGrants.length > 0) {
    const grantTypes = activeGrants.map((g) => g.grant_type);
    if (grantTypes.includes("term")) return GraduationCap;
    if (grantTypes.includes("session")) return Layers;
    return Timer;
  }
  switch (billingInterval) {
    case "termly":
      return GraduationCap;
    case "yearly":
      return Calendar;
    default:
      return Clock;
  }
}

// ── Grant Coverage Helpers ────────────────────────────────────────────────

export function getTermGrantCoverage(term: TermWithStatus, activeGrants: ActiveGrant[]): ActiveGrant | undefined {
  const termStart = new Date(term.start_date).getTime();
  const termEnd = new Date(term.end_date).getTime();

  return activeGrants.find((grant) => {
    const grantStart = new Date(grant.start_date).getTime();
    const grantEnd = new Date(grant.end_date).getTime();

    switch (grant.grant_type) {
      case "term":
        return (
          grant.term_name === term.name &&
          termStart >= grantStart &&
          termEnd <= grantEnd
        );
      case "session":
        return (
          grant.session_name === term.session_name &&
          termStart >= grantStart &&
          termEnd <= grantEnd
        );
      case "custom":
        return termStart >= grantStart && termEnd <= grantEnd;
      default:
        return false;
    }
  });
}

export function getCoveredTermCount(grant: ActiveGrant, terms: TermsBySessionGroup[]): number {
  let count = 0;
  for (const group of terms) {
    for (const term of group.terms) {
      if (getTermGrantCoverage(term, [grant])) {
        count++;
      }
    }
  }
  return count;
}

// ── Stat Card Component ───────────────────────────────────────────────────

export function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className={`p-2.5 rounded-lg ${color || "bg-gray-100"}`}>
        <Icon className={`h-4 w-4 ${color ? "text-white" : "text-gray-600"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <div className="text-sm font-semibold text-gray-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ── Term Progress Bar ─────────────────────────────────────────────────────

export function TermProgressBar({ startDate, endDate }: { startDate: string; endDate: string }) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const now = Date.now();
  const total = end - start;
  const elapsed = now - start;
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 0;
  const remainingMs = end - now;
  const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const isPast = now > end;
  const isFuture = now < start;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-gray-500">
          {isPast ? "Completed" : isFuture ? "Not started" : `${pct}% complete`}
        </span>
        {!isPast && !isFuture && remainingDays > 0 && (
          <span className="text-[10px] text-gray-400">{remainingDays}d remaining</span>
        )}
      </div>
      <Progress
        value={isPast ? 100 : isFuture ? 0 : pct}
        className={`h-1.5 ${isPast ? "bg-emerald-100" : "bg-gray-200"}`}
      />
    </div>
  );
}

// ── Subscription Skeleton ─────────────────────────────────────────────────

export function SubscriptionPageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-10 w-80 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
            <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></CardContent></Card>
          </div>
          <div className="space-y-6">
            <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Grant Details Modal ────────────────────────────────────────────────────

export function GrantDetailsModal({ grant }: { grant: ActiveGrant }) {
  const { getPlanInfo } = usePlanDisplayInfo();
  const [open, setOpen] = useState(false);

  const planInfo = getPlanInfo(grant.plan_key);
  const PlanIcon = getPlanIcon(grant.plan_key);
  const daysLeft = grant.is_active
    ? Math.max(0, Math.ceil((new Date(grant.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isExpired = !grant.is_active || daysLeft === 0;
  const isExpiringSoon = grant.is_active && daysLeft > 0 && daysLeft <= 30;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Info className="h-4 w-4 mr-2" />
          View Grant Details
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-amber-500" />
            Grant Details
          </DialogTitle>
          <DialogDescription>
            Full details of the active plan grant for this school
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Plan & Status Header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${getPlanIconBg(grant.plan_key)}`}>
                <PlanIcon className={`h-5 w-5 ${getPlanColor(grant.plan_key)}`} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{planInfo?.label_short || grant.plan_key}</p>
                <p className="text-xs text-gray-500 capitalize flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {grant.grant_type} grant
                  {grant.term_name && <span className="text-gray-400">· {grant.term_name}</span>}
                  {grant.session_name && <span className="text-gray-400">· {grant.session_name}</span>}
                </p>
              </div>
            </div>
            <div>
              {isExpired ? (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200 gap-1">
                  <XCircle className="h-3 w-3" />
                  Expired
                </Badge>
              ) : isExpiringSoon ? (
                <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-100 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Expiring Soon
                </Badge>
              ) : (
                <Badge variant="default" className="bg-emerald-500 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Grant Type</p>
              <p className="text-sm font-semibold text-gray-900 capitalize flex items-center gap-1.5">
                {grant.grant_type === "term" ? (
                  <><GraduationCap className="h-4 w-4 text-blue-500" /> {grant.term_name || "Term"}</>
                ) : grant.grant_type === "session" ? (
                  <><Layers className="h-4 w-4 text-purple-500" /> {grant.session_name || "Session"}</>
                ) : (
                  <><Timer className="h-4 w-4 text-amber-500" /> Custom</>
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Status</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                {isExpired ? (
                  <><XCircle className="h-4 w-4 text-gray-400" /> Expired</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Active{daysLeft > 0 ? ` · ${daysLeft}d remaining` : ""}</>
                )}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Start Date</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-gray-400" />
                {formatDate(grant.start_date)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">End Date</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-gray-400" />
                {formatDate(grant.end_date)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Expires At</p>
              <p className="text-sm font-semibold text-gray-900">
                {formatDateTime(grant.expires_at)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Granted By</p>
              <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <User className="h-4 w-4 text-gray-400" />
                {grant.granted_by_name}
              </p>
            </div>
          </div>

          {/* Include Holidays */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2">
              <Umbrella className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-700">Include Holidays</span>
            </div>
            <span className={`text-sm font-semibold ${grant.include_holidays ? "text-emerald-600" : "text-gray-500"}`}>
              {grant.include_holidays ? "Yes" : "No"}
            </span>
          </div>

          {/* Notes */}
          {grant.notes && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-blue-800">{grant.notes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Created timestamp */}
          <p className="text-[10px] text-gray-400 text-center">
            Created {formatDateTime(grant.created_at)}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Grant Coverage Section ────────────────────────────────────────────────

export function GrantCoverageSection({ grants, termsBySession }: { grants: ActiveGrant[]; termsBySession: TermsBySessionGroup[] }) {
  const { getPlanInfo } = usePlanDisplayInfo();
  const [open, setOpen] = useState(false);
  const totalCoveredTerms = grants.reduce((sum, g) => sum + getCoveredTermCount(g, termsBySession), 0);

  if (totalCoveredTerms === 0) return null;

  return (
    <Card className="shadow-sm border-amber-200 overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/50 py-4 cursor-pointer hover:from-amber-100/50 hover:to-orange-100/30 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Gift className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Grant Coverage
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-semibold">
                      {grants.length} grant{grants.length > 1 ? "s" : ""}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Covers {totalCoveredTerms} term{totalCoveredTerms > 1 ? "s" : ""} across{" "}
                    {new Set(termsBySession.filter(g => g.terms.some(t => getTermGrantCoverage(t, grants))).map(g => g.session_name)).size} session{(new Set(termsBySession.filter(g => g.terms.some(t => getTermGrantCoverage(t, grants))).map(g => g.session_name))).size > 1 ? "s" : ""}
                  </CardDescription>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-amber-500 transition-transform duration-200 ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            {grants.map((grant) => {
              const planInfo = getPlanInfo(grant.plan_key);
              const coveredTerms: { group: TermsBySessionGroup; term: TermWithStatus }[] = [];
              for (const group of termsBySession) {
                for (const term of group.terms) {
                  if (getTermGrantCoverage(term, [grant])) {
                    coveredTerms.push({ group, term });
                  }
                }
              }

              if (coveredTerms.length === 0) return null;

              return (
                <div key={grant.id} className="p-3 rounded-lg bg-amber-50/50 border border-amber-200">
                  {/* Grant header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getPlanBadgeColor(grant.plan_key)}>
                        <Shield className="h-3 w-3 mr-1" />
                        {planInfo.label_short}
                      </Badge>
                      <span className="text-xs text-gray-600 capitalize">
                        {grant.grant_type === "term"
                          ? grant.term_name || "Term"
                          : grant.grant_type === "session"
                            ? grant.session_name || "Session"
                            : "Custom"} grant
                      </span>
                    </div>
                    <GrantDetailsModal grant={grant} />
                  </div>

                  {/* Covered terms list */}
                  <div className="space-y-1.5">
                    {coveredTerms.map(({ group, term }) => (
                      <div
                        key={term.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-white border border-amber-100"
                      >
                        <Gift className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{term.name}</span>
                          <span className="text-[10px] text-gray-400">·</span>
                          <span className="text-[10px] text-gray-500">{group.session_name}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatShortDate(term.start_date)} – {formatShortDate(term.end_date)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Covered
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Grant period summary */}
                  <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Grant period: {formatShortDate(grant.start_date)} — {formatShortDate(grant.end_date)}
                    {grant.granted_by_name && (
                      <>
                        <span className="text-gray-300 mx-1">·</span>
                        <User className="h-3 w-3" />
                        {grant.granted_by_name}
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
