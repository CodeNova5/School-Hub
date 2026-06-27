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
  ShieldCheck,
  ShieldAlert,
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
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  Receipt,
  GraduationCap,
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

interface ApiResponse {
  subscription: Subscription | null;
  school: School | null;
  plans: Plan[];
  transactions: Transaction[];
  status: StatusResult | null;
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

  const { subscription, school, plans, transactions, status } = data ?? {};
  const currentPlanKey = subscription?.plan_key || school?.plan || "basic";
  const currentPlanInfo = getPlanInfo(currentPlanKey);
  const PlanIcon = getPlanIcon(currentPlanKey);

  // Determine the effective status for display
  const effectiveStatus = status?.status || subscription?.status || "active";
  const isGraceActive = effectiveStatus === "past_due" && !status?.should_degrade;
  const isGraceExpired = effectiveStatus === "past_due" && status?.should_degrade;

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
              Manage your plan, view billing history, and update payment methods
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

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Current Period</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatDate(subscription?.current_period_start)} — {formatDate(subscription?.current_period_end)}
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Next Billing</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {formatDate(subscription?.next_billing_date)}
                    </p>
                  </div>
                </div>

                {/* Stored Payment Method */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Payment Method</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {subscription?.auth_code
                          ? `Stored card on file (${subscription.customer_email || "email on file"})`
                          : "No saved payment method"}
                      </p>
                    </div>
                    {!subscription?.auth_code && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/subscription")}
                      >
                        <CreditCard className="h-4 w-4 mr-1.5" />
                        Add Payment Method
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  onClick={() => router.push("/checkout")}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Payment Method
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

                {subscription?.auth_code && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Auto-Renew</span>
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Enabled
                    </Badge>
                  </div>
                )}

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
