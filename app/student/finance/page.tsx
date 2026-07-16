"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { StatusDotBadge, PaymentProgressBar, FeePill } from "@/components/finance/finance-ui";
import { cn } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  AlertCircle,
  Receipt,
  Banknote,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileText,
  ExternalLink,
  RefreshCw,
  ReceiptText,
} from "lucide-react";

interface StatementResponse {
  student: { first_name: string; last_name: string; student_id: string };
  summary: {
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    billCount: number;
  };
  bills: Array<{
    id: string;
    due_date?: string;
    status: string;
    total_amount: number;
    amount_paid: number;
    balance_amount: number;
    finance_bill_items?: Array<{ title: string; amount: number }>;
    finance_receipts?: Array<{ receipt_number: string }>;
  }>;
}

interface SchoolFinanceSettings {
  paystack_subaccount_code?: string | null;
  enable_paystack_checkout: boolean;
  default_currency: string;
  school_name?: string;
}

/* ── Stat Card Configuration ─────────────────────────────────── */

interface StatCardDef {
  label: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  textColor: string;
  format: "money" | "count";
  subtitle?: string;
}

function StatCard({ def, index }: { def: StatCardDef; index: number }) {
  const Icon = def.icon;
  const formatted =
    def.format === "money"
      ? `NGN ${Number(def.value || 0).toLocaleString()}`
      : String(def.value || 0);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Gradient accent bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${def.gradient}`} />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {def.label}
            </p>
            <p className={`text-2xl font-bold tracking-tight ${def.textColor}`}>
              {formatted}
            </p>
            {def.subtitle && (
              <p className="text-xs text-gray-400">{def.subtitle}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors group-hover:scale-110 group-hover:shadow-sm",
              def.iconBg
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Bill Card ────────────────────────────────────────────────── */

function BillCard({
  bill,
  formatMoney,
  onPayNow,
  index,
}: {
  bill: StatementResponse["bills"][number];
  formatMoney: (v: number) => string;
  onPayNow: (id: string, amount: number) => void;
  index: number;
}) {
  const isPaid = bill.status === "paid" || bill.status === "success";
  const isOverdue = bill.status === "overdue";
  const paymentPct =
    bill.total_amount > 0
      ? Math.round((bill.amount_paid / bill.total_amount) * 100)
      : 0;

  return (
    <div
      className="group rounded-xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-200"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                isPaid
                  ? "bg-emerald-100"
                  : isOverdue
                  ? "bg-red-100"
                  : "bg-amber-100"
              )}
            >
              {isPaid ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : isOverdue ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <ReceiptText className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusDotBadge status={bill.status} />
                {bill.due_date && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                    <CalendarDays className="h-3 w-3" />
                    {new Date(bill.due_date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">Balance</p>
            <p
              className={cn(
                "text-lg font-bold tracking-tight",
                isPaid
                  ? "text-emerald-600"
                  : isOverdue
                  ? "text-red-600"
                  : "text-gray-900"
              )}
            >
              {formatMoney(bill.balance_amount)}
            </p>
          </div>
        </div>

        {/* Payment Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Payment progress</span>
            <span className="font-medium text-gray-700">{paymentPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                paymentPct >= 100
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                  : paymentPct >= 50
                  ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                  : "bg-gradient-to-r from-rose-400 to-orange-500"
              )}
              style={{ width: `${Math.min(paymentPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>
              Paid: {formatMoney(bill.amount_paid)} /{" "}
              {formatMoney(bill.total_amount)}
            </span>
          </div>
        </div>

        {/* Fee Items Pills */}
        {bill.finance_bill_items && bill.finance_bill_items.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bill.finance_bill_items.map((item, i) => (
              <FeePill key={i} label={item.title} />
            ))}
          </div>
        )}

        {/* Receipts & Pay Button Row */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-50">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {bill.finance_receipts && bill.finance_receipts.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Receipt className="h-3 w-3" />
                {bill.finance_receipts.length} receipt
                {bill.finance_receipts.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-xs text-gray-300">No receipts yet</span>
            )}
          </div>

          {!isPaid && bill.balance_amount > 0 && (
            <Button
              size="sm"
              onClick={() => onPayNow(bill.id, bill.balance_amount)}
              className={cn(
                "shrink-0 gap-1.5 transition-all duration-200",
                isOverdue
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
              )}
            >
              <CreditCard className="h-3.5 w-3.5" />
              Pay Now
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Button>
          )}

          {isPaid && (
            <Badge variant="success" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              Fully Paid
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton Loading ─────────────────────────────────────────── */

function FinanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Bills section skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-36" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="text-right space-y-1.5">
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-6 w-20 ml-auto" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-50">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────── */

function FinanceEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
          <Wallet className="h-10 w-10 text-indigo-400" />
        </div>
        <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 border-2 border-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        No bills yet
      </h3>
      <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
        Your school hasn&apos;t issued any bills yet. Check back later or
        contact the finance office if you believe this is an error.
      </p>
      <Button variant="outline" size="sm" className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */

export default function StudentFinancePage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [settings, setSettings] = useState<SchoolFinanceSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const [statementRes, settingsRes] = await Promise.all([
        fetch("/api/student/finance/statement"),
        fetch("/api/student/finance/settings"),
      ]);

      const statementPayload = await statementRes.json();
      const settingsPayload = await settingsRes.json();

      if (!statementRes.ok || !statementPayload.success) {
        throw new Error(statementPayload.error || "Failed to fetch statement");
      }

      if (!settingsRes.ok || !settingsPayload.success) {
        console.warn("Could not fetch finance settings:", settingsPayload.error);
      }

      setStatement(statementPayload.data as StatementResponse);
      setSettings(settingsPayload.data as SchoolFinanceSettings);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load finance statement"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatement = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/student/finance/statement");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to refresh");
      }
      setStatement(payload.data as StatementResponse);
      toast.success("Statement refreshed");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh statement"
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const verifyPayment = useCallback(
    async (reference: string) => {
      try {
        const res = await fetch(
          `/api/finance/paystack/verify?reference=${encodeURIComponent(reference)}`
        );
        const payload = await res.json();
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || "Payment verification failed");
        }
        toast.success("Payment verified successfully");
        await fetchStatement();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to verify payment"
        );
      }
    },
    [fetchStatement]
  );

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  useEffect(() => {
    const reference = searchParams.get("reference");
    if (reference) {
      verifyPayment(reference);
    }
  }, [searchParams, verifyPayment]);

  const formatMoney = useMemo(() => {
    return (value: number) => `NGN ${Number(value || 0).toLocaleString()}`;
  }, []);

  const handlePayNow = async (billId: string, amount: number) => {
    try {
      const callbackUrl = `${window.location.origin}/student/finance`;
      const res = await fetch("/api/finance/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId,
          amount,
          callbackUrl,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to initialize payment");
      }

      window.location.href = payload.data.authorizationUrl as string;
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Unable to start payment"
      );
    }
  };

  const statCards: StatCardDef[] = [
    {
      label: "Total Due",
      value: statement?.summary.totalDue || 0,
      icon: Banknote,
      gradient: "from-indigo-500 to-blue-500",
      iconBg: "bg-gradient-to-br from-indigo-500 to-blue-600",
      textColor: "text-gray-900",
      format: "money",
      subtitle: statement ? "Current session total" : undefined,
    },
    {
      label: "Total Paid",
      value: statement?.summary.totalPaid || 0,
      icon: CheckCircle2,
      gradient: "from-emerald-400 to-green-500",
      iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
      textColor: "text-emerald-600",
      format: "money",
      subtitle: statement ? "Completed payments" : undefined,
    },
    {
      label: "Outstanding",
      value: statement?.summary.totalOutstanding || 0,
      icon: AlertCircle,
      gradient: "from-amber-400 to-orange-500",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      textColor: "text-amber-600",
      format: "money",
      subtitle: statement ? "Remaining balance" : undefined,
    },
    {
      label: "Bills",
      value: statement?.summary.billCount || 0,
      icon: ReceiptText,
      gradient: "from-purple-500 to-pink-500",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      textColor: "text-gray-900",
      format: "count",
      subtitle: statement ? "Issued bills" : undefined,
    },
  ];

  return (
    <DashboardLayout role="student">
      <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-500">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Finance
              </h1>
              {settings?.school_name && (
                <Badge
                  variant="outline"
                  className="text-xs font-normal text-gray-500 border-gray-200"
                >
                  {settings.school_name}
                </Badge>
              )}
            </div>
            <p className="text-gray-500">
              {statement
                ? `Welcome, ${statement.student.first_name}! Here's your fee overview.`
                : "View your school bills and payment history."}
            </p>
          </div>

          {!loading && statement && (
            <Button
              variant="outline"
              size="sm"
              onClick={refreshStatement}
              disabled={refreshing}
              className="gap-2 shrink-0"
            >
              <RefreshCw
                className={cn(
                  "h-3.5 w-3.5",
                  refreshing && "animate-spin"
                )}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          )}
        </div>

        {/* ── Loading State ──────────────────────────────────── */}
        {loading ? (
          <FinanceSkeleton />
        ) : statement ? (
          <div className="space-y-6">
            {/* ── Summary Cards ──────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((def, i) => (
                <div
                  key={def.label}
                  className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <StatCard def={def} index={i} />
                </div>
              ))}
            </div>

            {/* ── Quick Summary Bar ──────────────────────────── */}
            {statement.summary.totalOutstanding > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">
                    Outstanding Balance
                  </p>
                  <p className="text-sm text-amber-700">
                    You have{" "}
                    <strong>{formatMoney(statement.summary.totalOutstanding)}</strong>{" "}
                    outstanding across{" "}
                    {statement.summary.billCount} bill
                    {statement.summary.billCount !== 1 ? "s" : ""}.
                    {statement.summary.totalOutstanding > 0
                      ? " Please pay at your earliest convenience."
                      : ""}
                  </p>
                </div>
              </div>
            )}

            {statement.summary.totalOutstanding === 0 &&
              statement.summary.billCount > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800">
                      All Clear!
                    </p>
                    <p className="text-sm text-emerald-700">
                      You have no outstanding balance. All bills are fully paid.
                    </p>
                  </div>
                </div>
              )}

            {/* ── Bills Section ──────────────────────────────── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Bills & Invoices
                </h2>
                {statement.bills.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {statement.bills.length} bill
                    {statement.bills.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="grid gap-3">
                {statement.bills.map((bill, i) => (
                  <div
                    key={bill.id}
                    className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <BillCard
                      bill={bill}
                      formatMoney={formatMoney}
                      onPayNow={handlePayNow}
                      index={i}
                    />
                  </div>
                ))}
              </div>

              {statement.bills.length === 0 && <FinanceEmptyState />}
            </div>
          </div>
        ) : (
          /* ── Error / No-data state ───────────────────────────── */
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 border border-red-100 mb-6">
              <AlertCircle className="h-10 w-10 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Could not load data
            </h3>
            <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
              There was a problem loading your financial information. Please try
              again.
            </p>
            <Button onClick={fetchStatement} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
