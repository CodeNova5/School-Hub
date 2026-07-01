"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function AdminFinancePage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

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

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
            <p className="text-gray-600">
              Manage fees, student billing, transactions, and receipts.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCSV(transactions, "finance-transactions")}>
              Export Transactions CSV
            </Button>
            <Button variant="outline" onClick={() => exportToCSV(receipts, "finance-receipts")}>
              Export Receipts CSV
            </Button>
            <Button onClick={loadFinanceData}>Refresh</Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-red-700">{error}</CardContent>
          </Card>
        )}

        {loading || schoolLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
              Loading finance module...
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Payments</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="billing">Students Billing</TabsTrigger>
              <TabsTrigger value="receipts">Receipts & Invoice</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

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
                onTabChange={setActiveTab}
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
                onTabChange={setActiveTab}
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
