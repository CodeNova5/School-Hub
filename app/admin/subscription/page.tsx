"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  AlertTriangle,
  AlertCircle,
  Zap,
  Sparkles,
  CreditCard,
  Calendar,
  Clock,
  ArrowRight,
  Download,
  RefreshCw,
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Receipt,
  GraduationCap,
  BookOpen,
  Umbrella,
} from "lucide-react";
import { usePlanDisplayInfo } from "@/hooks/use-plan-display-info";

// ── Types ─────────────────────────────────────────────────────────────────

interface Subscription {
  id: string;
  school_id: string;
  plan_id: string;
  billing_interval: "termly" | "yearly";
  status: "active" | "past_due" | "cancelled" | "expired" | "trialing";
  current_period_start: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  grace_period_ends_at: string | null;
  auth_code: string | null;
  customer_email: string | null;
  customer_code: string | null;
  current_term_id: string | null;
  plan_key: string;
  plan_name: string;
  monthly_price: number;
  yearly_price: number;
  termly_price: number;
}

interface School {
  plan: string;
  name: string;
}

interface Plan {
  id: string;
  plan_key: string;
  name: string;
  description: string;
  termly_price: number;
  yearly_price: number;
  monthly_price: number;
  features: any[];
}

interface Transaction {
  id: string;
  school_id: string;
  plan_id: string;
  billing_interval: string;
  reference: string;
  amount: number;
  status: "pending" | "success" | "failed" | "abandoned";
  auth_code: string | null;
  paid_at: string | null;
  metadata: any;
  created_at: string;
}

interface StatusResult {
  status: string;
  should_degrade: boolean;
  degrade_reason: string;
  grace_period_ends_at: string | null;
}

