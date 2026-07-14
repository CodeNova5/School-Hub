"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exportToCSV } from "@/lib/student-utils";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { FinanceOverviewTab } from "@/components/finance/finance-overview-tab";
import { FinanceTransactionsTab } from "@/components/finance/finance-transactions-tab";
import { FinanceFeesTab } from "@/components/finance/finance-fees-tab";
import { FinanceBillingTab } from "@/components/finance/finance-billing-tab";
import { FinanceReceiptsTab } from "@/components/finance/finance-receipts-tab";
import { FinanceSettingsTab } from "@/components/finance/finance-settings-tab";
import type {
  FinanceOverview,
  FinanceSettings,
  FeeTemplate,
  FinanceBill,
  FinanceTransactionRow,
  FinanceReceipt,
  StudentOption,
  ClassOption,
} from "@/components/finance/finance-types";
import {
  Wallet,
  Banknote,
  RefreshCw,
  Download,
  CreditCard,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  Users,
  Receipt,
  Landmark,
  Layers,
  Settings,
  FileText,
  Sparkles,
} from "lucide-react";

type TabKey = "overview" | "transactions" | "fees" | "billing" | "receipts" | "settings";

const TAB_CONFIG: { key: TabKey; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: TrendingUp },
  { key: "transactions", label: "Payments", icon: CreditCard },
  { key: "fees", label: "Fees", icon: Layers },
  { key: "billing", label: "Billing", icon: Users },
  { key: "receipts", label: "Receipts", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings },
];

/* ── Skeleton Component ─────────────────────────────── */

function FinanceSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Quick stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <div className="h-3 w-20 bg-gray-200 rounded-full" />
            <div className="h-7 w-28 bg-gray-200 rounded-lg" />
            <div className="h-2 w-16 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-lg" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <div className="h-5 w-40 bg-gray-200 rounded-full" />
        <div className="h-3 w-full bg-gray-100 rounded-full" />
        <div className="h-3 w-3/4 bg-gray-100 rounded-full" />
        <div className="h-3 w-1/2 bg-gray-100 rounded-full" />
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
          <div className="h-20 bg-gray-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/* ── Empty / Onboarding State ───────────────────────── */

