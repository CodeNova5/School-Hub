"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Gift,
  Info,
  TrendingUp,
  FileText,
  Layers,
  ChevronRight,
  Building2,
  Timer,
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

interface ActiveGrant {
  id: string;
  school_id: string;
  school_name: string;
  plan_key: string;
  grant_type: "term" | "session" | "custom";
  start_date: string;
  end_date: string;
  include_holidays: boolean;
  notes: string;
  granted_by_name: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  term_name: string | null;
  session_name: string | null;
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
  active_grants: ActiveGrant[] | null;
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

function formatShortDate(iso: string | null | undefined): string {
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

function getIntervalLabel(billingInterval: string | undefined, activeGrants?: ActiveGrant[] | null): string {
  // If there are active grants, show grant type instead
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

function getIntervalIcon(billingInterval: string | undefined, activeGrants?: ActiveGrant[] | null) {
  // If there are active grants, use grant type icon
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

// ── Skeleton ──────────────────────────────────────────────────────────────

function SubscriptionPageSkeleton() {
  return (
    <DashboardLayout role="admin">
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
    </DashboardLayout>
  );
}

// ── Stat Card Component ───────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: React.ReactNode; color?: string }) {
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

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AdminSubscriptionPage() {
  const router = useRouter();
  const { getPlanInfo } = usePlanDisplayInfo();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [holidayDismissed, setHolidayDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

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

  const {
    subscription,
    school,
    plans,
    transactions,
    status,
    current_term,
    yearly_covered_terms,
    upcoming_terms,
    terms_by_session,
    active_grants,
  } = data ?? {};

  const currentPlanKey = subscription?.plan_key || school?.plan || "basic";
  const currentPlanInfo = getPlanInfo(currentPlanKey);
  const PlanIcon = getPlanIcon(currentPlanKey);
  const isGrantBased = active_grants && active_grants.length > 0;
  const currentGrant = isGrantBased ? active_grants![0] : null;

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

  // ── Tab configurations ──
  const tabs = [
    { id: "overview", label: "Overview", icon: Info },
    { id: "terms", label: "Terms", icon: BookOpen },
    { id: "billing", label: "Billing", icon: Receipt },
  ];

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-slate-600" />
              Subscription
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage your school plan, view terms, and billing history
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/subscription")}
            >
              <CreditCard className="h-4 w-4 mr-1.5" />
              Upgrade Plan
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/admin")}
            >
              <ExternalLink className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>

        {/* ── Alerts ── */}
        {isGraceActive && subscription?.grace_period_ends_at && (
          <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm">
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
          <Card className="border-red-200 bg-gradient-to-r from-red-50 to-rose-50 shadow-sm">
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
          <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 shadow-sm">
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
                  <button
                    onClick={() => setHolidayDismissed(true)}
                    className="flex-shrink-0 p-1 rounded-md text-teal-400 hover:text-teal-600 hover:bg-teal-100 transition-colors"
                    aria-label="Dismiss banner"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

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
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-1.5 text-sm data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:shadow-none rounded-md px-4 py-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: OVERVIEW */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-6 mt-0">
            {/* Current Plan Card */}
            <Card className="shadow-sm border-gray-200 overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-blue-50/50 pb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ring-1 ring-black/5 ${getPlanIconBg(currentPlanKey)}`}>
                      <PlanIcon className={`h-6 w-6 ${getPlanColor(currentPlanKey)}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{currentPlanInfo?.label_short || currentPlanKey}</CardTitle>
                        {isGrantBased && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
                            <Gift className="h-3 w-3 mr-1" />
                            Granted
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{subscription?.plan_name || school?.name || "School"}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(effectiveStatus)}
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  {/* Status */}
                  <StatCard
                    icon={CheckCircle2}
                    label="Status"
                    value={
                      <span className="capitalize">{effectiveStatus === "past_due" ? "Past Due (Grace Period)" : effectiveStatus}</span>
                    }
                    color="bg-emerald-100"
                  />
                  {/* Billing Interval */}
                  <StatCard
                    icon={getIntervalIcon(subscription?.billing_interval, active_grants)}
                    label="Billing Interval"
                    value={
                      <span className="flex items-center gap-1.5">
                        {getIntervalLabel(subscription?.billing_interval, active_grants)}
                      </span>
                    }
                    color="bg-blue-100"
                  />
                  {/* Next Billing */}
                  <StatCard
                    icon={Calendar}
                    label="Next Billing"
                    value={formatShortDate(subscription?.next_billing_date)}
                    color="bg-indigo-100"
                  />
                  {/* Current Term */}
                  <StatCard
                    icon={GraduationCap}
                    label="Current Term"
                    value={current_term ? `${current_term.name} · ${current_term.session_name}` : "—"}
                    color="bg-amber-100"
                  />
                </div>

                {/* Price & Period Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Price</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {isGrantBased ? (
                        <span className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-amber-500" />
                          <span>Granted</span>
                        </span>
                      ) : subscription?.billing_interval === "termly" ? (
                        <>
                          {formatPrice(subscription.termly_price)}
                          <span className="text-sm font-normal text-gray-500">/term</span>
                        </>
                      ) : (
                        <>
                          {formatPrice(subscription?.yearly_price || 0)}
                          <span className="text-sm font-normal text-gray-500">/yr</span>
                        </>
                      )}
                    </p>
                    {isGrantBased && currentGrant && (
                      <>
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(currentGrant.start_date)} — {formatDate(currentGrant.end_date)}
                        </p>
                        {currentGrant.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{currentGrant.notes}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Billing Period</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatDate(subscription?.current_period_start)} — {formatDate(subscription?.current_period_end)}
                    </p>
                    {current_term && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {current_term.name} · {current_term.session_name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatShortDate(current_term.start_date)} — {formatShortDate(current_term.end_date)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Covered Terms (Yearly) */}
                {yearly_covered_terms && yearly_covered_terms.length > 0 && (
                  <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Covered Terms</span>
                      <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-100/50 ml-auto text-[10px]">
                        {yearly_covered_terms.length} terms
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {yearly_covered_terms.map((ct, idx) => (
                        <div key={ct.id} className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            idx === yearly_covered_terms.length - 1
                              ? "bg-blue-200 text-blue-700 ring-2 ring-blue-300"
                              : "bg-blue-100 text-blue-500"
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {ct.name}
                              <span className="text-xs font-normal text-gray-500 ml-1">· {ct.session_name}</span>
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0">
                            {formatShortDate(ct.start_date)} – {formatShortDate(ct.end_date)}
                          </span>
                          <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
                            {ct.weeks}wk
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-blue-500 mt-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next renewal: {formatDate(subscription?.next_billing_date)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column — Quick Actions + Status + Upgrades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push("/subscription")}
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade Plan
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => window.print()}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Invoice
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                  {isGrantBased && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 mt-2">
                      <div className="flex items-start gap-2">
                        <Gift className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Grant Active</p>
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            Access granted by {currentGrant?.granted_by_name || "Super Admin"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status Card */}
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-500" />
                    Subscription Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    {getStatusBadge(effectiveStatus)}
                  </div>
                  {subscription?.next_billing_date && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Next Charge</span>
                      <span className="text-sm font-medium">{formatShortDate(subscription.next_billing_date)}</span>
                    </div>
                  )}
                  {isGraceActive && subscription?.grace_period_ends_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Grace Ends</span>
                      <span className="text-sm font-medium text-amber-600">
                        {formatShortDate(subscription.grace_period_ends_at)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Interval</span>
                    <span className="text-sm font-medium capitalize">
                      {getIntervalLabel(subscription?.billing_interval, active_grants)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Available Upgrades */}
              {availablePlans.length > 0 && (
                <Card className="shadow-sm border-gray-200">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      Available Upgrades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2">
                    {availablePlans.map((plan) => {
                      const info = getPlanInfo(plan.plan_key);
                      const price = subscription?.billing_interval === "termly"
                        ? plan.termly_price
                        : plan.yearly_price;
                      return (
                        <div
                          key={plan.id}
                          className="p-3 rounded-lg border hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
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
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: TERMS */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="terms" className="space-y-6 mt-0">
            {/* Terms Overview */}
            {terms_by_session && terms_by_session.length > 0 ? (
              <div className="space-y-6">
                {terms_by_session.map((group) => {
                  const paidCount = group.terms.filter((t) => t.status === "paid").length;
                  const totalCount = group.terms.length;
                  const allPaid = paidCount === totalCount;
                  const nonePaid = paidCount === 0;

                  return (
                    <Card key={group.session_name} className="shadow-sm border-gray-200">
                      <CardHeader className="border-b pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GraduationCap className={`h-5 w-5 ${allPaid ? "text-emerald-600" : nonePaid ? "text-slate-400" : "text-amber-500"}`} />
                            <CardTitle className="text-base">{group.session_name} Session</CardTitle>
                          </div>
                          <Badge variant="outline" className={`${
                            allPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            nonePaid ? "bg-slate-50 text-slate-500 border-slate-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {allPaid ? "All Paid" : nonePaid ? "Not Paid" : `${paidCount}/${totalCount} Paid`}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {formatShortDate(group.terms[0].start_date)} — {formatShortDate(group.terms[group.terms.length - 1].end_date)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 space-y-2">
                        {group.terms.map((term) => (
                          <div
                            key={term.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                              term.status === "paid"
                                ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/50"
                                : term.status === "past"
                                  ? "bg-slate-50 border-slate-200 hover:bg-slate-100/50"
                                  : "bg-white border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {/* Status dot */}
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              term.status === "paid" ? "bg-emerald-500" :
                              term.status === "past" ? "bg-slate-400" :
                              "bg-amber-400"
                            }`} />

                            {/* Term info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${
                                  term.status === "paid" ? "text-emerald-900" :
                                  term.status === "past" ? "text-slate-500" :
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
                                term.status === "paid"
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                  : term.status === "past"
                                    ? "bg-slate-100 text-slate-500 border-slate-200"
                                    : "bg-amber-100 text-amber-700 border-amber-200"
                              }`}>
                                {term.status === "paid" ? <><CheckCircle2 className="h-2.5 w-2.5" /> Paid</>
                                  : term.status === "past" ? "Past"
                                  : "Unpaid"}
                              </span>

                              {/* Pay button */}
                              {term.status === "unpaid" && subscription?.termly_price && subscription.termly_price > 0 && !isGrantBased && (
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

                              {/* Pay button for grant-based (show but disabled with info) */}
                              {term.status === "unpaid" && isGrantBased && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                                  <Gift className="h-2.5 w-2.5 mr-1" />
                                  Covered by Grant
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
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
          </TabsContent>

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: BILLING */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <TabsContent value="billing" className="space-y-6 mt-0">
            {/* Subscription Timeline */}
            {upcoming_terms && upcoming_terms.length > 0 && (
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b pb-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-emerald-600" />
                      Subscription Timeline
                    </CardTitle>
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                      {upcoming_terms.length} upcoming
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
                    {yearly_covered_terms ? (
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
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  idx === yearly_covered_terms.length - 1
                                    ? "bg-blue-100 text-blue-700 border-blue-200"
                                    : "bg-emerald-100 text-emerald-700 border-emerald-200"
                                }`}>
                                  {idx === yearly_covered_terms.length - 1 ? (
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
                          {idx === yearly_covered_terms.length - 1 && (
                            <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Currently in session — renewal: {formatDate(subscription?.next_billing_date)}
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
                              {formatShortDate(current_term.start_date)} – {formatShortDate(current_term.end_date)}
                            </p>
                          </div>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200">
                            <Clock className="h-2.5 w-2.5" />
                            {current_term.weeks}wk
                          </span>
                        </div>
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
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
