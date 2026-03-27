"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { exportToCSV } from "@/lib/student-utils";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DollarSign, Receipt, Settings, Wallet, Landmark, Users } from "lucide-react";

interface FinanceOverview {
  stats: {
    totalDue: number;
    totalCollected: number;
    totalOutstanding: number;
    overdueCount: number;
    totalBills: number;
    paidCount: number;
    partialCount: number;
  };
  recentTransactions: FinanceTransaction[];
  outstandingByClass: Array<{ className: string; outstanding: number }>;
}

interface FinanceSettings {
  paystack_subaccount_code?: string | null;
  enable_paystack_checkout?: boolean;
  default_currency?: string;
  invoice_prefix?: string;
  receipt_prefix?: string;
}

interface ClassAmount {
  class_id: string;
  class_amount: number;
  classes?: { name?: string };
}

interface FeeTemplate {
  id: string;
  name: string;
  category: string;
  frequency: string;
  amount: number;
  is_active: boolean;
  finance_fee_template_classes?: ClassAmount[];
}

interface FinanceBill {
  id: string;
  student_id: string;
  status: string;
  total_amount: number;
  amount_paid: number;
  balance_amount: number;
  due_date?: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
  finance_bill_items?: Array<{ title: string; amount: number; frequency: string }>;
}

interface FinanceTransaction {
  id: string;
  reference: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
}

interface FinanceReceipt {
  id: string;
  receipt_number: string;
  issued_at: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
  finance_transactions?: { amount?: number; payment_method?: string; reference?: string };
}

interface StudentOption {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  class_id?: string;
}

interface ClassOption {
  id: string;
  name: string;
}

