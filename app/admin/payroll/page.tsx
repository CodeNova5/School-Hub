"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  DollarSign,
  Users,
  Wallet,
  Banknote,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  AlertTriangle,
  Shield,
  ExternalLink,
  Landmark,
  CreditCard,
  Clock,
  ArrowRight,
  Search,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

interface TeacherPayroll {
  id: string;
  first_name: string;
  last_name: string;
  staff_id: string;
  email: string;
  status: string;
  photo_url?: string;
  specialization?: string;
  paystack_subaccount_code?: string;
  salary_amount: number;
  payroll_active: boolean;
  total_paid: number;
}

interface PayrollPayment {
  id: string;
  teacher_id: string;
  amount: number;
  period_label: string;
  status: string;
  reference?: string;
  payment_method: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  teachers?: {
    id: string;
    first_name: string;
    last_name: string;
    staff_id: string;
    email: string;
    photo_url?: string;
  };
}

interface OverviewData {
  totalPaid: number;
  pendingPayments: number;
  totalPayments: number;
  totalSalaryBudget: number;
  teachersWithSubaccount: number;
  teachersConfigured: number;
  totalActiveTeachers: number;
}

export default function AdminPayrollPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [teachers, setTeachers] = useState<TeacherPayroll[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [search, setSearch] = useState("");

  // Salary editing
  const [editingSalary, setEditingSalary] = useState<Record<string, string>>({});
  const [savingSalary, setSavingSalary] = useState<string | null>(null);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    teacherId: "",
    amount: "",
    periodLabel: "",
  });
  const [processingPayment, setProcessingPayment] = useState(false);

  const fetchJson = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    const payload = (await res.json()) as { success?: boolean; data?: T; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Request failed");
    }
    return payload.data as T;
  };

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const [overviewData, teachersData, paymentsData] = await Promise.all([
        fetchJson<OverviewData>("/api/admin/payroll/overview"),
        fetchJson<TeacherPayroll[]>("/api/admin/payroll/settings"),
        fetchJson<PayrollPayment[]>("/api/admin/payroll/payments"),
      ]);
      setOverview(overviewData);
      setTeachers(teachersData);
      setPayments(paymentsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolLoading && schoolId) loadData();
  }, [loadData, schoolId, schoolLoading]);

  const formatMoney = (value: number) =>
    `NGN ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const filteredTeachers = teachers.filter((t) =>
    `${t.first_name} ${t.last_name} ${t.staff_id}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Save salary ──
  const handleSaveSalary = async (teacherId: string) => {
    const amount = Number(editingSalary[teacherId]);
    if (Number.isNaN(amount) || amount < 0) {
      toast.error("Please enter a valid salary amount");
      return;
    }
    setSavingSalary(teacherId);
    try {
      const res = await fetch("/api/admin/payroll/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, salaryAmount: amount }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to save");
      toast.success("Salary saved!");
      setEditingSalary((prev) => ({ ...prev, [teacherId]: "" }));
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSalary(null);
    }
  };

  // ── Initialize payment ──
  const handlePayNow = async () => {
    if (!paymentForm.teacherId || !paymentForm.amount) {
      toast.error("Select a teacher and enter amount");
      return;
    }
    const amount = Number(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setProcessingPayment(true);
    try {
      const callbackUrl = `${window.location.origin}/admin/payroll`;
      const res = await fetch("/api/admin/payroll/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: paymentForm.teacherId,
          amount,
          periodLabel: paymentForm.periodLabel || `${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Salary`,
          callbackUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to initialize payment");
      }
      window.location.href = payload.data.authorizationUrl as string;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessingPayment(false);
    }
  };

  // ── Verify on return ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (reference) {
      verifyPayment(reference);
    }
  }, []);

  const verifyPayment = async (reference: string) => {
    try {
      const res = await fetch(`/api/admin/payroll/payments/verify?reference=${encodeURIComponent(reference)}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Verification failed");
      }
      toast.success("Payment verified successfully!");
      // Clear URL params
      window.history.replaceState({}, "", "/admin/payroll");
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "secondary" | "outline" | "default"; class: string; label: string }> = {
      success: { variant: "secondary", class: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Paid" },
      pending: { variant: "outline", class: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending" },
      failed: { variant: "outline", class: "bg-red-100 text-red-800 border-red-200", label: "Failed" },
      cancelled: { variant: "outline", class: "bg-slate-100 text-slate-600 border-slate-200", label: "Cancelled" },
      reversed: { variant: "outline", class: "bg-purple-100 text-purple-800 border-purple-200", label: "Reversed" },
    };
    const v = variants[status] || variants.pending;
    return <Badge className={`${v.class} rounded-full px-3 py-1`}>{v.label}</Badge>;
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payroll</h1>
            <p className="text-gray-600">Manage teacher salaries and process salary payments.</p>
          </div>
          <Button onClick={loadData} variant="outline" className="gap-2">
            <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-red-700">{error}</CardContent>
          </Card>
        )}

        {loading || schoolLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">Loading payroll module...</CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="salaries">Salaries & Settings</TabsTrigger>
              <TabsTrigger value="payments">Payments & History</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Total Paid</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    {formatMoney(overview?.totalPaid || 0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Monthly Budget</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    {formatMoney(overview?.totalSalaryBudget || 0)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">Teachers Configured</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    {overview?.teachersConfigured || 0} / {overview?.totalActiveTeachers || 0}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-600">With Subaccount</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-amber-600" />
                    {overview?.teachersWithSubaccount || 0}
                  </CardContent>
                </Card>
              </div>

              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-blue-900 font-semibold">
                    <Sparkles className="h-4 w-4" />
                    How Teacher Payroll Works
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-800 space-y-2">
                  <p>1. <strong>Teachers</strong> set up their Paystack subaccount in their profile settings (add bank details)</p>
                  <p>2. <strong>Admin</strong> sets each teacher's salary in the Salaries tab</p>
                  <p>3. <strong>Admin</strong> processes payment via Paystack checkout → money routes directly to the teacher's subaccount (bank account)</p>
                  <p>4. Payment is recorded automatically in the payment history</p>
                  <div className="mt-2 p-3 bg-blue-100 rounded-lg text-blue-700">
                    <p className="font-medium">💡 Tip:</p>
                    <p>Each teacher must configure their Paystack subaccount before you can pay them. Direct them to their Settings page to set it up.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── SALARIES TAB ── */}
            <TabsContent value="salaries" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Teacher Salary Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="Search teachers..."
                      className="pl-10"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    {filteredTeachers.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 border rounded-xl items-center"
                      >
                        {/* Teacher info */}
                        <div className="md:col-span-4">
                          <p className="font-semibold text-gray-900">
                            {teacher.first_name} {teacher.last_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                              {teacher.staff_id}
                            </code>
                            <Badge
                              variant={teacher.status === "active" ? "secondary" : "outline"}
                              className="text-[10px]"
                            >
                              {teacher.status}
                            </Badge>
                          </div>
                        </div>

                        {/* Subaccount status */}
                        <div className="md:col-span-2">
                          {teacher.paystack_subaccount_code ? (
                            <div className="flex items-center gap-1 text-xs text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Subaccount ready</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-amber-700">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Not configured</span>
                            </div>
                          )}
                        </div>

                        {/* Salary input */}
                        <div className="md:col-span-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Salary:</span>
                            <Input
                              type="number"
                              className="h-9 w-32 text-sm"
                              placeholder={String(teacher.salary_amount || 0)}
                              value={
                                editingSalary[teacher.id] !== undefined
                                  ? editingSalary[teacher.id]
                                  : teacher.salary_amount > 0
                                    ? String(teacher.salary_amount)
                                    : ""
                              }
                              onChange={(e) =>
                                setEditingSalary((prev) => ({ ...prev, [teacher.id]: e.target.value }))
                              }
                            />
                          </div>
                          {teacher.total_paid > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Total paid: {formatMoney(teacher.total_paid)}
                            </p>
                          )}
                        </div>

                        {/* Save button */}
                        <div className="md:col-span-3 flex justify-end">
                          <Button
                            size="sm"
                            disabled={
                              savingSalary === teacher.id ||
                              (editingSalary[teacher.id] === undefined || editingSalary[teacher.id] === "")
                            }
                            onClick={() => handleSaveSalary(teacher.id)}
                            className="rounded-xl"
                          >
                            {savingSalary === teacher.id ? (
                              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving</>
                            ) : (
                              "Set Salary"
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}

                    {filteredTeachers.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-8">No teachers found.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── PAYMENTS TAB ── */}
            <TabsContent value="payments" className="space-y-4 mt-6">
              {/* Payment form */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Process Salary Payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <Label>Teacher</Label>
                      <select
                        className="w-full h-10 rounded-md border px-3 text-sm"
                        value={paymentForm.teacherId}
                        onChange={(e) => {
                          const teacher = teachers.find((t) => t.id === e.target.value);
                          setPaymentForm((prev) => ({
                            ...prev,
                            teacherId: e.target.value,
                            amount: teacher?.salary_amount ? String(teacher.salary_amount) : prev.amount,
                            periodLabel: `${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Salary`,
                          }));
                        }}
                      >
                        <option value="">Select teacher...</option>
                        {teachers
                          .filter((t) => t.status === "active")
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.first_name} {t.last_name}
                              {!t.paystack_subaccount_code ? " (⚠️ No subaccount)" : ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <Label>Amount (NGN)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Period</Label>
                      <Input
                        placeholder="e.g. January 2025"
                        value={paymentForm.periodLabel}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, periodLabel: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        className="w-full gap-2"
                        onClick={handlePayNow}
                        disabled={processingPayment}
                      >
                        {processingPayment ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                        ) : (
                          <><ExternalLink className="h-4 w-4" /> Pay via Paystack</>
                        )}
                      </Button>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={async () => {
                          if (!paymentForm.teacherId || !paymentForm.amount) {
                            toast.error("Select teacher and enter amount");
                            return;
                          }
                          try {
                            const res = await fetch("/api/admin/payroll/payments", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                teacherId: paymentForm.teacherId,
                                amount: Number(paymentForm.amount),
                                periodLabel: paymentForm.periodLabel || `${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Salary`,
                                paymentMethod: "bank_transfer",
                                notes: "Manual offline payment",
                              }),
                            });
                            const payload = await res.json();
                            if (!res.ok || !payload.success) {
                              throw new Error(payload.error || "Failed to record");
                            }
                            toast.success("Payment recorded as offline");
                            setPaymentForm({ teacherId: "", amount: "", periodLabel: "" });
                            await loadData();
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Failed");
                          }
                        }}
                      >
                        <Banknote className="h-4 w-4" /> Record Offline
                      </Button>
                    </div>
                  </div>
                  {paymentForm.teacherId && (() => {
                    const teacher = teachers.find((t) => t.id === paymentForm.teacherId);
                    if (!teacher?.paystack_subaccount_code) {
                      return (
                        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          This teacher has not configured their Paystack subaccount. They need to set up their bank details in their teacher settings first.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {payments.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No payments yet.</p>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 border rounded-xl items-center"
                      >
                        <div className="md:col-span-2">
                          <p className="font-medium text-sm">
                            {payment.teachers?.first_name} {payment.teachers?.last_name}
                          </p>
                          <p className="text-xs text-gray-500">{payment.teachers?.staff_id}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{formatMoney(payment.amount)}</p>
                        </div>
                        <div className="text-sm text-gray-600">{payment.period_label}</div>
                        <div>{getStatusBadge(payment.status)}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {payment.paid_at
                            ? new Date(payment.paid_at).toLocaleDateString()
                            : new Date(payment.created_at).toLocaleDateString()}
                          {payment.payment_method !== "paystack" && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {payment.payment_method}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
