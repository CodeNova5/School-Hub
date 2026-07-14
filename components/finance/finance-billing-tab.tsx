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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDesc,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertTitle,
} from "@/components/ui/alert-dialog";
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
  SlidersHorizontal,
  RotateCcw,
  Search,
  Layers,
  ArrowUpRight,
  PencilLine,
  Trash2,
  School,
  Sparkles,
  UserPlus,
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
  onTabChange?: (tab: string) => void;
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
  onTabChange,
}: BillingTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<FinanceBill | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    billingCycle: "per_term",
    dueDate: "",
    feeTemplateId: "",
    amount: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<FinanceBill | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Bulk billing state ──
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    classId: "",
    feeTemplateId: "",
    billingCycle: "per_term" as "per_term" | "per_session" | "one_time",
    dueDate: "",
  });
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; skipped: number; message: string } | null>(null);

  const feeTemplateLookup = useMemo(() => {
    const lookup = new Map<string, FeeTemplate>();
    fees.forEach((fee) => lookup.set(fee.id, fee));
    return lookup;
  }, [fees]);

  // ── Filter state ──
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
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const name = `${b.students?.first_name || ""} ${b.students?.last_name || ""}`.toLowerCase();
        if (!name.includes(searchQuery.trim().toLowerCase())) return false;
      }
      if (classFilter !== "all") {
        const billStudentClassId = studentClassLookup.get(b.student_id);
        if (billStudentClassId !== classFilter) return false;
      }
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
  // Get student count per class for bulk billing summary
  const studentsByClass = useMemo(() => {
    const map = new Map<string, StudentOption[]>();
    students.forEach((s) => {
      const cid = s.class_id || "";
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(s);
    });
    return map;
  }, [students]);

  // Resolve the effective amount for a fee template on a specific class
  const getFeeAmountForClass = (feeTemplateId: string, classId: string): number => {
    const fee = feeTemplateLookup.get(feeTemplateId);
    if (!fee) return 0;
    const classOverride = (fee.finance_fee_template_classes || []).find(
      (c) => c.class_id === classId
    );
    return classOverride ? Number(classOverride.class_amount) : Number(fee.amount);
  };

  const selectedBulkFee = bulkForm.feeTemplateId ? feeTemplateLookup.get(bulkForm.feeTemplateId) : null;
  const selectedClassStudents = bulkForm.classId ? studentsByClass.get(bulkForm.classId) || [] : [];
  const effectiveAmount = bulkForm.feeTemplateId && bulkForm.classId
    ? getFeeAmountForClass(bulkForm.feeTemplateId, bulkForm.classId)
    : 0;
  const bulkTotal = effectiveAmount * selectedClassStudents.length;

  const resetBulkForm = () => {
    setBulkForm({ classId: "", feeTemplateId: "", billingCycle: "per_term", dueDate: "" });
    setBulkResult(null);
  };

  const handleBulkSubmit = async () => {
    if (!bulkForm.classId) {
      onError("Please select a class");
      return;
    }
    if (!bulkForm.feeTemplateId) {
      onError("Please select a fee template");
      return;
    }
    if (selectedClassStudents.length === 0) {
      onError("No active students found in this class");
      return;
    }
    if (effectiveAmount <= 0) {
      onError("Fee template has no valid amount for this class");
      return;
    }

    setBulkSaving(true);
    setBulkResult(null);

    try {
      const res = await fetch("/api/admin/finance/billing/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: bulkForm.classId,
          feeTemplateId: bulkForm.feeTemplateId,
          billingCycle: bulkForm.billingCycle,
          dueDate: bulkForm.dueDate || null,
        }),
      });

      const payload = (await res.json()) as {
        success?: boolean;
        data?: { created: number; skipped: number; message: string };
        error?: string;
      };

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create bills");
      }

      setBulkResult(payload.data!);

      if (payload.data!.created > 0) {
        await onRefresh();
      }
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to create class bills");
    } finally {
      setBulkSaving(false);
    }
  };

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const safePage = page > totalPages ? 1 : page;
  const paginatedBills = filteredBills.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selectedStudent = students.find((s) => s.id === form.studentId);

  const isEditing = !!editingBill;

  const resetForm = () => {
    setForm({ studentId: "", billingCycle: "per_term", dueDate: "", feeTemplateId: "", amount: "" });
    setEditingBill(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (bill: FinanceBill) => {
    setEditingBill(bill);
    // Derive fee template from first bill item if present
    const firstItem =
      bill.finance_bill_items && bill.finance_bill_items.length > 0
        ? bill.finance_bill_items[0]
        : null;
    const matchedFee = firstItem
      ? fees.find((f) => f.id === firstItem.fee_template_id)
      : null;

    setForm({
      studentId: bill.student_id,
      billingCycle: bill.billing_cycle,
      dueDate: bill.due_date || "",
      feeTemplateId: matchedFee?.id || "",
      amount: firstItem ? String(firstItem.amount) : "",
    });
    setModalOpen(true);
  };

  const submitBill = async () => {
    if (!form.studentId || !form.amount) {
      throw new Error("Select student and amount to create bill");
    }

    setSaving(true);
    try {
      const student = students.find((s) => s.id === form.studentId);
      const selectedFee = form.feeTemplateId ? feeTemplateLookup.get(form.feeTemplateId) : null;

      const payload = {
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
      };

      if (isEditing && editingBill) {
        // Update existing bill
        const res = await fetch("/api/admin/finance/billing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingBill.id }),
        });
        const result = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Failed to update bill");
        }
      } else {
        // Create new bill
        const res = await fetch("/api/admin/finance/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Failed to create bill");
        }
      }

      resetForm();
      setModalOpen(false);
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

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/finance/billing?id=${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to delete bill");
      }
      setDeleteConfirm(null);
      await onRefresh();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to delete bill");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Navigation hint — no fees created yet */}
      {fees.length === 0 && onTabChange && (
        <Card className="border-amber-200 bg-amber-50/50 overflow-hidden">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p className="text-xs text-amber-700 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              No fee templates exist yet. Create fee templates first before billing students.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100"
              onClick={() => onTabChange("fees")}
            >
              Go to Fees
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

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
            <div className="flex items-center gap-2">
              {/* Bill Entire Class button */}
              <Dialog open={bulkModalOpen} onOpenChange={(open) => { setBulkModalOpen(open); if (!open) resetBulkForm(); }}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700"
                    disabled={fees.length === 0 || classes.length === 0}
                  >
                    <School className="h-3.5 w-3.5" />
                    Bill Entire Class
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <div className="p-1 rounded-lg bg-indigo-100">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                      </div>
                      Bill Entire Class
                    </DialogTitle>
                    <DialogDescription>
                      Create bills for all active students in a class at once.
                      Students who already have active bills for this cycle will be skipped.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    {/* Class selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Class</Label>
                      <Select
                        value={bulkForm.classId}
                        onValueChange={(value) => setBulkForm((prev) => ({ ...prev, classId: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a class..." />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <School className="h-3.5 w-3.5 text-gray-400" />
                                {c.name}
                                <span className="text-[10px] text-gray-400 ml-auto">
                                  {studentsByClass.get(c.id)?.length || 0} students
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {bulkForm.classId && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <UserPlus className="h-3 w-3" />
                          {selectedClassStudents.length} active student{selectedClassStudents.length !== 1 ? "s" : ""} in this class
                        </p>
                      )}
                    </div>

                    {/* Fee template selector */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Fee Template</Label>
                      <Select
                        value={bulkForm.feeTemplateId}
                        onValueChange={(value) => {
                          const fee = feeTemplateLookup.get(value);
                          setBulkForm((prev) => ({
                            ...prev,
                            feeTemplateId: value,
                            billingCycle: (fee?.frequency as "per_term" | "per_session" | "one_time") || prev.billingCycle,
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a fee template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fees.map((fee) => {
                            const amountForClass = bulkForm.classId
                              ? getFeeAmountForClass(fee.id, bulkForm.classId)
                              : Number(fee.amount);
                            return (
                              <SelectItem key={fee.id} value={fee.id}>
                                <span className="flex items-center gap-2">
                                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                                  {fee.name}
                                  <span className="text-[10px] font-mono text-gray-500 ml-auto">
                                    {formatMoney(amountForClass)}
                                  </span>
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {selectedBulkFee && bulkForm.classId && effectiveAmount > 0 && (
                        <p className="text-[10px] text-gray-400">
                          Per student: <span className="font-semibold text-gray-700">{formatMoney(effectiveAmount)}</span>
                          {selectedBulkFee.finance_fee_template_classes?.some(
                            (c) => c.class_id === bulkForm.classId
                          ) && (
                            <span className="ml-1 text-indigo-500">(class-specific pricing)</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Billing cycle + Due date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Billing Cycle</Label>
                        <Select
                          value={bulkForm.billingCycle}
                          onValueChange={(value) =>
                            setBulkForm((prev) => ({
                              ...prev,
                              billingCycle: value as "per_term" | "per_session" | "one_time",
                            }))
                          }
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
                        <Label className="text-xs font-medium text-gray-600">Due Date</Label>
                        <Input
                          type="date"
                          value={bulkForm.dueDate}
                          onChange={(e) => setBulkForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Summary Card */}
                    {bulkForm.classId && selectedBulkFee && selectedClassStudents.length > 0 && (
                      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Students to bill</span>
                          <span className="font-semibold text-gray-900">{selectedClassStudents.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Fee per student</span>
                          <span className="font-semibold text-gray-900">{formatMoney(effectiveAmount)}</span>
                        </div>
                        <div className="border-t border-indigo-100 pt-2 flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">Total bill value</span>
                          <span className="font-bold text-indigo-700 text-sm">{formatMoney(bulkTotal)}</span>
                        </div>
                      </div>
                    )}

                    {/* Result banner */}
                    {bulkResult && (
                      <div
                        className={`p-3 rounded-lg border text-sm ${
                          bulkResult.created > 0
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-amber-50 border-amber-200 text-amber-800"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {bulkResult.created > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-xs">
                              {bulkResult.created > 0
                                ? `Created ${bulkResult.created} bill${bulkResult.created !== 1 ? "s" : ""} successfully!`
                                : "No new bills created"}
                            </p>
                            <p className="text-[10px] mt-0.5 opacity-80">{bulkResult.message}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    {bulkResult?.created ? (
                      <Button onClick={() => { setBulkModalOpen(false); resetBulkForm(); }}>
                        Done
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => { setBulkModalOpen(false); resetBulkForm(); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                          onClick={handleBulkSubmit}
                          disabled={bulkSaving || !bulkForm.classId || !bulkForm.feeTemplateId || selectedClassStudents.length === 0}
                        >
                          {bulkSaving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Creating Bills...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              Create {selectedClassStudents.length} Bill{selectedClassStudents.length !== 1 ? "s" : ""}
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

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

              <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5" />
                    {isEditing ? "Edit Bill" : "Create Bill"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <div className={`p-1 rounded-lg ${isEditing ? "bg-amber-100" : "bg-emerald-100"}`}>
                        {isEditing ? (
                          <PencilLine className="h-4 w-4 text-amber-600" />
                        ) : (
                          <GraduationCap className="h-4 w-4 text-emerald-600" />
                        )}
                      </div>
                      {isEditing ? "Edit Student Bill" : "Create Student Bill"}
                    </DialogTitle>
                    <DialogDescription>
                      {isEditing
                        ? "Update the bill details and amount."
                        : "Issue a bill to a student for fees or custom amount."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-3 text-sm">
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
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button
                      className={`gap-2 text-white ${
                        isEditing
                          ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                          : "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                      }`}
                      onClick={handleSubmit}
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {isEditing ? "Updating Bill..." : "Creating Bill..."}
                        </>
                      ) : (
                        <>
                          {isEditing ? <PencilLine className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                          {isEditing ? "Update Bill" : "Create Bill"}
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Class filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-gray-400">Class</span>
                <select
                  value={classFilter}
                  onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}
                  className="h-8 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300 min-w-[140px]"
                >
                  <option value="all">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["all", "paid", "partial", "pending", "overdue", "waived", "cancelled"].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                      statusFilter === s
                        ? s === "all" ? "bg-gray-900 text-white border-gray-900"
                          : s === "paid" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : s === "overdue" ? "bg-red-100 text-red-800 border-red-300"
                          : s === "partial" ? "bg-amber-100 text-amber-800 border-amber-300"
                          : s === "pending" ? "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-gray-100 text-gray-700 border-gray-300"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Due date range */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">Due from</span>
                  <Input type="date" value={dueDateFrom} onChange={(e) => { setDueDateFrom(e.target.value); setPage(1); }} className="h-8 w-[150px] text-xs" />
                </div>
                <span className="text-[11px] text-gray-300">—</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">to</span>
                  <Input type="date" value={dueDateTo} onChange={(e) => { setDueDateTo(e.target.value); setPage(1); }} className="h-8 w-[150px] text-xs" />
                </div>
              </div>

              {hasActiveFilter && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => { setStatusFilter("all"); setSearchQuery(""); setClassFilter("all"); setDueDateFrom(""); setDueDateTo(""); setPage(1); }}
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
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
                  ? Math.round((bill.amount_paid / bill.total_amount) * 100) : 0;
                const isFullyPaid = bill.status === "paid" || paidPercent >= 100;
                const isOverdue = bill.status === "overdue";
                return (
                  <div key={bill.id} className="px-5 py-4 transition-all duration-150 hover:bg-gray-50 hover:pl-6">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isFullyPaid ? "bg-emerald-100" : isOverdue ? "bg-red-100" : "bg-amber-100"}`}>
                          {isFullyPaid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            : isOverdue ? <AlertTriangle className="h-4 w-4 text-red-600" />
                            : <Clock className="h-4 w-4 text-amber-600" />}
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
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col gap-1">
                          <button
                            onClick={() => openEdit(bill)}
                            className="p-1 rounded-md hover:bg-gray-200 text-gray-400 hover:text-amber-600 transition-colors"
                            title="Edit bill"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                          {bill.status !== "paid" && (
                            <button
                              onClick={() => setDeleteConfirm(bill)}
                              className="p-1 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete bill"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {getStatusBadge(bill.status)}
                      </div>
                    </div>
                    <div className="ml-9 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Paid: <span className="font-semibold text-gray-700">{formatMoney(bill.amount_paid)}</span></span>
                        <span className="text-gray-500">Balance: <span className={`font-semibold ${isFullyPaid ? "text-emerald-600" : isOverdue ? "text-red-600" : "text-amber-600"}`}>{formatMoney(bill.balance_amount)}</span></span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${isFullyPaid ? "bg-emerald-500" : isOverdue ? "bg-red-400" : "bg-amber-400"}`}
                          style={{ width: `${Math.min(100, paidPercent)}%` }} />
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
                {bills.length === 0 ? "Click \"Create Bill\" above to get started" : "Try adjusting your filter criteria"}
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
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-7 text-xs rounded-md border border-gray-200 bg-white px-2 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-300"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-[11px] text-gray-400">of {filteredBills.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-[28px] px-1.5 text-xs rounded-md border transition-colors ${
                        p === safePage
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
                  disabled={safePage >= totalPages}
                  className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Bill
            </AlertTitle>
            <AlertDesc>
              Are you sure you want to delete the bill for{" "}
              <strong>
                {deleteConfirm?.students?.first_name} {deleteConfirm?.students?.last_name}
              </strong>
              ? This action cannot be undone. Any payments recorded against this bill will be orphaned.
            </AlertDesc>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