export default function AdminFinancePage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [settings, setSettings] = useState<FinanceSettings>({});
  const [fees, setFees] = useState<FeeTemplate[]>([]);
  const [bills, setBills] = useState<FinanceBill[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  const [feeForm, setFeeForm] = useState({
    name: "",
    category: "tuition",
    frequency: "per_term",
    amount: "",
    description: "",
  });
  const [classAmounts, setClassAmounts] = useState<Record<string, string>>({});

  const [billForm, setBillForm] = useState({
    studentId: "",
    billingCycle: "per_term",
    dueDate: "",
    feeTemplateId: "",
    amount: "",
  });

  const [transactionForm, setTransactionForm] = useState({
    billId: "",
    studentId: "",
    amount: "",
    paymentMethod: "manual",
  });

  const [subaccountForm, setSubaccountForm] = useState({
    businessName: "",
    settlementBank: "",
    accountNumber: "",
  });

  const fetchJson = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    const payload = (await res.json()) as { success?: boolean; data?: T; error?: string };

    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Request failed");
    }

    return payload.data as T;
  };

  const loadFinanceData = useCallback(async () => {
    if (!schoolId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        overviewData,
        settingsData,
        feeData,
        billData,
        txData,
        receiptData,
        studentsResult,
        classesResult,
      ] = await Promise.all([
        fetchJson<FinanceOverview>("/api/admin/finance/overview"),
        fetchJson<FinanceSettings>("/api/admin/finance/settings"),
        fetchJson<FeeTemplate[]>("/api/admin/finance/fees"),
        fetchJson<FinanceBill[]>("/api/admin/finance/billing"),
        fetchJson<FinanceTransaction[]>("/api/admin/finance/transactions"),
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

      if (studentsResult.error) {
        throw studentsResult.error;
      }

      if (classesResult.error) {
        throw classesResult.error;
      }

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

  const feeTemplateLookup = useMemo(() => {
    const lookup = new Map<string, FeeTemplate>();
    fees.forEach((fee) => lookup.set(fee.id, fee));
    return lookup;
  }, [fees]);

  const currency = settings.default_currency || "NGN";

  const formatMoney = (value: number) =>
    `${currency} ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const submitSettings = async () => {
    const res = await fetch("/api/admin/finance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paystackSubaccountCode: settings.paystack_subaccount_code || "",
        enablePaystackCheckout: settings.enable_paystack_checkout ?? true,
        defaultCurrency: settings.default_currency || "NGN",
        invoicePrefix: settings.invoice_prefix || "INV",
        receiptPrefix: settings.receipt_prefix || "RCP",
      }),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to save settings");
    }

    await loadFinanceData();
  };

  const submitSubaccountCreation = async () => {
    if (!subaccountForm.businessName || !subaccountForm.settlementBank || !subaccountForm.accountNumber) {
      throw new Error("Business name, settlement bank and account number are required");
    }

    const res = await fetch("/api/admin/finance/settings/subaccount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subaccountForm),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to create subaccount");
    }

    setSubaccountForm({ businessName: "", settlementBank: "", accountNumber: "" });
    await loadFinanceData();
  };

  const submitFee = async () => {
    const parsedAmount = Number(feeForm.amount);
    if (!feeForm.name || Number.isNaN(parsedAmount)) {
      throw new Error("Fee name and amount are required");
    }

    const mappedClassAmounts = Object.entries(classAmounts)
      .filter(([, amount]) => amount !== "" && !Number.isNaN(Number(amount)))
      .map(([classId, amount]) => ({ classId, amount: Number(amount) }));

    const res = await fetch("/api/admin/finance/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: feeForm.name,
        category: feeForm.category,
        frequency: feeForm.frequency,
        amount: parsedAmount,
        description: feeForm.description,
        classAmounts: mappedClassAmounts,
      }),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to create fee");
    }

    setFeeForm({ name: "", category: "tuition", frequency: "per_term", amount: "", description: "" });
    setClassAmounts({});
    await loadFinanceData();
  };

  const submitBill = async () => {
    if (!billForm.studentId || !billForm.amount) {
      throw new Error("Select student and amount to create bill");
    }

    const student = students.find((s) => s.id === billForm.studentId);
    const selectedFee = billForm.feeTemplateId ? feeTemplateLookup.get(billForm.feeTemplateId) : null;

    const res = await fetch("/api/admin/finance/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: billForm.studentId,
        classId: student?.class_id,
        billingCycle: billForm.billingCycle,
        dueDate: billForm.dueDate || null,
        items: [
          {
            feeTemplateId: selectedFee?.id,
            title: selectedFee?.name || "Custom Fee",
            frequency: selectedFee?.frequency || billForm.billingCycle,
            amount: Number(billForm.amount),
            originalAmount: selectedFee?.amount || Number(billForm.amount),
            overrideType: selectedFee ? "none" : "custom",
            notes: selectedFee ? "" : "Added from billing panel",
          },
        ],
      }),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to create bill");
    }

    setBillForm({ studentId: "", billingCycle: "per_term", dueDate: "", feeTemplateId: "", amount: "" });
    await loadFinanceData();
  };

  const submitTransaction = async () => {
    if (!transactionForm.billId || !transactionForm.studentId || !transactionForm.amount) {
      throw new Error("Bill, student and amount are required");
    }

    const res = await fetch("/api/admin/finance/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billId: transactionForm.billId,
        studentId: transactionForm.studentId,
        amount: Number(transactionForm.amount),
        paymentMethod: transactionForm.paymentMethod,
        provider: "manual",
        status: "success",
      }),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to record transaction");
    }

    setTransactionForm({ billId: "", studentId: "", amount: "", paymentMethod: "manual" });
    await loadFinanceData();
  };

  const handleAction = async (callback: () => Promise<void>) => {
    try {
      await callback();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
            <p className="text-gray-600">Manage fees, student billing, transactions, and receipts.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportToCSV(transactions, "finance-transactions")}>Export Transactions CSV</Button>
            <Button variant="outline" onClick={() => exportToCSV(receipts, "finance-receipts")}>Export Receipts CSV</Button>
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
            <CardContent className="py-10 text-center text-gray-500">Loading finance module...</CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">Payments</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="billing">Students Billing</TabsTrigger>
              <TabsTrigger value="receipts">Receipts & Invoice</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Total Due</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-5 w-5 text-blue-600" />{formatMoney(overview?.stats.totalDue || 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Collected</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-5 w-5 text-green-600" />{formatMoney(overview?.stats.totalCollected || 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Outstanding</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-amber-600" />{formatMoney(overview?.stats.totalOutstanding || 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Overdue Bills</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-5 w-5 text-red-600" />{overview?.stats.overdueCount || 0}</CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(overview?.recentTransactions || []).slice(0, 8).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between border rounded-md p-3">
                        <div>
                          <p className="font-medium text-sm">{tx.students?.first_name} {tx.students?.last_name}</p>
                          <p className="text-xs text-gray-500">{tx.reference}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatMoney(tx.amount)}</p>
                          <Badge variant={tx.status === "success" ? "secondary" : "outline"}>{tx.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {(!overview?.recentTransactions || overview.recentTransactions.length === 0) && (
                      <p className="text-sm text-gray-500">No transactions yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Outstanding by Class</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {(overview?.outstandingByClass || []).map((entry) => (
                      <div key={entry.className} className="flex items-center justify-between border rounded-md p-3">
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
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4 mt-6">
              <Card>
                <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Bill</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3"
                      value={transactionForm.billId}
                      onChange={(e) => {
                        const selectedBill = bills.find((bill) => bill.id === e.target.value);
                        setTransactionForm((prev) => ({
                          ...prev,
                          billId: e.target.value,
                          studentId: selectedBill?.student_id || "",
                        }));
                      }}
                    >
                      <option value="">Select bill</option>
                      {bills.map((bill) => (
                        <option key={bill.id} value={bill.id}>
                          {bill.students?.first_name} {bill.students?.last_name} - {formatMoney(bill.balance_amount)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={transactionForm.amount}
                      onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Method</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3"
                      value={transactionForm.paymentMethod}
                      onChange={(e) => setTransactionForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                    >
                      <option value="manual">Manual</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="card">Card</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={() => handleAction(submitTransaction)}>Save Payment</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-md items-center">
                      <div className="text-sm font-medium">{tx.students?.first_name} {tx.students?.last_name}</div>
                      <div className="text-sm">{tx.reference}</div>
                      <div className="text-sm font-semibold">{formatMoney(tx.amount)}</div>
                      <div className="text-sm">{tx.payment_method}</div>
                      <div><Badge variant={tx.status === "success" ? "secondary" : "outline"}>{tx.status}</Badge></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fees" className="space-y-4 mt-6">
              <Card>
                <CardHeader><CardTitle>Configure Fee Template</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <Input placeholder="Fee name" value={feeForm.name} onChange={(e) => setFeeForm((prev) => ({ ...prev, name: e.target.value }))} />
                    <select className="h-10 rounded-md border px-3" value={feeForm.category} onChange={(e) => setFeeForm((prev) => ({ ...prev, category: e.target.value }))}>
                      <option value="tuition">Tuition</option>
                      <option value="uniform">Uniform</option>
                      <option value="exam">Exam</option>
                      <option value="bus">Bus</option>
                      <option value="custom">Custom</option>
                    </select>
                    <select className="h-10 rounded-md border px-3" value={feeForm.frequency} onChange={(e) => setFeeForm((prev) => ({ ...prev, frequency: e.target.value }))}>
                      <option value="per_term">Per Term</option>
                      <option value="per_session">Per Session</option>
                      <option value="one_time">One-time</option>
                    </select>
                    <Input placeholder="Amount" type="number" value={feeForm.amount} onChange={(e) => setFeeForm((prev) => ({ ...prev, amount: e.target.value }))} />
                    <Button onClick={() => handleAction(submitFee)}>Create Fee</Button>
                  </div>
                  <Input placeholder="Description" value={feeForm.description} onChange={(e) => setFeeForm((prev) => ({ ...prev, description: e.target.value }))} />

                  <div>
                    <Label className="mb-2 block">Class-specific amounts (optional)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {classes.map((item) => (
                        <div key={item.id} className="flex items-center gap-2 border rounded-md p-2">
                          <span className="text-sm flex-1">{item.name}</span>
                          <Input
                            className="w-32"
                            type="number"
                            placeholder="Amount"
                            value={classAmounts[item.id] || ""}
                            onChange={(e) => setClassAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Fees Management</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {fees.map((fee) => (
                    <div key={fee.id} className="border rounded-md p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{fee.name}</p>
                          <p className="text-sm text-gray-500">{fee.category} · {fee.frequency}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatMoney(fee.amount)}</p>
                          <Badge variant={fee.is_active ? "secondary" : "outline"}>{fee.is_active ? "active" : "inactive"}</Badge>
                        </div>
                      </div>
                      {fee.finance_fee_template_classes && fee.finance_fee_template_classes.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          Class overrides: {fee.finance_fee_template_classes.map((entry) => `${entry.classes?.name || "Class"} (${formatMoney(entry.class_amount)})`).join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4 mt-6">
              <Card>
                <CardHeader><CardTitle>Create Student Bill</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div>
                    <Label>Student</Label>
                    <select className="w-full h-10 rounded-md border px-3" value={billForm.studentId} onChange={(e) => setBillForm((prev) => ({ ...prev, studentId: e.target.value }))}>
                      <option value="">Select student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>{student.first_name} {student.last_name} ({student.student_id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Fee template</Label>
                    <select
                      className="w-full h-10 rounded-md border px-3"
                      value={billForm.feeTemplateId}
                      onChange={(e) => {
                        const fee = feeTemplateLookup.get(e.target.value);
                        setBillForm((prev) => ({
                          ...prev,
                          feeTemplateId: e.target.value,
                          billingCycle: fee?.frequency || prev.billingCycle,
                          amount: fee ? String(fee.amount) : prev.amount,
                        }));
                      }}
                    >
                      <option value="">Custom</option>
                      {fees.map((fee) => (
                        <option key={fee.id} value={fee.id}>{fee.name} - {formatMoney(fee.amount)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Frequency</Label>
                    <select className="w-full h-10 rounded-md border px-3" value={billForm.billingCycle} onChange={(e) => setBillForm((prev) => ({ ...prev, billingCycle: e.target.value }))}>
                      <option value="per_term">Per Term</option>
                      <option value="per_session">Per Session</option>
                      <option value="one_time">One-time</option>
                    </select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input type="number" value={billForm.amount} onChange={(e) => setBillForm((prev) => ({ ...prev, amount: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input type="date" value={billForm.dueDate} onChange={(e) => setBillForm((prev) => ({ ...prev, dueDate: e.target.value }))} />
                  </div>
                  <div className="md:col-span-5">
                    <Button onClick={() => handleAction(submitBill)}>Create Bill</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Students Billing</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {bills.map((bill) => (
                    <div key={bill.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border rounded-md items-center">
                      <div className="font-medium text-sm">{bill.students?.first_name} {bill.students?.last_name}</div>
                      <div className="text-sm">Due: {bill.due_date || "N/A"}</div>
                      <div className="text-sm">Total: {formatMoney(bill.total_amount)}</div>
                      <div className="text-sm">Paid: {formatMoney(bill.amount_paid)}</div>
                      <div className="text-sm">Balance: {formatMoney(bill.balance_amount)}</div>
                      <div><Badge variant={bill.status === "paid" ? "secondary" : "outline"}>{bill.status}</Badge></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="receipts" className="space-y-4 mt-6">
              <Card>
                <CardHeader><CardTitle>Receipts & Invoice</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {receipts.map((receipt) => (
                    <div key={receipt.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-md items-center">
                      <div className="font-medium text-sm">{receipt.receipt_number}</div>
                      <div className="text-sm">{receipt.students?.first_name} {receipt.students?.last_name}</div>
                      <div className="text-sm">{formatMoney(receipt.finance_transactions?.amount || 0)}</div>
                      <div className="text-sm">{new Date(receipt.issued_at).toLocaleString()}</div>
                      <div>
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                          <Receipt className="h-4 w-4 mr-1" /> Print
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Paystack and Finance Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 border rounded-md p-4 space-y-3">
                    <p className="text-sm font-medium">Create Paystack Subaccount</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Input
                        placeholder="Business name"
                        value={subaccountForm.businessName}
                        onChange={(e) => setSubaccountForm((prev) => ({ ...prev, businessName: e.target.value }))}
                      />
                      <Input
                        placeholder="Settlement bank code"
                        value={subaccountForm.settlementBank}
                        onChange={(e) => setSubaccountForm((prev) => ({ ...prev, settlementBank: e.target.value }))}
                      />
                      <Input
                        placeholder="Account number"
                        value={subaccountForm.accountNumber}
                        onChange={(e) => setSubaccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                      />
                    </div>
                    <Button variant="outline" onClick={() => handleAction(submitSubaccountCreation)}>
                      Create Subaccount via Paystack API
                    </Button>
                  </div>

                  <div>
                    <Label>Paystack Subaccount Code</Label>
                    <Input
                      placeholder="ACCT_xxxxx"
                      value={settings.paystack_subaccount_code || ""}
                      onChange={(e) => setSettings((prev) => ({ ...prev, paystack_subaccount_code: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Default Currency</Label>
                    <Input
                      placeholder="NGN"
                      value={settings.default_currency || "NGN"}
                      onChange={(e) => setSettings((prev) => ({ ...prev, default_currency: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Invoice Prefix</Label>
                    <Input
                      placeholder="INV"
                      value={settings.invoice_prefix || "INV"}
                      onChange={(e) => setSettings((prev) => ({ ...prev, invoice_prefix: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Receipt Prefix</Label>
                    <Input
                      placeholder="RCP"
                      value={settings.receipt_prefix || "RCP"}
                      onChange={(e) => setSettings((prev) => ({ ...prev, receipt_prefix: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-2 border rounded-md p-3">
                    <Users className="h-4 w-4 text-gray-500" />
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.enable_paystack_checkout ?? true}
                        onChange={(e) => setSettings((prev) => ({ ...prev, enable_paystack_checkout: e.target.checked }))}
                      />
                      Enable Paystack checkout for parents and students
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <Button onClick={() => handleAction(submitSettings)}>Save Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
