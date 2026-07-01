"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Receipt, Wallet, Landmark } from "lucide-react";
import type { FinanceOverview } from "./finance-types";

interface OverviewTabProps {
  overview: FinanceOverview | null;
  formatMoney: (value: number) => string;
}

export function FinanceOverviewTab({ overview, formatMoney }: OverviewTabProps) {
  return (
    <div className="space-y-4 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Total Due</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-600" />
            {formatMoney(overview?.stats.totalDue || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Collected</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            {formatMoney(overview?.stats.totalCollected || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-600" />
            {formatMoney(overview?.stats.totalOutstanding || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Overdue Bills</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-red-600" />
            {overview?.stats.overdueCount || 0}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.recentTransactions || []).slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <p className="font-medium text-sm">
                    {tx.students?.first_name} {tx.students?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{tx.reference}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(tx.amount)}</p>
                  <Badge variant={tx.status === "success" ? "secondary" : "outline"}>
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
            {(!overview?.recentTransactions || overview.recentTransactions.length === 0) && (
              <p className="text-sm text-gray-500">No transactions yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outstanding by Class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.outstandingByClass || []).map((entry) => (
              <div
                key={entry.className}
                className="flex items-center justify-between border rounded-md p-3"
              >
                <span className="text-sm font-medium">{entry.className}</span>
                <span className="text-sm font-semibold">{formatMoney(entry.outstanding)}</span>
              </div>
            ))}
            {(!overview?.outstandingByClass || overview.outstandingByClass.length === 0) && (
              <p className="text-sm text-gray-500">No outstanding balances by class.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
