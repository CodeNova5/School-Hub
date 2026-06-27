"use client";

import { useEffect, useState } from "react";
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
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  School,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Sparkles,
  CreditCard,
  RefreshCw,
  Banknote,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────

interface AnalyticsData {
  overview: {
    totalSchools: number;
    activeSchools: number;
    schoolsWithSubscriptions: number;
    planDistribution: Record<string, number>;
    statusBreakdown: Record<string, number>;
  };
  revenue: {
    mrr: number;
    projectedAnnual: number;
    totalRevenue: number;
    mrrByPlan: Record<string, number>;
  };
  trends: Array<{
    month: string;
    total: number;
    success: number;
    failed: number;
    revenue: number;
  }>;
  recentTransactions: Array<{
    id: string;
    school_name: string;
    school_id: string;
    amount: number;
    status: string;
    reference: string;
    created_at: string;
    paid_at: string | null;
  }>;
  atRiskSchools: {
    pastDue: Array<{ id: string; name: string; plan: string }>;
    count: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatPrice(cents: number): string {
  if (cents <= 0) return "₦0";
  return `₦${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPriceShort(cents: number): string {
  if (cents <= 0) return "₦0";
  const thousands = cents / 100 / 1000;
  if (thousands >= 1000) return `₦${(thousands / 1000).toFixed(1)}M`;
  if (thousands >= 1) return `₦${thousands.toFixed(1)}K`;
  return `₦${Math.round(cents / 100)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "success":
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Success</Badge>;
    case "pending":
      return <Badge variant="warning" className="gap-1"><RefreshCw className="h-3 w-3" /> Pending</Badge>;
    case "failed":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getPlanIcon(planKey: string) {
  switch (planKey) {
    case "basic": return Shield;
    case "pro": return Zap;
    case "premium": return Sparkles;
    default: return Shield;
  }
}

function getPlanColor(planKey: string): string {
  switch (planKey) {
    case "basic": return "text-slate-500";
    case "pro": return "text-blue-600";
    case "premium": return "text-purple-600";
    default: return "text-slate-500";
  }
}

function getPlanBg(planKey: string): string {
  switch (planKey) {
    case "basic": return "bg-slate-100";
    case "pro": return "bg-blue-100";
    case "premium": return "bg-purple-100";
    default: return "bg-slate-100";
  }
}

const PLAN_ORDER = ["premium", "pro", "basic"];
const PLAN_COLORS = ["#8B5CF6", "#3B82F6", "#94A3B8"];
const STATUS_COLORS: Record<string, string> = {
  active: "#10B981",
  past_due: "#F59E0B",
  expired: "#EF4444",
  none: "#94A3B8",
};

// ── Consts for chart ──────────────────────────────────────────────────────

const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];

// ── Skeleton ──────────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="pt-6 space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-28" /></CardContent></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function SuperAdminAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueView, setRevenueView] = useState<"mrr" | "total">("mrr");

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/super-admin/analytics/subscriptions");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load analytics");
      }
      const json: AnalyticsData = await res.json();
      setData(json);
    } catch (err: any) {
      console.error("Analytics error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load analytics</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchAnalytics}>Try Again</Button>
        </div>
      </div>
    );
  }

  const { overview, revenue, trends, recentTransactions, atRiskSchools } = data!;

  // Build plan distribution for chart
  const planChartData = PLAN_ORDER
    .filter((key) => (overview.planDistribution[key] || 0) > 0)
    .map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: overview.planDistribution[key] || 0,
      fill: PLAN_COLORS[PLAN_ORDER.indexOf(key)],
    }));

  // Status breakdown chart
  const statusChartData = Object.entries(overview.statusBreakdown)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      name: key.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value: count,
      fill: STATUS_COLORS[key] || "#94A3B8",
    }));

  // MRR by plan chart
  const mrrChartData = Object.entries(revenue.mrrByPlan)
    .filter(([, val]) => val > 0)
    .map(([key, val]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: Math.round(val / 100), // Convert to full Naira
      fill: PLAN_COLORS[PLAN_ORDER.indexOf(key)],
    }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Platform-wide subscription metrics, revenue, and trends
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => router.push("/super-admin/schools")}>
            <School className="h-4 w-4 mr-2" />
            Manage Schools
          </Button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Schools</p>
                <p className="text-3xl font-bold mt-1">{overview.totalSchools}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <School className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{overview.activeSchools} active</span>
              <span>·</span>
              <span>{overview.schoolsWithSubscriptions} with subscriptions</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {revenueView === "mrr" ? "Monthly Recurring Revenue (MRR)" : "Total Revenue"}
                </p>
                <p className="text-3xl font-bold mt-1">
                  {revenueView === "mrr" ? formatPriceShort(revenue.mrr * 100) : formatPriceShort(revenue.totalRevenue * 100)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-50">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <button
                onClick={() => setRevenueView("mrr")}
                className={`${revenueView === "mrr" ? "text-green-600 font-semibold" : ""}`}
              >
                MRR
              </button>
              <span>·</span>
              <button
                onClick={() => setRevenueView("total")}
                className={`${revenueView === "total" ? "text-green-600 font-semibold" : ""}`}
              >
                Total
              </button>
              <span>·</span>
              <span>Proj. annual: {formatPriceShort(revenue.projectedAnnual * 100)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">At-Risk Schools</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{atRiskSchools.count}</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Past due — grace period active
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Transactions</p>
                <p className="text-3xl font-bold mt-1">{recentTransactions.length}+</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Recent payment activity
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-blue-600" />
              Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={planChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip
                    formatter={(value: number) => [value, "Schools"]}
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                    {planChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {PLAN_ORDER.filter((k) => (overview.planDistribution[k] || 0) > 0).map((key) => {
                const Icon = getPlanIcon(key);
                const count = overview.planDistribution[key] || 0;
                const pct = overview.totalSchools > 0 ? Math.round((count / overview.totalSchools) * 100) : 0;
                return (
                  <div key={key} className="text-center p-2 rounded-lg bg-muted/30">
                    <Icon className={`h-4 w-4 mx-auto mb-1 ${getPlanColor(key)}`} />
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status Distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-green-600" />
              Subscription Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [value, "Schools"]}
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={36}>
                    {statusChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(overview.statusBreakdown)
                .filter(([, count]) => count > 0)
                .map(([key, count]) => (
                  <Badge key={key} variant="outline" className="gap-1 text-xs">
                    <span
                      className="h-2 w-2 rounded-full inline-block"
                      style={{ backgroundColor: STATUS_COLORS[key] || "#94A3B8" }}
                    />
                    {key.replace("_", " ")}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MRR by Plan + Revenue Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR by Plan */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-600" />
              MRR by Plan
            </CardTitle>
            <CardDescription>Monthly recurring revenue breakdown by plan tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-56">
              {mrrChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mrrChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}K`} />
                    <YAxis dataKey="name" type="category" width={80} />
                    <Tooltip
                      formatter={(value: number) => [formatPriceShort(value * 100), "MRR"]}
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
                      {mrrChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Banknote className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No subscription revenue yet</p>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {Object.entries(revenue.mrrByPlan)
                .filter(([, val]) => val > 0)
                .map(([key, val]) => (
                  <div key={key} className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground capitalize">{key}</p>
                    <p className="text-sm font-bold">{formatPriceShort(val * 100)}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Transaction Trend */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Monthly Payment Trends
            </CardTitle>
            <CardDescription>Successful vs failed payments over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-56">
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Legend />
                    <Bar dataKey="success" name="Successful" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="failed" name="Failed" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No transaction data yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Schools + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-Risk Schools */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b bg-gradient-to-r from-amber-50 to-yellow-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                At-Risk Schools
              </CardTitle>
              <Badge variant="warning">
                {atRiskSchools.count} past due
              </Badge>
            </div>
            <CardDescription>Schools with expired grace periods or past-due payments</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {atRiskSchools.pastDue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium">No schools at risk</p>
                <p className="text-xs">All subscriptions are in good standing</p>
              </div>
            ) : (
              <div className="divide-y">
                {atRiskSchools.pastDue.slice(0, 10).map((school) => (
                  <div key={school.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{school.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{school.plan} plan</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/super-admin/schools")}
                    >
                      <Zap className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4 border-b bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                Recent Transactions
              </CardTitle>
              <Badge variant="secondary">{recentTransactions.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>School</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm max-w-[160px] truncate">{tx.school_name}</TableCell>
                        <TableCell className="font-medium">{formatPrice(tx.amount * 100)}</TableCell>
                        <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {tx.reference === "Manual" ? "Manual" : "Auto"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      {trends.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly subscription revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value: number) => [`₦${value.toLocaleString()}`, "Revenue"]}
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    fill="url(#revenueGradient)"
                    strokeWidth={3}
                    dot={{ fill: "#10B981", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground pb-4">
        Data is updated in real-time. MRR is calculated from active subscriptions.
      </div>
    </div>
  );
}
