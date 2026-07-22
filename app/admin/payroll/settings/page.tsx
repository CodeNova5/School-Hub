"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSchoolContext } from "@/hooks/use-school-context";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Settings,
  Info,
  Landmark,
  Shield,
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

interface OverviewData {
  totalPaid: number;
  pendingPayments: number;
  totalPayments: number;
  totalSalaryBudget: number;
  teachersWithSubaccount: number;
  teachersConfigured: number;
  totalActiveTeachers: number;
}

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

// ─── Main component ──────────────────────────────────────────────────────────

export default function PayrollSettingsPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [teachers, setTeachers] = useState<TeacherPayroll[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "configured" | "not_configured">("all");

  // Salary editing
  const [editingSalary, setEditingSalary] = useState<Record<string, string>>({});
  const [savingSalary, setSavingSalary] = useState<string | null>(null);

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
      const [overviewData, teachersData] = await Promise.all([
        fetchJson<OverviewData>("/api/admin/payroll/overview"),
        fetchJson<TeacherPayroll[]>("/api/admin/payroll/settings"),
      ]);
      setOverview(overviewData);
      setTeachers(teachersData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (!schoolLoading && schoolId) loadData();
  }, [loadData, schoolId, schoolLoading]);

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
      toast.success("Salary saved successfully!");
      setEditingSalary((prev) => ({ ...prev, [teacherId]: "" }));
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSalary(null);
    }
  };

  // ── Bulk set salaries ──
  const handleBulkSetSalary = async () => {
    const teachersToSave = teachers.filter(
      (t) => editingSalary[t.id] !== undefined && editingSalary[t.id] !== "" && Number(editingSalary[t.id]) !== t.salary_amount
    );

    if (teachersToSave.length === 0) {
      toast.error("No salary changes to save");
      return;
    }

    toast.info(`Saving ${teachersToSave.length} salary change(s)...`);

    await Promise.all(
      teachersToSave.map((teacher) => {
        const amount = Number(editingSalary[teacher.id]);
        if (Number.isNaN(amount) || amount < 0) return Promise.resolve();
        return fetch("/api/admin/payroll/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacherId: teacher.id, salaryAmount: amount }),
        }).catch(() => null);
      })
    );

    toast.success(`${teachersToSave.length} salary change(s) saved!`);
    setEditingSalary({});
    await loadData();
  };

  // ── Filtered teachers ──
  const filteredTeachers = teachers
    .filter((t) => {
      const matchesSearch = `${t.first_name} ${t.last_name} ${t.staff_id} ${t.email}`.toLowerCase().includes(search.toLowerCase());
      if (filterStatus === "configured") return matchesSearch && !!t.paystack_subaccount_code;
      if (filterStatus === "not_configured") return matchesSearch && !t.paystack_subaccount_code;
      return matchesSearch;
    })
    .sort((a, b) => {
      // Sort by subaccount status: not configured first
      if (a.paystack_subaccount_code && !b.paystack_subaccount_code) return 1;
      if (!a.paystack_subaccount_code && b.paystack_subaccount_code) return -1;
      return a.last_name.localeCompare(b.last_name);
    });

  const configuredCount = teachers.filter((t) => t.paystack_subaccount_code).length;
  const notConfiguredCount = teachers.filter((t) => !t.paystack_subaccount_code).length;
  const hasUnsavedChanges = Object.values(editingSalary).some((v) => v !== undefined && v !== "");

  // ── Render ──
  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 rounded-xl"
              onClick={() => router.push("/admin/payroll")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
              <Settings className="h-6 w-6 text-sky-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payroll Settings</h1>
              <p className="text-sm text-slate-500">Configure teacher salaries and manage payment subaccounts.</p>
            </div>
          </div>
          {hasUnsavedChanges && (
            <Button
              className="gap-2 rounded-xl bg-sky-600 hover:bg-sky-700"
              onClick={handleBulkSetSalary}
            >
              <DollarSign className="h-4 w-4" />
              Save All Changes
            </Button>
          )}
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-red-700">{error}</CardContent>
          </Card>
        )}

        {loading || schoolLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
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
            {/* ── Stats ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Budget</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(overview?.totalSalaryBudget || 0)}</p>
                    <p className="mt-1 text-xs text-slate-500">Monthly payroll budget</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
                    <DollarSign className="h-6 w-6 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Subaccounts Ready</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{configuredCount} / {teachers.length}</p>
                    <p className="mt-1 text-xs text-slate-500">Teachers with Paystack subaccount</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                    <Landmark className="h-6 w-6 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Paid</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(overview?.totalPaid || 0)}</p>
                    <p className="mt-1 text-xs text-slate-500">All-time payments processed</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50">
                    <CheckCircle2 className="h-6 w-6 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Setup Guide ── */}
            {notConfiguredCount > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="py-4 px-5 flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Setup Required</p>
                    <p className="text-xs text-amber-700 mt-1">
                      <strong>{notConfiguredCount} teacher(s)</strong> haven&apos;t set up their Paystack subaccount yet.
                      They need to go to <strong>Settings → Payroll</strong> in their teacher portal and add their bank details to receive salary payments.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Teacher Salary Configuration ── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-base font-bold text-slate-900">Teacher Salary Configuration</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search teachers..."
                        className="h-9 w-48 rounded-xl border-slate-200 pl-9 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                    >
                      <option value="all">All ({teachers.length})</option>
                      <option value="configured">Subaccount Ready ({configuredCount})</option>
                      <option value="not_configured">Need Setup ({notConfiguredCount})</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Teacher</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Subaccount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Monthly Salary</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Total Paid</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredTeachers.map((teacher) => {
                        const initials = getInitials(teacher.first_name, teacher.last_name);
                        const avatarColor = getAvatarColor(`${teacher.first_name} ${teacher.last_name}`);
                        const hasSubaccount = !!teacher.paystack_subaccount_code;
                        const isEditing = editingSalary[teacher.id] !== undefined && editingSalary[teacher.id] !== "";
                        const hasChange = isEditing && Number(editingSalary[teacher.id]) !== teacher.salary_amount;

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
                            <td className="px-4 py-3">
                              {hasSubaccount ? (
                                <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>Ready</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-amber-700">
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>Not configured</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="number"
                                    className={`h-8 w-32 text-sm ${hasChange ? "border-sky-400 bg-sky-50" : ""}`}
                                    value={editingSalary[teacher.id]}
                                    onChange={(e) => setEditingSalary((prev) => ({ ...prev, [teacher.id]: e.target.value }))}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveSalary(teacher.id);
                                      if (e.key === "Escape") setEditingSalary((prev) => ({ ...prev, [teacher.id]: "" }));
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-xs text-sky-600 hover:text-sky-700"
                                    onClick={() => handleSaveSalary(teacher.id)}
                                    disabled={savingSalary === teacher.id}
                                  >
                                    {savingSalary === teacher.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      "Save"
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  className="font-medium text-slate-900 hover:text-sky-600 transition-colors"
                                  onClick={() => setEditingSalary((prev) => ({ ...prev, [teacher.id]: String(teacher.salary_amount || "") }))}
                                >
                                  {teacher.salary_amount > 0 ? formatMoney(teacher.salary_amount) : (
                                    <span className="text-slate-400 italic">Set salary</span>
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {teacher.total_paid > 0 ? formatMoney(teacher.total_paid) : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!hasSubaccount && (
                                <span className="text-[11px] text-amber-600 font-medium">
                                  Needs subaccount
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredTeachers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                            No teachers found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* ── How It Works ── */}
            <Card className="border-sky-200 bg-sky-50/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-sky-900">
                  <Shield className="h-4 w-4" />
                  How Teacher Payroll Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-sky-800 space-y-2">
                <p>1. <strong>Teachers</strong> set up their Paystack subaccount in their profile settings (add bank details)</p>
                <p>2. <strong>Admin</strong> sets each teacher&apos;s salary here in this settings page</p>
                <p>3. <strong>Admin</strong> processes payment via Paystack checkout → money routes directly to the teacher&apos;s subaccount (bank account)</p>
                <p>4. Payment is recorded automatically in the payment history</p>
                <div className="mt-2 p-3 bg-sky-100 rounded-lg text-sky-700">
                  <p className="font-medium">💡 Tip:</p>
                  <p>Each teacher must configure their Paystack subaccount before you can pay them. Direct them to their Settings page to set it up. Teachers without a subaccount will show &quot;Not configured&quot; in the table above.</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
