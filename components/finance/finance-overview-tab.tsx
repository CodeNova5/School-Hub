"use client";

import { useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  Users,
  Banknote,
  ArrowUpRight,
  CheckCircle2,
  BarChart3,
  CreditCard,
  AlertCircle,
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

/* ─── Types ─────────────────────────────────────────── */

interface OverviewTabProps {
  overview: FinanceOverview | null;
  formatMoney: (value: number) => string;
}

type PeriodMode = "monthly" | "quarterly" | "yearly";

/* ─── Helpers ───────────────────────────────────────── */

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

function getStatusConfig(status: string) {
  switch (status) {
    case "success":
    case "paid":
      return { dot: "bg-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", label: "Paid" };
    case "failed":
      return { dot: "bg-red-500", bg: "bg-red-50", border: "border-red-200", text: "text-red-600", label: "Failed" };
    case "pending":
      return { dot: "bg-amber-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", label: "Pending" };
    case "partial":
      return { dot: "bg-amber-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", label: "Partial" };
    case "overdue":
      return { dot: "bg-rose-500", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600", label: "Overdue" };
    case "unpaid":
      return { dot: "bg-red-500", bg: "bg-red-50", border: "border-red-200", text: "text-red-600", label: "Unpaid" };
    default:
      return { dot: "bg-gray-500", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500", label: status };
  }
}

/* ─── Status Badge with Dot ─────────────────────────── */

function StatusDotBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text} ${cfg.border} border`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "overdue" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

/* ─── Stat Card (Dark Theme) ────────────────────────── */

const STAT_CARD_STYLES: Record<string, { gradient: string; iconBg: string; iconColor: string }> = {
  billed: {
    gradient: "from-indigo-500 to-violet-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
  },
  collected: {
    gradient: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  outstanding: {
    gradient: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  overdue: {
    gradient: "from-rose-500 to-pink-500",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
  },
};

function StatCard({
  icon: Icon,
  label,
  value,
  variant,
  detail,
  trendIcon,
}: {
  icon: any;
  label: string;
  value: string | number;
  variant: keyof typeof STAT_CARD_STYLES;
  detail?: string;
  trendIcon?: React.ReactNode;
}) {
  const styles = STAT_CARD_STYLES[variant];
  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-lg cursor-default">
      {/* Gradient accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${styles.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      
      {/* Icon */}
      <div className={`w-9 h-9 rounded-lg ${styles.iconBg} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
        <Icon className={`h-4.5 w-4.5 ${styles.iconColor}`} />
      </div>
      
      {/* Label */}
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.08em] mb-1">{label}</p>
      
      {/* Value */}
      <div className="flex items-center gap-2">
        <span className="text-2xl font-extrabold tracking-tight text-gray-900">{value}</span>
        {trendIcon && <span className="shrink-0">{trendIcon}</span>}
      </div>
      
      {/* Detail */}
      {detail && <p className="text-[11px] text-gray-400 mt-2">{detail}</p>}
    </div>
  );
}

/* ─── Revenue Trend Chart (Dark Theme) ──────────────── */

