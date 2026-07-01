"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Wallet,
  Landmark,
  TrendingUp,
  Users,
  Banknote,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import type { FinanceOverview } from "./finance-types";

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

export function FinanceOverviewTab({ overview, formatMoney }: OverviewTabProps) {
  const stats = overview?.stats;
  const collectionRate = stats && stats.totalDue > 0
    ? Math.round((stats.totalCollected / stats.totalDue) * 100)
    : 0;

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
