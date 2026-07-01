"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Plus,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Banknote,
  ArrowRight,
  SlidersHorizontal,
  RotateCcw,
  Search,
} from "lucide-react";
import type { FinanceBill, FeeTemplate, StudentOption, ClassOption } from "./finance-types";

interface BillingTabProps {
  bills: FinanceBill[];
  students: StudentOption[];
  fees: FeeTemplate[];
  classes: ClassOption[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

function getStatusBadge(status: string) {
  const config: Record<string, { color: string; icon: any; label: string }> = {
    paid: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Paid" },
    partial: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Partial" },
    pending: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Pending" },
    overdue: { color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle, label: "Overdue" },
    waived: { color: "bg-gray-50 text-gray-600 border-gray-200", icon: CheckCircle2, label: "Waived" },
    cancelled: { color: "bg-gray-50 text-gray-600 border-gray-200", icon: AlertTriangle, label: "Cancelled" },
  };
  const c = config[status] || { color: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock, label: status };
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${c.color}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </Badge>
  );
}

export function FinanceBillingTab({
  bills,
  students,
  fees,
  classes,
  formatMoney,
  onRefresh,
  onError,
}: BillingTabProps) {
  const [form, setForm] = useState({
    studentId: "",
    billingCycle: "per_term",
    dueDate: "",
    feeTemplateId: "",
    amount: "",
  });
  const [saving, setSaving] = useState(false);

  const feeTemplateLookup = useMemo(() => {
    const lookup = new Map<string, FeeTemplate>();
    fees.forEach((fee) => lookup.set(fee.id, fee));
    return lookup;
  }, [fees]);

  // ── Filter state ──
  // ── Class lookup for filtering ──
  const studentClassLookup = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (s.class_id) map.set(s.id, s.class_id);
    });
    return map;
  }, [students]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Status filter
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      // Student name search
      if (searchQuery.trim()) {
        const name = `${b.students?.first_name || ""} ${b.students?.last_name || ""}`.toLowerCase();
        if (!name.includes(searchQuery.trim().toLowerCase())) return false;
      }
      // Class filter
      if (classFilter !== "all") {
        const billStudentClassId = studentClassLookup.get(b.student_id);
        if (billStudentClassId !== classFilter) return false;
      }
      // Due date range
      if (dueDateFrom && b.due_date) {
        if (new Date(b.due_date) < new Date(dueDateFrom)) return false;
      }
      if (dueDateTo && b.due_date) {
        const end = new Date(dueDateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(b.due_date) > end) return false;
      }
      return true;
    });
  }, [bills, statusFilter, searchQuery, classFilter, studentClassLookup, dueDateFrom, dueDateTo]);

  const hasActiveFilter = statusFilter !== "all" || searchQuery.trim() || classFilter !== "all" || !!dueDateFrom || !!dueDateTo;

  // ── Pagination state ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const safePage = page > totalPages ? 1 : page;
  const paginatedBills = filteredBills.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedStudent = students.find((s) => s.id === form.studentId);

  const submitBill = async () => {
    if (!form.studentId || !form.amount) {
      throw new Error("Select student and amount to create bill");
    }

    setSaving(true);
    try {
      const student = students.find((s) => s.id === form.studentId);
      const selectedFee = form.feeTemplateId ? feeTemplateLookup.get(form.feeTemplateId) : null;

      const res = await fetch("/api/admin/finance/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: form.studentId,
          classId: student?.class_id,
          billingCycle: form.billingCycle,
          dueDate: form.dueDate || null,
          items: [
            {
              feeTemplateId: selectedFee?.id,
              title: selectedFee?.name || "Custom Fee",
              frequency: selectedFee?.frequency || form.billingCycle,
              amount: Number(form.amount),
              originalAmount: selectedFee?.amount || Number(form.amount),
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

      setForm({ studentId: "", billingCycle: "per_term", dueDate: "", feeTemplateId: "", amount: "" });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitBill();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Create Bill Card */}
      <Card className="overflow-hidden border-emerald-100 transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-emerald-50 bg-gradient-to-r from-emerald-50/50 to-white pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100">
              <Plus className="h-4 w-4 text-emerald-600" />
            </div>
            Create Student Bill
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Student</Label>
              <SearchableSelect
                value={form.studentId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, studentId: value }))}
                placeholder="Search for a student..."
                searchPlaceholder="Search by name or ID..."
                emptyMessage="No student found"
                options={students.map((s) => ({
                  value: s.id,
                  label: `${s.first_name} ${s.last_name} (${s.student_id})`,
                  searchTerms: `${s.first_name} ${s.last_name} ${s.student_id} ${s.last_name} ${s.first_name}`,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Fee Template</Label>
              <SearchableSelect
                value={form.feeTemplateId}
                onValueChange={(value) => {
                  const fee = feeTemplateLookup.get(value);
                  setForm((prev) => ({
                    ...prev,
                    feeTemplateId: value,
                    billingCycle: fee?.frequency || prev.billingCycle,
                    amount: fee ? String(fee.amount) : prev.amount,
                  }));
                }}
                placeholder="Search fee templates..."
                searchPlaceholder="Search by name..."
                emptyMessage="No fee template found"
                options={fees.map((fee) => ({
                  value: fee.id,
                  label: `${fee.name} — ${formatMoney(fee.amount)}`,
                  searchTerms: `${fee.name} ${fee.category} ${fee.frequency}`,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Billing Cycle</Label>
              <Select
                value={form.billingCycle}
                onValueChange={(value) => setForm((prev) => ({ ...prev, billingCycle: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_term">Per Term</SelectItem>
                  <SelectItem value="per_session">Per Session</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Amount (₦)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Due Date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Student info quick view */}
          {selectedStudent && (
            <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-3 text-sm">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">
                Billing: <span className="font-semibold text-gray-900">
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </span>
                <span className="text-gray-300 mx-1.5">·</span>
                ID: <span className="font-medium text-gray-700">{selectedStudent.student_id}</span>
              </span>
            </div>
          )}

          <div className="mt-4">
            <Button
              className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Bill...
                </>
              ) : (
                <>
                  <GraduationCap className="h-4 w-4" />
                  Create Bill
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Banknote className="h-4 w-4 text-gray-600" />
              </div>
              Student Bills
              {bills.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                  {bills.length}
                </span>
              )}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
            </Button>
          </div>

          {/* Filter controls */}
          {showFilters && (
            <div className="pt-3 space-y-3">
              {/* Student name search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search by student name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Class filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-gray-400">Class</span>
                <select
                  value={classFilter}
                  onChange={(e) => {
                    setClassFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 min-w-[140px]"
                >
                  <option value="all">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["all", "paid", "partial", "pending", "overdue", "waived", "cancelled"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                        statusFilter === s
                          ? s === "all"
                            ? "bg-gray-900 text-white border-gray-900"
                            : s === "paid"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : s === "overdue"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : s === "partial"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : s === "pending"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  )
                )}
              </div>

              {/* Due date range */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">Due from</span>
                  <Input
                    type="date"
                    value={dueDateFrom}
                    onChange={(e) => {
                      setDueDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
                <span className="text-[11px] text-gray-300">—</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">to</span>
                  <Input
                    type="date"
                    value={dueDateTo}
                    onChange={(e) => {
                      setDueDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
              </div>

              {hasActiveFilter && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      setStatusFilter("all");
                      setSearchQuery("");
                      setClassFilter("all");
                      setDueDateFrom("");
                      setDueDateTo("");
                      setPage(1);
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                  <span className="text-[10px] text-gray-400">
                    Showing {filteredBills.length} of {bills.length} bill{bills.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filteredBills.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {paginatedBills.map((bill) => {
                const paidPercent = bill.total_amount > 0
                  ? Math.round((bill.amount_paid / bill.total_amount) * 100)
                  : 0;
                const isFullyPaid = bill.status === "paid" || paidPercent >= 100;
                const isOverdue = bill.status === "overdue";
                const isPartial = bill.status === "partial" || (paidPercent > 0 && paidPercent < 100);

                return (
                  <div
                    key={bill.id}
                    className="px-5 py-4 transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isFullyPaid ? "bg-emerald-100" : isOverdue ? "bg-red-100" : "bg-amber-100"
                        }`}>
                          {isFullyPaid ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : isOverdue ? (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {bill.students?.first_name} {bill.students?.last_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            Due: {bill.due_date ? new Date(bill.due_date).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "No due date"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {getStatusBadge(bill.status)}
                      </div>
                    </div>

                    {/* Payment progress */}
                    <div className="ml-9 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Paid: <span className="font-semibold text-gray-700">{formatMoney(bill.amount_paid)}</span>
                        </span>
                        <span className="text-gray-500">
                          Balance: <span className={`font-semibold ${isFullyPaid ? "text-emerald-600" : isOverdue ? "text-red-600" : "text-amber-600"}`}>
                            {formatMoney(bill.balance_amount)}
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isFullyPaid
                              ? "bg-emerald-500"
                              : isOverdue
                              ? "bg-red-400"
                              : "bg-amber-400"
                          }`}
                          style={{ width: `${Math.min(100, paidPercent)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{formatMoney(bill.total_amount)} total</span>
                        <span>{paidPercent}% paid</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Banknote className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {bills.length === 0 ? "No bills created" : "No bills match filter"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {bills.length === 0
                  ? "Create a student bill above to get started"
                  : "Try selecting a different status"}
              </p>
            </div>
          )}

          {/* Pagination */}
          {filteredBills.length > pageSize && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-[11px] text-gray-400">
                  of {bills.length}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-[28px] px-1.5 text-xs rounded-md border transition-colors ${
                        p === page
                          ? "bg-gray-900 text-white border-gray-900"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
