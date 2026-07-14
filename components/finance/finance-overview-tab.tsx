"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  Users,
  Banknote,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinanceOverview, MonthlyTrendItem } from "./finance-types";

interface OverviewTabProps {
  overview: FinanceOverview | null;
  formatMoney: (value: number) => string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  accent,
  trend,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  accent: string;
  trend?: "up" | "down";
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group cursor-default">
      <div className={`h-1 w-full ${accent}`} />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${color} bg-opacity-10 transition-all duration-200 group-hover:scale-110`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {value}
          {TrendIcon && (
            <TrendIcon className={`h-4 w-4 ${trend === "up" ? "text-emerald-500" : "text-red-500"}`} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusIcon(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-amber-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

/* ── Revenue Trend Chart ───────────────────────────── */

type PeriodMode = "monthly" | "quarterly" | "yearly";

function aggregateByPeriod(
  data: MonthlyTrendItem[],
  mode: PeriodMode
): { label: string; collected: number; transactions: number }[] {
  if (mode === "monthly") return data;

  if (mode === "quarterly") {
    const quarters: { label: string; collected: number; transactions: number }[] = [];
    for (let i = 0; i < data.length; i += 3) {
      const chunk = data.slice(i, i + 3);
      if (chunk.length === 0) continue;
      const firstDate = chunk[0].month;
      const year = firstDate.split("-")[0];
      const monthNum = parseInt(firstDate.split("-")[1]);
      const q = Math.ceil(monthNum / 3);
      quarters.push({
        label: `Q${q} ${year}`,
        collected: chunk.reduce((s, d) => s + d.collected, 0),
        transactions: chunk.reduce((s, d) => s + d.transactions, 0),
      });
    }
    return quarters;
  }

  // yearly
  const years = new Map<string, { collected: number; transactions: number }>();
  data.forEach((d) => {
    const year = d.month.split("-")[0];
    const existing = years.get(year);
    if (existing) {
      existing.collected += d.collected;
      existing.transactions += d.transactions;
    } else {
      years.set(year, { collected: d.collected, transactions: d.transactions });
    }
  });
  return Array.from(years.entries()).map(([year, val]) => ({
    label: year,
    collected: Math.round(val.collected * 100) / 100,
    transactions: val.transactions,
  }));
}

function RevenueTrendChart({
  monthlyTrend,
  formatMoney,
}: {
  monthlyTrend: MonthlyTrendItem[];
  formatMoney: (v: number) => string;
}) {
  const [period, setPeriod] = useState<PeriodMode>("monthly");

  const chartData = useMemo(() => aggregateByPeriod(monthlyTrend, period), [monthlyTrend, period]);

  const maxValue = Math.max(...chartData.map((d) => d.collected), 1);

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/40 to-blue-50/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-sm text-gray-700 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
            </div>
            Revenue Trend
          </CardTitle>
          <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(["monthly", "quarterly", "yearly"] as PeriodMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setPeriod(mode)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-150 capitalize ${
                  period === mode
                    ? "bg-white text-indigo-700 shadow-sm border border-indigo-100"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        {chartData.length > 0 ? (
          <div className="space-y-1">
            {/* Legend */}
            <div className="flex items-center gap-4 mb-2 text-[11px] text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                <span>Collected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-200" />
                <span>Transactions</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                barCategoryGap={period === "yearly" ? "30%" : "20%"}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => {
                    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                    return `${v}`;
                  }}
                  width={45}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99, 102, 241, 0.06)" }}
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "10px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                    padding: "10px 14px",
                  }}
                  labelStyle={{ fontWeight: 600, color: "#1f2937", marginBottom: 4 }}
                  formatter={(value: number, name: string) => {
                    if (name === "collected") return [formatMoney(value), "Collected"];
                    return [value, "Transactions"];
                  }}
                />
                <Bar
                  dataKey="collected"
                  fill="#6366f1"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  animationBegin={0}
                  animationDuration={800}
                />
                <Bar
                  dataKey="transactions"
                  fill="#c7d2fe"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  animationBegin={200}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>

            {/* Summary footer */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-50 mt-1">
              <span>
                Total collected:{" "}
                <span className="font-semibold text-gray-700">
                  {formatMoney(chartData.reduce((s, d) => s + d.collected, 0))}
                </span>
              </span>
              <span>
                Total transactions:{" "}
                <span className="font-semibold text-gray-700">
                  {chartData.reduce((s, d) => s + d.transactions, 0)}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <div className="h-[280px] flex flex-col items-center justify-center text-gray-400">
            <BarChart3 className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm">No revenue data yet</p>
            <p className="text-xs text-gray-300 mt-1">
              Collections will appear here once payments are recorded
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main Component ─────────────────────────────────── */

export function FinanceOverviewTab({ overview, formatMoney }: OverviewTabProps) {
  const stats = overview?.stats;
  const collectionRate = stats && stats.totalDue > 0
    ? Math.round((stats.totalCollected / stats.totalDue) * 100)
    : 0;

  const monthlyTrend = overview?.monthlyTrend || [];

  return (
    <div className="space-y-6 mt-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Banknote}
          label="Total Due"
          value={formatMoney(stats?.totalDue || 0)}
          color="text-blue-600"
          accent="bg-blue-500"
        />
        <StatCard
          icon={Wallet}
          label="Collected"
          value={formatMoney(stats?.totalCollected || 0)}
          color="text-emerald-600"
          accent="bg-emerald-500"
          trend="up"
        />
        <StatCard
          icon={Landmark}
          label="Outstanding"
          value={formatMoney(stats?.totalOutstanding || 0)}
          color="text-amber-600"
          accent="bg-amber-500"
          trend="down"
        />
        <StatCard
          icon={Receipt}
          label="Overdue Bills"
          value={stats?.overdueCount || 0}
          color="text-red-600"
          accent="bg-red-500"
        />
      </div>

      {/* Revenue Trend Chart */}
      {monthlyTrend.length > 0 && (
        <RevenueTrendChart monthlyTrend={monthlyTrend} formatMoney={formatMoney} />
      )}

      {/* Collection Rate + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-1 overflow-hidden transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              Collection Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-gray-900">{collectionRate}%</span>
              <span className="text-xs text-gray-400">
                ({stats?.paidCount || 0} of {stats?.totalBills || 0} bills paid)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  collectionRate >= 80
                    ? "bg-emerald-500"
                    : collectionRate >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>Partial: {stats?.partialCount || 0}</span>
              <span>Overdue: {stats?.overdueCount || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2 overflow-hidden transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-indigo-500" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(overview?.recentTransactions || []).slice(0, 6).length > 0 ? (
              <div className="divide-y divide-gray-50">
                {(overview?.recentTransactions || []).slice(0, 6).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-5 py-3 transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {getStatusIcon(tx.status)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {tx.students?.first_name} {tx.students?.last_name}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{tx.reference}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatMoney(tx.amount)}</p>
                      <Badge
                        variant={tx.status === "success" ? "secondary" : "outline"}
                        className={`text-[10px] ${
                          tx.status === "success"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : tx.status === "failed"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <Wallet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No transactions yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding by Class */}
        <Card className="lg:col-span-1 overflow-hidden transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm text-gray-500 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-500" />
              Outstanding by Class
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(overview?.outstandingByClass || []).length > 0 ? (
              <div className="divide-y divide-gray-50">
                {(overview?.outstandingByClass || []).map((entry) => (
                  <div
                    key={entry.className}
                    className="flex items-center justify-between px-5 py-3 transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                  >
                    <span className="text-sm font-medium text-gray-700">{entry.className}</span>
                    <span className="text-sm font-semibold text-amber-600">
                      {formatMoney(entry.outstanding)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">All clear!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