interface NextTermInfo {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

interface CurrentTermInfo {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  weeks: number;
  next_term?: NextTermInfo | null;
}

interface YearlyCoveredTerm {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

interface UpcomingTerm {
  id: string;
  name: string;
  session_name: string;
  start_date: string;
  end_date: string;
  weeks: number;
}

interface TermWithStatus extends UpcomingTerm {
  is_current: boolean;
  status: "paid" | "past" | "unpaid";
}

interface TermsBySessionGroup {
  session_name: string; 
  terms: TermWithStatus[];
}

interface ApiResponse {
  subscription: Subscription | null;
  school: School | null;
  plans: Plan[];
  transactions: Transaction[];
  status: StatusResult | null;
  current_term: CurrentTermInfo | null;
  yearly_covered_terms: YearlyCoveredTerm[] | null;
  upcoming_terms: UpcomingTerm[] | null;
  terms_by_session: TermsBySessionGroup[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(iso: string | null | undefined): string {
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

function formatDateTime(iso: string | null | undefined): string {
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

function getStatusBadge(status: string) {
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

function getTransactionBadge(status: string) {
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

function getPlanIcon(planKey: string) {
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

function getPlanIconBg(planKey: string): string {
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

function getPlanColor(planKey: string): string {
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

// ── Term Progress Bar ─────────────────────────────────────────────────────

function TermProgressBar({ startDate, endDate }: { startDate: string; endDate: string }) {
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
          {isPast ? 'Completed' : isFuture ? 'Not started' : `${pct}% complete`}
        </span>
        {!isPast && !isFuture && remainingDays > 0 && (
          <span className="text-[10px] text-gray-400">{remainingDays}d remaining</span>
        )}
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isPast ? 'bg-emerald-400' : pct > 75 ? 'bg-emerald-500' : pct > 50 ? 'bg-blue-500' : pct > 25 ? 'bg-blue-400' : 'bg-blue-300'
          }`}
          style={{ width: isPast ? '100%' : isFuture ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────

function SubscriptionPageSkeleton() {
  return (
    <DashboardLayout role="admin">
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdminSubscriptionPage() {
  const router = useRouter();
  const { getPlanInfo } = usePlanDisplayInfo();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holidayDismissed, setHolidayDismissed] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/subscription");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load subscription data");
      }
      const json: ApiResponse = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Failed to fetch subscription data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <SubscriptionPageSkeleton />;

  if (error) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Failed to load subscription
            </h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchData}>Try Again</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const { subscription, school, plans, transactions, status, current_term, yearly_covered_terms, upcoming_terms, terms_by_session } = data ?? {};
  const currentPlanKey = subscription?.plan_key || school?.plan || "basic";
  const currentPlanInfo = getPlanInfo(currentPlanKey);
  const PlanIcon = getPlanIcon(currentPlanKey);

  // Determine the effective status for display
  const effectiveStatus = status?.status || subscription?.status || "active";
  const isGraceActive = effectiveStatus === "past_due" && !status?.should_degrade;
  const isGraceExpired = effectiveStatus === "past_due" && status?.should_degrade;

  // Detect holiday break (termly + active + current term ended + next term exists)
  const now = new Date();
  const isHolidayBreak =
    subscription?.billing_interval === "termly" &&
    effectiveStatus === "active" &&
    current_term?.end_date &&
    new Date(current_term.end_date) < now &&
    current_term?.next_term != null;

  // Check if any upgrades are available
  const availablePlans = plans?.filter(
    (p) => p.plan_key !== "basic" && p.plan_key !== currentPlanKey
  ) ?? [];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>
            <p className="text-gray-600 mt-1">
              Manage your plan and view billing history
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push("/subscription")}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/admin")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* Grace Period Alert */}
        {isGraceActive && subscription?.grace_period_ends_at && (
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardContent className="p-4 flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-amber-900 text-sm">Payment Past Due</p>
                <p className="text-sm text-amber-700 mt-1">
                  Your subscription payment is overdue. All features are still available during the
                  grace period, which ends{" "}
                  <span className="font-semibold">{formatDate(subscription.grace_period_ends_at)}</span>.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-amber-600 hover:bg-amber-700"
                  onClick={() => router.push("/subscription")}
                >
                  <CreditCard className="h-4 w-4 mr-1.5" />
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isGraceExpired && (
          <Card className="border-red-200 bg-gradient-to-r from-red-50 to-rose-50">
            <CardContent className="p-4 flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-red-900 text-sm">Grace Period Expired</p>
                <p className="text-sm text-red-700 mt-1">
                  {status?.degrade_reason || "Your grace period has ended. Paid features have been locked."}
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-red-600 hover:bg-red-700"
                  onClick={() => router.push("/subscription")}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Renew Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Holiday Break Banner */}
        {isHolidayBreak && !holidayDismissed && current_term?.next_term && (
          <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Umbrella className="h-5 w-5 text-teal-600" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-teal-900 text-sm">On Holiday Break</p>
                    <p className="text-sm text-teal-700 mt-1">
                      <span className="font-semibold">{current_term.name} · {current_term.session_name}</span>{" "}
                      has ended. Your school is currently on break — all features remain available.
                    </p>
                  </div>
                  {/* Dismiss */}
                  <button
                    onClick={() => setHolidayDismissed(true)}
                    className="flex-shrink-0 p-1 rounded-md text-teal-400 hover:text-teal-600 hover:bg-teal-100 transition-colors"
                    aria-label="Dismiss banner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Next term info */}
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="h-4 w-4 text-teal-500" />
                    <span className="text-teal-800">
                      <span className="font-semibold">{current_term.next_term.name}</span>
                      <span className="text-teal-500 ml-1">· {current_term.next_term.session_name}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-teal-500" />
                    <span className="text-teal-800">
                      Starts {new Date(current_term.next_term.start_date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-teal-500" />
                    <span className="text-teal-800">{current_term.next_term.weeks} weeks</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                    onClick={() =>
                      router.push(
                        `/checkout?plan=${currentPlanKey}&interval=termly&termId=${current_term.next_term!.id}`
                      )
                    }
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" />
                    Pay for {current_term.next_term.name}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-teal-300 text-teal-800 hover:bg-teal-100"
                    onClick={() => router.push("/admin/subscription")}
                  >
                    <BookOpen className="h-4 w-4 mr-1.5" />
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Current Plan + Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Plan Card */}
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${getPlanIconBg(currentPlanKey)}`}>
                      <PlanIcon className={`h-6 w-6 ${getPlanColor(currentPlanKey)}`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{currentPlanInfo?.label_short || currentPlanKey}</CardTitle>
                      <CardDescription>{subscription?.plan_name || school?.name || "School"}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(effectiveStatus)}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Subscription Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Billing Interval */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Billing Interval</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">
                      {subscription?.billing_interval === "termly" ? (
                        <span className="flex items-center gap-1.5">
                          <GraduationCap className="h-4 w-4 text-blue-500" />
                          Per Term
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-green-500" />
                          Yearly
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Price</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {subscription?.billing_interval === "termly"
                        ? formatPrice(subscription.termly_price)
                        : formatPrice(subscription?.yearly_price || 0)}
                      <span className="text-sm font-normal text-gray-500">
                        /{subscription?.billing_interval === "termly" ? "term" : "yr"}
                      </span>
                    </p>
                  </div>

                  {/* Covered Terms — full-width card for both termly and yearly */}
                  {(subscription?.billing_interval === "termly" || yearly_covered_terms) && (
                    <div className={`sm:col-span-2 p-4 rounded-lg ${current_term || yearly_covered_terms ? "bg-blue-50 border border-blue-200" : "bg-gray-50"}`}>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5 text-blue-500" />
                          {yearly_covered_terms ? "Covered Terms (Yearly)" : "Covered Term"}
                        </span>
                      </p>

                      {/* Yearly: show all covered terms */}
                      {yearly_covered_terms && yearly_covered_terms.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {yearly_covered_terms.map((ct, idx) => (
                            <div key={ct.id} className="flex items-center gap-3 text-sm">
                              <div className={`
                                w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                                ${idx === yearly_covered_terms.length - 1
                                  ? "bg-blue-200 text-blue-700"
                                  : "bg-blue-100 text-blue-500"
                                }
                              `}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900">
                                  {ct.name}
                                  <span className="text-xs font-normal text-gray-500 ml-1">· {ct.session_name}</span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-500">
                                  {new Date(ct.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – {new Date(ct.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "2-digit" })}
                                </span>
                                <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                                  {ct.weeks}wk
                                </span>
                              </div>
                            </div>
                          ))}
                          <p className="text-[10px] text-blue-500 mt-1.5 pl-9">
                            Yearly billing covers 3 terms. Next renewal: {formatDate(subscription?.next_billing_date)}
                          </p>
                        </div>
                      ) : subscription?.billing_interval === "termly" && current_term ? (
                        /* Termly: show single term */
                        <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">
                              {current_term.name}
                              <span className="text-xs font-normal text-gray-500 ml-1.5">
                                · {current_term.session_name}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDate(current_term.start_date)} — {formatDate(current_term.end_date)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                              <Clock className="h-2.5 w-2.5" />
                              {current_term.weeks}wk
                            </span>
                            {current_term.is_current ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                                Current
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">Not yet assigned</p>
                      )}
                    </div>
                  )}

                  {/* Current Period */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Period</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatDate(subscription?.current_period_start)} — {formatDate(subscription?.current_period_end)}
                    </p>
                  </div>

                  {/* Next Billing */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Billing</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatDate(subscription?.next_billing_date)}
                    </p>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* ── Terms Overview Dashboard ── */}
            {terms_by_session && terms_by_session.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-indigo-50 pb-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                      Terms Overview
                    </CardTitle>
                    <Badge variant="outline" className="text-indigo-700 border-indigo-300 bg-indigo-50">
                      {terms_by_session.length} sessions
                    </Badge>
                  </div>
                  <CardDescription>
                    All academic terms grouped by session with payment status
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    {terms_by_session.map((group) => {
                      const paidCount = group.terms.filter((t) => t.status === "paid").length;
                      const totalCount = group.terms.length;
                      const allPaid = paidCount === totalCount;
                      const nonePaid = paidCount === 0;

                      return (
                        <div key={group.session_name}>
                          {/* Session header */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <GraduationCap className={`h-4 w-4 ${allPaid ? 'text-emerald-600' : nonePaid ? 'text-slate-400' : 'text-amber-500'}`} />
                              <h4 className="text-sm font-semibold text-gray-900">
                                {group.session_name} Session
                              </h4>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                allPaid ? 'bg-emerald-100 text-emerald-700' : nonePaid ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {allPaid ? 'All Paid' : nonePaid ? 'Not Paid' : `${paidCount}/${totalCount} Paid`}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {new Date(group.terms[0].start_date).toLocaleDateString("en-NG", { month: "short", year: "numeric" })} – {new Date(group.terms[group.terms.length - 1].end_date).toLocaleDateString("en-NG", { month: "short", year: "numeric" })}
                            </span>
                          </div>

                          {/* Term rows */}
                          <div className="space-y-1.5">
                            {group.terms.map((term) => (
                              <div
                                key={term.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                                  term.status === "paid"
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : term.status === "past"
                                      ? 'bg-slate-50 border-slate-200'
                                      : 'bg-white border-slate-200'
                                }`}
                              >
                                {/* Status indicator */}
                                <div className={`
                                  w-2 h-2 rounded-full shrink-0
                                  ${term.status === "paid" ? 'bg-emerald-500' : term.status === "past" ? 'bg-slate-400' : 'bg-amber-400'}
                                `} />

                                {/* Term name */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${
                                      term.status === "paid" ? 'text-emerald-900' : term.status === "past" ? 'text-slate-500' : 'text-slate-800'
                                    }`}>
                                      {term.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">·</span>
                                    <span className={`text-[10px] font-medium ${
                                      term.status === "paid" ? 'text-emerald-700' : term.status === "past" ? 'text-slate-400' : 'text-slate-500'
                                    }`}>
                                      {new Date(term.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – {new Date(term.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "2-digit" })}
                                    </span>
                                  </div>
                                </div>

                                {/* Duration + Status badge + Pay button */}
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                                    <Clock className="h-2.5 w-2.5" />
                                    {term.weeks}wk
                                  </span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                    term.status === "paid"
                                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                      : term.status === "past"
                                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                                        : 'bg-amber-100 text-amber-700 border-amber-200'
                                  }`}>
                                    {term.status === "paid" ? <><CheckCircle2 className="h-2.5 w-2.5" /> Paid</>
                                      : term.status === "past" ? 'Past'
                                      : 'Unpaid'}
                                  </span>
                                  {term.status === "unpaid" && subscription?.termly_price && subscription.termly_price > 0 && (
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
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Subscription Timeline (Pay in Advance) ── */}
            {upcoming_terms && upcoming_terms.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-emerald-50 pb-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                      Subscription Timeline
                    </CardTitle>
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                      {upcoming_terms.length} upcoming
                    </Badge>
                  </div>
                  <CardDescription>
                    {subscription?.billing_interval === "yearly"
                      ? "Your yearly subscription covers 3 consecutive terms. Pre-pay for the next academic year in advance."
                      : "Your current subscription covers one term at a time. Pre-pay for upcoming terms in advance."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-0">
                    {/* ── Paid terms ── */}
                    {subscription?.billing_interval === "yearly" && yearly_covered_terms ? (
                      /* Yearly: show all 3 covered terms as paid */
                      yearly_covered_terms.map((ct, idx) => (
                        <div key={ct.id} className="relative pb-6 pl-8 border-l-2 border-emerald-300 last:border-l-2">
                          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">{ct.name}</p>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500">{ct.session_name}</span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${idx === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : idx === yearly_covered_terms.length - 1 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                  {idx === yearly_covered_terms.length - 1 ? (
                                    <><Calendar className="h-2.5 w-2.5" /> Current</>
                                  ) : (
                                    <><CheckCircle2 className="h-2.5 w-2.5" /> Paid</>
                                  )}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(ct.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – {new Date(ct.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                              <Clock className="h-2.5 w-2.5" />
                              {ct.weeks}wk
                            </span>
                          </div>
                          {/* Progress bar for this term */}
                          <TermProgressBar startDate={ct.start_date} endDate={ct.end_date} />
                          {idx < yearly_covered_terms.length - 1 && (
                            <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                              <CreditCard className="h-3 w-3" />
                              Covered by yearly subscription
                            </p>
                          )}
                          {idx === yearly_covered_terms.length - 1 && (
                            <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Currently in session — {formatDate(subscription?.next_billing_date)} renewal
                            </p>
                          )}
                        </div>
                      ))
                    ) : current_term ? (
                      /* Termly: show single covered term as paid */
                      <div className="relative pb-6 pl-8 border-l-2 border-emerald-300 last:border-l-2">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{current_term.name}</p>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{current_term.session_name}</span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-2.5 w-2.5" />
                                Paid
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(current_term.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – {new Date(current_term.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                            <Clock className="h-2.5 w-2.5" />
                            {current_term.weeks}wk
                          </span>
                        </div>
                        {/* Progress bar */}
                        <TermProgressBar startDate={current_term.start_date} endDate={current_term.end_date} />
                        <p className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          Paid — covered by current subscription
                        </p>
                      </div>
                    ) : null}

                    {/* ── Upcoming terms (pay in advance) ── */}
                    {upcoming_terms.map((term, idx) => {
                      const daysUntilStart = Math.ceil(
                        (new Date(term.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      const isYearly = subscription?.billing_interval === "yearly";
                      // For yearly, group upcoming terms into batches of 3 (one academic year)
                      const batchIndex = Math.floor(idx / 3);
                      const inBatch = idx % 3;
                      const isFirstInBatch = inBatch === 0;
                      return (
                        <div key={term.id} className={`relative pb-6 pl-8 border-l-2 border-slate-200 last:border-l-2 last:pb-0 ${isFirstInBatch && isYearly && batchIndex > 0 ? 'mt-4 pt-2' : ''}`}>
                          <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white" />
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900">{term.name}</p>
                                <span className="text-xs text-gray-400">·</span>
                                <span className="text-xs text-gray-500">{term.session_name}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Term {inBatch + 1} of 3
                                </span>
                                {daysUntilStart > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                    Starts in {daysUntilStart}d
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(term.start_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })} – {new Date(term.end_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                              <Clock className="h-2.5 w-2.5" />
                              {term.weeks}wk
                            </span>
                          </div>
                          {/* Show a yearly batch header + pay button on the first term of each batch */}
                          {isFirstInBatch && isYearly ? (
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
                          ) : !isYearly ? (
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
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Billing History */}
            <Card className="shadow-lg">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-indigo-50 pb-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-indigo-600" />
                    Billing History
                  </CardTitle>
                  {transactions && transactions.length > 0 && (
                    <Badge variant="secondary">{transactions.length} transactions</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {!transactions || transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No billing history yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Transactions will appear here once you make a payment
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Plan</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((tx) => {
                          const plan = plans?.find((p) => p.id === tx.plan_id);
                          return (
                            <TableRow key={tx.id}>
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

          {/* Right Column — Quick Actions + Available Upgrades */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="shadow-lg">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => router.push("/subscription")}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Upgrade Plan
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => window.print()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>

            {/* Subscription Status Card */}
            <Card className="shadow-lg">
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">Subscription Status</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  {getStatusBadge(effectiveStatus)}
                </div>


                {subscription?.next_billing_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Next Charge</span>
                    <span className="text-sm font-medium">
                      {formatDate(subscription.next_billing_date)}
                    </span>
                  </div>
                )}

                {isGraceActive && subscription?.grace_period_ends_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Grace Ends</span>
                    <span className="text-sm font-medium text-amber-600">
                      {formatDate(subscription.grace_period_ends_at)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Upgrades */}
            {availablePlans.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base">Available Upgrades</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {availablePlans.map((plan) => {
                    const info = getPlanInfo(plan.plan_key);
                    const price = subscription?.billing_interval === "termly"
                      ? plan.termly_price
                      : plan.yearly_price;
                    return (
                      <div
                        key={plan.id}
                        className="p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/subscription?plan=${plan.plan_key}`)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold text-sm ${getPlanColor(plan.plan_key)}`}>
                            {info?.label_short || plan.name}
                          </span>
                          <span className="text-sm font-bold">
                            {formatPrice(price)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{plan.description}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