function RevenueTrendChart({
  monthlyTrend,
  formatMoney,
}: {
  monthlyTrend: MonthlyTrendItem[];
  formatMoney: (v: number) => string;
}) {
  const [period, setPeriod] = useState<PeriodMode>("monthly");
  const chartData = useMemo(() => aggregateByPeriod(monthlyTrend, period), [monthlyTrend, period]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 hover:border-gray-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Revenue Trend</p>
            <p className="text-[11px] text-gray-500">Collection performance over time</p>
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {(["monthly", "quarterly", "yearly"] as PeriodMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setPeriod(mode)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 capitalize ${
                period === mode
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Body */}
      <div className="p-5">
        {chartData.length > 0 ? (
          <div>
            {/* Legend */}
            <div className="flex items-center gap-5 mb-3 text-[11px] text-gray-500">
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

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-3 border-t border-gray-100 mt-2">
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
          <div className="h-[280px] flex flex-col items-center justify-center">
            <BarChart3 className="h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No revenue data yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Collections will appear here once payments are recorded
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────── */

export function FinanceOverviewTab({ overview, formatMoney }: OverviewTabProps) {
  const stats = overview?.stats;
  const collectionRate = stats && stats.totalDue > 0
    ? Math.round((stats.totalCollected / stats.totalDue) * 100)
    : 0;

  const monthlyTrend = overview?.monthlyTrend || [];
  const recentTransactions = overview?.recentTransactions || [];
  const outstandingByClass = overview?.outstandingByClass || [];

  return (
    <div className="space-y-6">
      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Banknote}
          label="Total Billed"
          value={formatMoney(stats?.totalDue || 0)}
          variant="billed"
          detail={`${stats?.totalBills || 0} active bills`}
        />
        <StatCard
          icon={Wallet}
          label="Collected"
          value={formatMoney(stats?.totalCollected || 0)}
          variant="collected"
          detail={`${collectionRate}% collection rate`}
          trendIcon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
        />
        <StatCard
          icon={CreditCard}
          label="Outstanding"
          value={formatMoney(stats?.totalOutstanding || 0)}
          variant="outstanding"
          detail={`${stats?.partialCount || 0} partial payments`}
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={stats?.overdueCount || 0}
          variant="overdue"
          detail={`${stats?.overdueCount || 0} overdue accounts`}
        />
      </div>

      {/* ─── Revenue Trend Chart ─── */}
      {monthlyTrend.length > 0 && (
        <RevenueTrendChart monthlyTrend={monthlyTrend} formatMoney={formatMoney} />
      )}

      {/* ─── Collection Rate + Recent Transactions + O/S by Class ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Collection Rate Card */}
        <div className="lg:col-span-1 rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 hover:border-gray-300">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Collection Rate</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-extrabold tracking-tight text-gray-900">{collectionRate}%</span>
              <span className="text-xs text-gray-500">
                {stats?.paidCount || 0} of {stats?.totalBills || 0} paid
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  collectionRate >= 80
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : collectionRate >= 50
                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                    : "bg-gradient-to-r from-rose-500 to-pink-500"
                }`}
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">
                Partial: <span className="text-gray-700 font-semibold">{stats?.partialCount || 0}</span>
              </span>
              <span className="text-gray-500">
                Overdue: <span className="text-rose-600 font-semibold">{stats?.overdueCount || 0}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 hover:border-gray-300">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Recent Transactions</p>
            </div>
          </div>
          <div>
            {recentTransactions.slice(0, 6).length > 0 ? (
              <div className="divide-y divide-gray-100">
                {recentTransactions.slice(0, 6).map((tx) => {
                  const cfg = getStatusConfig(tx.status);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between px-5 py-3 transition-all duration-150 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full ${cfg.dot} shrink-0 ${tx.status === "pending" ? "animate-pulse" : ""}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {tx.students?.first_name} {tx.students?.last_name}
                          </p>
                          <p className="text-xs text-gray-500 truncate font-mono">{tx.reference}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{formatMoney(tx.amount)}</span>
                        <StatusDotBadge status={tx.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Wallet className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No transactions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Outstanding by Class */}
        <div className="lg:col-span-1 rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300 hover:border-gray-300">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <p className="text-sm font-semibold text-gray-900">O/S by Class</p>
            </div>
          </div>
          <div>
            {outstandingByClass.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {outstandingByClass.map((entry, i) => {
                  const colors = ["bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-pink-500", "bg-rose-500", "bg-orange-500"];
                  const dotColor = colors[i % colors.length];
                  return (
                    <div
                      key={entry.className}
                      className="flex items-center justify-between px-5 py-3 transition-all duration-150 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                        <span className="text-sm font-medium text-gray-700">{entry.className}</span>
                      </div>
                      <span className="text-sm font-bold text-amber-600">
                        {formatMoney(entry.outstanding)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">All clear!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
