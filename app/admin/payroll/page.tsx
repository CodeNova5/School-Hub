"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useSchoolContext } from "@/hooks/use-school-context";
import { useRouter } from "next/navigation";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import {
  DollarSign,
  Users,
  Wallet,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  CreditCard,
  Search,
  Calendar,
  Settings,
  Plus,
  Download,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Donut chart config ──────────────────────────────────────────────────────

const DONUT_CONFIG = {
  paid: { label: "Paid", color: "#22c55e" },
  pending: { label: "Pending", color: "#f97316" },
  deductions: { label: "Other Deductions", color: "#3b82f6" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(value: number) {
  return `NGN ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getInitials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-purple-500",
    "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "success" || status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
        Paid
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 border border-amber-200">
        Pending
      </span>
    );
  }
  if (status === "failed" || status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 border border-red-200">
        {status === "failed" ? "Failed" : "Cancelled"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 border border-slate-200">
      {status}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminPayrollPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [teachers, setTeachers] = useState<TeacherPayroll[]>([]);
  const [payments, setPayments] = useState<PayrollPayment[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })
  );

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

  // ── Verify on return from Paystack ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (reference) verifyPayment(reference);
  }, []);

  const verifyPayment = async (reference: string) => {
    try {
      const res = await fetch(`/api/admin/payroll/payments/verify?reference=${encodeURIComponent(reference)}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.error || "Verification failed");
      toast.success("Payment verified successfully!");
      window.history.replaceState({}, "", "/admin/payroll");
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    }
  };

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

  // ── Pay via Paystack ──
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
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to initialize payment");
      window.location.href = payload.data.authorizationUrl as string;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessingPayment(false);
    }
  };

  // ── Computed values ──
  const filteredTeachers = teachers.filter((t) =>
    `${t.first_name} ${t.last_name} ${t.staff_id} ${t.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalPayrollThisMonth = overview?.totalSalaryBudget || 0;
  const totalTeachers = overview?.totalActiveTeachers || 0;
  const averageSalary = totalTeachers > 0 ? totalPayrollThisMonth / totalTeachers : 0;
  const paymentsThisMonth = payments.filter((p) => {
    if (p.status !== "success" && p.status !== "paid") return false;
    const d = new Date(p.paid_at || p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const paidTotal = overview?.totalPaid || 0;
  const pendingTotal = overview?.pendingPayments || 0;
  const otherDeductions = Math.max(0, totalPayrollThisMonth - paidTotal - pendingTotal);

  const donutData = [
    { name: "Paid", value: paidTotal, fill: DONUT_CONFIG.paid.color },
    { name: "Pending", value: pendingTotal, fill: DONUT_CONFIG.pending.color },
    { name: "Other Deductions", value: otherDeductions, fill: DONUT_CONFIG.deductions.color },
  ].filter((d) => d.value > 0);

  const recentPaidPayments = payments
    .filter((p) => p.status === "success" || p.status === "paid")
    .slice(0, 5);

  // ── Render ──
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
              <DollarSign className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payroll</h1>
              <p className="text-sm text-slate-500">Manage teacher salaries and process salary payments.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={() => router.push("/admin/payroll/settings")}>
              <Settings className="h-4 w-4" />
              Payroll Settings
            </Button>
            <Button className="gap-2 rounded-xl bg-sky-600 hover:bg-sky-700" onClick={() => document.getElementById("payroll-form")?.scrollIntoView({ behavior: "smooth" })}>
              <Plus className="h-4 w-4" />
              Process Payroll
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-red-700">{error}</CardContent>
          </Card>
        )}

        {loading || schoolLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 w-24 bg-slate-200 rounded mb-3" />
                  <div className="h-8 w-32 bg-slate-200 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Payroll This Month</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(totalPayrollThisMonth)}</p>
                    <p className="mt-1 text-xs text-slate-500">For {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Teachers</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{totalTeachers}</p>
                    <p className="mt-1 text-xs text-slate-500">Active Teachers</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Average Salary</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(averageSalary)}</p>
                    <p className="mt-1 text-xs text-slate-500">Per Teacher</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                    <Wallet className="h-6 w-6 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Payments This Month</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{paymentsThisMonth}</p>
                    <p className="mt-1 text-xs text-slate-500">Completed Payments</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Main content grid: Table + Sidebar ── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* ── Teacher Salaries Table ── */}
              <div className="xl:col-span-2">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <CardTitle className="text-base font-bold text-slate-900">Teacher Salaries</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            placeholder="Search teacher..."
                            className="h-9 w-48 rounded-xl border-slate-200 pl-9 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                        >
                          <option>{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>
                          <option>{new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>
                        </select>
                        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
                          <Download className="h-3.5 w-3.5" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Teacher</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Position</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Salary</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Payment Date</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredTeachers.slice(0, 10).map((teacher) => {
                            const teacherPayments = payments.filter(
                              (p) => p.teacher_id === teacher.id && (p.status === "success" || p.status === "paid")
                            );
                            const lastPayment = teacherPayments[0];
                            const initials = getInitials(teacher.first_name, teacher.last_name);
                            const avatarColor = getAvatarColor(`${teacher.first_name} ${teacher.last_name}`);

                            return (
                              <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white text-xs font-bold ${avatarColor}`}>
                                      {teacher.photo_url ? (
                                        <img src={teacher.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                                      ) : (
                                        initials
                                      )}
                                    </div>
                                    <div>
                                      <p className="font-semibold text-slate-900">{teacher.first_name} {teacher.last_name}</p>
                                      <p className="text-xs text-slate-500">{teacher.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">{teacher.specialization || "—"}</td>
                                <td className="px-4 py-3">
                                  {editingSalary[teacher.id] !== undefined && editingSalary[teacher.id] !== "" ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        className="h-8 w-28 text-sm"
                                        value={editingSalary[teacher.id]}
                                        onChange={(e) => setEditingSalary((prev) => ({ ...prev, [teacher.id]: e.target.value }))}
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 text-xs"
                                        onClick={() => handleSaveSalary(teacher.id)}
                                        disabled={savingSalary === teacher.id}
                                      >
                                        {savingSalary === teacher.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      className="font-medium text-slate-900 hover:text-sky-600 transition-colors"
                                      onClick={() => setEditingSalary((prev) => ({ ...prev, [teacher.id]: String(teacher.salary_amount || "") }))}
                                    >
                                      {teacher.salary_amount > 0 ? formatMoney(teacher.salary_amount) : "Set Salary"}
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusBadge status={lastPayment?.status || "pending"} />
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">
                                  {lastPayment?.paid_at
                                    ? new Date(lastPayment.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "—"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {(!teacher.paystack_subaccount_code || teacher.status !== "active") ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-lg text-xs"
                                      onClick={() => {
                                        toast.error(!teacher.paystack_subaccount_code
                                          ? "This teacher hasn't set up their payment details yet."
                                          : "Teacher account is not active.");
                                      }}
                                    >
                                      {!teacher.paystack_subaccount_code ? "No Subaccount" : "Inactive"}
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-lg text-xs gap-1"
                                      onClick={() => {
                                        setPaymentForm({
                                          teacherId: teacher.id,
                                          amount: String(teacher.salary_amount || ""),
                                          periodLabel: `${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} Salary`,
                                        });
                                      }}
                                    >
                                      <DollarSign className="h-3.5 w-3.5" />
                                      Pay
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredTeachers.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                                No teachers found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filteredTeachers.length > 0 && (
                      <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
                        <span>Showing 1 to {Math.min(10, filteredTeachers.length)} of {filteredTeachers.length} teachers</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Sidebar ── */}
              <div className="space-y-6">
                {/* Payroll Summary Donut */}
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-slate-900">Payroll Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <div className="relative">
                      <ChartContainer config={DONUT_CONFIG} className="h-[180px] w-[180px]">
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {donutData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => formatMoney(Number(value))}
                              />
                            }
                          />
                        </PieChart>
                      </ChartContainer>
                      {/* Center label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-lg font-bold text-slate-900">{formatMoney(totalPayrollThisMonth)}</p>
                        <p className="text-[10px] text-slate-500">Total Payroll</p>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="mt-3 w-full space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          <span className="text-slate-600">Paid</span>
                        </div>
                        <span className="font-medium text-slate-900">
                          {formatMoney(paidTotal)} ({totalPayrollThisMonth > 0 ? Math.round((paidTotal / totalPayrollThisMonth) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                          <span className="text-slate-600">Pending</span>
                        </div>
                        <span className="font-medium text-slate-900">
                          {formatMoney(pendingTotal)} ({totalPayrollThisMonth > 0 ? Math.round((pendingTotal / totalPayrollThisMonth) * 100) : 0}%)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                          <span className="text-slate-600">Other Deductions</span>
                        </div>
                        <span className="font-medium text-slate-900">
                          {formatMoney(otherDeductions)} ({totalPayrollThisMonth > 0 ? Math.round((otherDeductions / totalPayrollThisMonth) * 100) : 0}%)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Payments */}
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-slate-900">Recent Payments</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentPaidPayments.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4">No recent payments</p>
                    ) : (
                      recentPaidPayments.map((payment) => {
                        const t = payment.teachers;
                        const name = t ? `${t.first_name} ${t.last_name}` : "Unknown";
                        const initials = t ? getInitials(t.first_name, t.last_name) : "??";
                        const avatarColor = getAvatarColor(name);
                        return (
                          <div key={payment.id} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-[10px] font-bold ${avatarColor}`}>
                                {t?.photo_url ? (
                                  <img src={t.photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{name}</p>
                                <p className="text-xs text-emerald-600 font-medium">{formatMoney(payment.amount)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-slate-400">
                                {new Date(payment.paid_at || payment.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                              <StatusBadge status="paid" />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ── Payment Form Card ── */}
            <div id="payroll-form">
              <Card className="border-sky-200 bg-sky-50/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold text-sky-900">
                    <CreditCard className="h-4 w-4" />
                    Process Salary Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Teacher</label>
                      <select
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
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
                        {teachers.filter((t) => t.status === "active").map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.first_name} {t.last_name}{!t.paystack_subaccount_code ? " (⚠️ No subaccount)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Amount (NGN)</label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">Period</label>
                      <Input
                        placeholder="e.g. January 2025"
                        value={paymentForm.periodLabel}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, periodLabel: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button className="flex-1 gap-2 rounded-xl bg-sky-600 hover:bg-sky-700" onClick={handlePayNow} disabled={processingPayment}>
                        {processingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                        Pay via Paystack
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={() => setPaymentForm({ teacherId: "", amount: "", periodLabel: "" })}>
                        Close
                      </Button>
                    </div>
                  </div>
                  {(() => {
                    const teacher = teachers.find((t) => t.id === paymentForm.teacherId);
                    if (!teacher?.paystack_subaccount_code) {
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          This teacher has not configured their Paystack subaccount. They need to set up their bank details in their teacher settings first.
                        </div>
                      );
                    }
                    return null;
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* ── Payroll Information ── */}
            <Card className="border-sky-100 bg-sky-50/50 shadow-sm">
              <CardContent className="py-4 px-5 flex items-start gap-3">
                <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sky-900">Payroll Information</p>
                  <p className="text-xs text-sky-700 mt-1">
                    Salaries are usually processed on the 5th of every month. Make sure all teacher information is up to date before processing payroll.
                    {teachers.filter((t) => !t.paystack_subaccount_code && t.status === "active").length > 0 && (
                      <span className="font-medium"> {teachers.filter((t) => !t.paystack_subaccount_code && t.status === "active").length} teacher(s) still need to set up their payment details.</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