function FinanceEmptyState({ onTabChange }: { onTabChange: (tab: TabKey) => void }) {
  const steps = [
    {
      icon: Settings,
      label: "1. Configure Settings",
      desc: "Set up your currency, Paystack integration, and invoice preferences.",
      tab: "settings" as TabKey,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      icon: Layers,
      label: "2. Create Fee Templates",
      desc: "Define tuition, exam, uniform, and other fee structures for your school.",
      tab: "fees" as TabKey,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      icon: Users,
      label: "3. Bill Students",
      desc: "Generate bills for students based on their class and fee templates.",
      tab: "billing" as TabKey,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      icon: CreditCard,
      label: "4. Record Payments",
      desc: "Accept payments via Paystack or record manual payments.",
      tab: "transactions" as TabKey,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white via-indigo-50/20 to-white">
      <CardContent className="p-8 sm:p-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-200">
            <Wallet className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Finance Module</h2>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Get started with managing your school&apos;s finances. Follow these simple steps to set up fee collection and payment tracking.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl mx-auto">
          {steps.map((step) => (
            <button
              key={step.tab}
              onClick={() => onTabChange(step.tab)}
              className="group flex items-start gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left"
            >
              <div className={`p-2.5 rounded-lg ${step.bg} shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                <step.icon className={`h-5 w-5 ${step.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors duration-200">
                  {step.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 shrink-0 mt-1 transition-colors duration-200" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ───────────────────────────────────────── */

export default function AdminFinancePage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [settings, setSettings] = useState<FinanceSettings>({});
  const [fees, setFees] = useState<FeeTemplate[]>([]);
  const [bills, setBills] = useState<FinanceBill[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransactionRow[]>([]);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const fetchJson = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    const payload = (await res.json()) as {
      success?: boolean;
      data?: T;
      error?: string;
    };

    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Request failed");
    }

    return payload.data as T;
  };

  const loadFinanceData = useCallback(async () => {
    if (!schoolId) return;

    setLoading(true);
    setError(null);

    try {
      const [overviewData, settingsData, feeData, billData, txData, receiptData, studentsResult, classesResult] =
        await Promise.all([
          fetchJson<FinanceOverview>("/api/admin/finance/overview"),
          fetchJson<FinanceSettings>("/api/admin/finance/settings"),
          fetchJson<FeeTemplate[]>("/api/admin/finance/fees"),
          fetchJson<FinanceBill[]>("/api/admin/finance/billing"),
          fetchJson<FinanceTransactionRow[]>("/api/admin/finance/transactions"),
          fetchJson<FinanceReceipt[]>("/api/admin/finance/receipts"),
          supabase
            .from("students")
            .select("id, student_id, first_name, last_name, class_id")
            .eq("school_id", schoolId)
            .eq("status", "active")
            .order("first_name", { ascending: true }),
          supabase
            .from("classes")
            .select("id, name")
            .eq("school_id", schoolId)
            .order("name", { ascending: true }),
        ]);

      if (studentsResult.error) throw studentsResult.error;
      if (classesResult.error) throw classesResult.error;

      setOverview(overviewData);
      setSettings(settingsData);
      setFees(feeData);
      setBills(billData);
      setTransactions(txData);
      setReceipts(receiptData);
      setStudents((studentsResult.data || []) as StudentOption[]);
      setClasses((classesResult.data || []) as ClassOption[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load finance data");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadFinanceData();
    }
  }, [loadFinanceData, schoolId, schoolLoading]);

  const currency = settings.default_currency || "NGN";

  const formatMoney = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const isPaystackConfigured = !!settings.paystack_subaccount_code;
  const hasNoData = !loading && fees.length === 0 && bills.length === 0 && transactions.length === 0 && receipts.length === 0;
  const isFirstTime = hasNoData && !error;

  // Quick summary stats from overview
  const quickStats = useMemo(() => {
    if (!overview?.stats) return null;
    const s = overview.stats;
    const rate = s.totalDue > 0 ? Math.round((s.totalCollected / s.totalDue) * 100) : 0;
    return [
      { label: "Total Due", value: formatMoney(s.totalDue), icon: Banknote, color: "text-blue-600", bg: "bg-blue-50" },
      { label: "Collected", value: formatMoney(s.totalCollected), icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Outstanding", value: formatMoney(s.totalOutstanding), icon: Landmark, color: "text-amber-600", bg: "bg-amber-50" },
      {
        label: "Collection Rate",
        value: `${rate}%`,
        icon: TrendingUp,
        color: rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-600",
        bg: rate >= 80 ? "bg-emerald-50" : rate >= 50 ? "bg-amber-50" : "bg-red-50",
      },
    ];
  }, [overview, formatMoney]);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-200/50">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-500 bg-clip-text text-transparent">
                  Finance
                </h1>
                {isPaystackConfigured ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" />
                    Paystack Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 gap-1 text-[10px]">
                    <AlertCircle className="h-3 w-3" />
                    Paystack Not Set
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage fees, student billing, transactions, and receipts.
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {!isFirstTime && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => exportToCSV(transactions, "finance-transactions")}
                  disabled={transactions.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Txns
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => exportToCSV(receipts, "finance-receipts")}
                  disabled={receipts.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Receipts
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={loadFinanceData}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Quick Stats Row ── */}
        {!isFirstTime && quickStats && !loading && !error && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
              >
                <div className={`p-2.5 rounded-lg ${stat.bg} transition-transform duration-200 group-hover:scale-110`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-bold text-gray-900 mt-0.5 truncate">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error State ── */}
        {error && (
          <Card className="border-red-200 bg-red-50 overflow-hidden">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 flex-1">{error}</p>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={loadFinanceData}>
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Loading State ── */}
        {loading || schoolLoading ? (
          <FinanceSkeleton />
        ) : isFirstTime ? (
          <FinanceEmptyState onTabChange={setActiveTab} />
        ) : (
          /* ── Tabs ── */
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="w-full">
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <TabsList className="inline-flex w-auto gap-1 bg-gray-100/80 p-1 rounded-xl">
                {TAB_CONFIG.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-indigo-100 text-gray-500 hover:text-gray-700 transition-all duration-150"
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="overview">
              <FinanceOverviewTab overview={overview} formatMoney={formatMoney} />
            </TabsContent>

            <TabsContent value="transactions">
              <FinanceTransactionsTab
                bills={bills}
                transactions={transactions}
                formatMoney={formatMoney}
                onRefresh={loadFinanceData}
                onError={setError}
                onTabChange={(tab) => setActiveTab(tab as TabKey)}
              />
            </TabsContent>

            <TabsContent value="fees">
              <FinanceFeesTab
                fees={fees}
                classes={classes}
                formatMoney={formatMoney}
                onRefresh={loadFinanceData}
                onError={setError}
              />
            </TabsContent>

            <TabsContent value="billing">
              <FinanceBillingTab
                bills={bills}
                students={students}
                fees={fees}
                classes={classes}
                formatMoney={formatMoney}
                onRefresh={loadFinanceData}
                onError={setError}
                onTabChange={(tab) => setActiveTab(tab as TabKey)}
              />
            </TabsContent>

            <TabsContent value="receipts">
              <FinanceReceiptsTab receipts={receipts} formatMoney={formatMoney} />
            </TabsContent>

            <TabsContent value="settings">
              <FinanceSettingsTab
                settings={settings}
                formatMoney={formatMoney}
                onRefresh={loadFinanceData}
                onError={setError}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
