"use client";

import { useState, useMemo, useCallback } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Receipt,
  ChevronRight,
  X,
  Eye,
  Printer,
  Send,
  Ban,
  CreditCard,
  Building2,
  Hash,
  CalendarDays,
} from "lucide-react";
import type {
  FinanceBill,
  FeeTemplate,
  StudentOption,
  ClassOption,
  FinanceTransactionRow,
} from "./finance-types";

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

interface ClassCollectionRow {
  classId: string;
  className: string;
  enrolled: number;
  fullyPaid: number;
  partiallyPaid: number;
  unpaid: number;
  totalExpected: number;
  totalCollected: number;
  outstanding: number;
}

interface StudentTransaction {
  id: string;
  reference: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  students?: { first_name?: string; last_name?: string; student_id?: string };
  finance_student_bills?: { due_date?: string; total_amount?: number; status?: string };
}

// ── Status Badge Component ──

function StatusBadge({ status, balanceAmount, amountPaid }: {
  status: string;
  balanceAmount: number;
  amountPaid: number;
}) {
  const isZeroBalance = balanceAmount <= 0;
  const isWaived = status === "waived" || status === "scholarship" || status === "exempt";
  const isUnpaid = amountPaid <= 0 && balanceAmount > 0;
  const isPartiallyPaid = amountPaid > 0 && balanceAmount > 0;
  const isOverdue = status === "overdue";

  let config: { color: string; icon: any; label: string };
  if (isWaived) {
    config = {
      color: "bg-purple-50 text-purple-700 border-purple-200 ring-purple-200",
      icon: Ban,
      label: "Waived",
    };
  } else if (isZeroBalance || status === "paid") {
    config = {
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-200",
      icon: CheckCircle2,
      label: "Fully Paid",
    };
  } else if (isOverdue) {
    config = {
      color: "bg-red-50 text-red-700 border-red-200 ring-red-200",
      icon: AlertTriangle,
      label: "Overdue",
    };
  } else if (isPartiallyPaid) {
    config = {
      color: "bg-amber-50 text-amber-700 border-amber-200 ring-amber-200",
      icon: Clock,
      label: "Partially Paid",
    };
  } else {
    config = {
      color: "bg-slate-50 text-slate-700 border-slate-200 ring-slate-200",
      icon: AlertTriangle,
      label: "Unpaid",
    };
  }

  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={`gap-1.5 text-[11px] font-medium px-2.5 py-1 transition-all duration-200 hover:ring-2 ${config.color}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ── Class Summary Row Skeleton ──

function ClassRowSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-4 px-4 py-3">
      <div className="h-4 w-28 bg-gray-200 rounded" />
      <div className="h-4 w-12 bg-gray-200 rounded ml-auto" />
      <div className="h-4 w-16 bg-gray-200 rounded" />
      <div className="h-4 w-16 bg-gray-200 rounded" />
      <div className="h-4 w-12 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded" />
      <div className="h-4 w-20 bg-gray-200 rounded" />
    </div>
  );
}

// ── Main Component ──

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
  // ── State ──
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
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
    message: string;
  } | null>(null);

  // ── Student Drawer state ──
  const [drawerBill, setDrawerBill] = useState<FinanceBill | null>(null);
  const [drawerTransactions, setDrawerTransactions] = useState<
    StudentTransaction[]
  >([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  // ── Roster filter state ──
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [debtThreshold, setDebtThreshold] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"roster" | "classes">("classes");

  const feeTemplateLookup = useMemo(() => {
    const lookup = new Map<string, FeeTemplate>();
    fees.forEach((fee) => lookup.set(fee.id, fee));
    return lookup;
  }, [fees]);

  const studentClassLookup = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (s.class_id) map.set(s.id, s.class_id);
    });
    return map;
  }, [students]);

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  // ── Derive class name for a bill ──
  const getBillClassName = useCallback(
    (bill: FinanceBill): string => {
      if (bill.classes?.name) return bill.classes.name;
      if (bill.class_id) return classLookup.get(bill.class_id) || "Unknown";
      const cid = studentClassLookup.get(bill.student_id);
      if (cid) return classLookup.get(cid) || "Unknown";
      return "Unassigned";
    },
    [classLookup, studentClassLookup]
  );

  // ── Class Collections Summary ──
  const classCollectionData = useMemo<ClassCollectionRow[]>(() => {
    const map = new Map<string, ClassCollectionRow>();

    bills.forEach((bill) => {
      const className = getBillClassName(bill);
      const classId = bill.class_id || "unassigned";

      if (!map.has(classId)) {
        map.set(classId, {
          classId,
          className,
          enrolled: 0,
          fullyPaid: 0,
          partiallyPaid: 0,
          unpaid: 0,
          totalExpected: 0,
          totalCollected: 0,
          outstanding: 0,
        });
      }

      const row = map.get(classId)!;
      row.enrolled += 1;
      row.totalExpected += Number(bill.total_amount || 0);
      row.totalCollected += Number(bill.amount_paid || 0);
      row.outstanding += Number(bill.balance_amount || 0);

      if (bill.status === "paid" || Number(bill.balance_amount || 0) <= 0) {
        row.fullyPaid += 1;
      } else if (Number(bill.amount_paid || 0) > 0) {
        row.partiallyPaid += 1;
      } else {
        row.unpaid += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.className.localeCompare(b.className)
    );
  }, [bills, getBillClassName]);

  // ── Filtered Roster ──
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      // Class filter
      if (classFilter !== "all") {
        const billClassId = b.class_id || studentClassLookup.get(b.student_id);
        if (billClassId !== classFilter) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const isZeroBalance = Number(b.balance_amount || 0) <= 0;
        const isUnpaid = Number(b.amount_paid || 0) <= 0 && Number(b.balance_amount || 0) > 0;
        const isPartiallyPaid = Number(b.amount_paid || 0) > 0 && Number(b.balance_amount || 0) > 0;
        const isOverdue = b.status === "overdue";
        const isWaived = b.status === "waived" || b.status === "scholarship" || b.status === "exempt";

        if (statusFilter === "paid" && !isZeroBalance && b.status !== "paid") return false;
        if (statusFilter === "unpaid" && !isUnpaid) return false;
        if (statusFilter === "partial" && !isPartiallyPaid) return false;
        if (statusFilter === "overdue" && !isOverdue) return false;
        if (statusFilter === "waived" && !isWaived) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = `${b.students?.first_name || ""} ${b.students?.last_name || ""}`.toLowerCase();
        const studentId = `${b.students?.student_id || ""}`.toLowerCase();
        if (!name.includes(q) && !studentId.includes(q)) return false;
      }

      // Debt threshold
      if (debtThreshold !== null && debtThreshold > 0) {
        if (Number(b.balance_amount || 0) < debtThreshold) return false;
      }

      return true;
    });
  }, [bills, statusFilter, searchQuery, classFilter, studentClassLookup, debtThreshold]);

  const hasActiveFilter =
    statusFilter !== "all" ||
    searchQuery.trim() ||
    classFilter !== "all" ||
    debtThreshold !== null;

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize));
  const safePage = page > totalPages ? 1 : page;
  const paginatedBills = filteredBills.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // ── Students by class for bulk billing ──
  const studentsByClass = useMemo(() => {
    const map = new Map<string, StudentOption[]>();
    students.forEach((s) => {
      const cid = s.class_id || "";
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(s);
    });
    return map;
  }, [students]);

  const getFeeAmountForClass = (
    feeTemplateId: string,
    classId: string
  ): number => {
    const fee = feeTemplateLookup.get(feeTemplateId);
    if (!fee) return 0;
    const classOverride = (fee.finance_fee_template_classes || []).find(
      (c) => c.class_id === classId
    );
    return classOverride ? Number(classOverride.class_amount) : Number(fee.amount);
  };

  const selectedBulkFee = bulkForm.feeTemplateId
    ? feeTemplateLookup.get(bulkForm.feeTemplateId)
    : null;
  const selectedClassStudents = bulkForm.classId
    ? studentsByClass.get(bulkForm.classId) || []
    : [];
  const effectiveAmount =
    bulkForm.feeTemplateId && bulkForm.classId
      ? getFeeAmountForClass(bulkForm.feeTemplateId, bulkForm.classId)
      : 0;
  const bulkTotal = effectiveAmount * selectedClassStudents.length;

  // ── Handlers ──
  const resetBulkForm = () => {
    setBulkForm({
      classId: "",
      feeTemplateId: "",
      billingCycle: "per_term",
      dueDate: "",
    });
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
      onError(
        err instanceof Error ? err.message : "Failed to create class bills"
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const selectedStudent = students.find((s) => s.id === form.studentId);
  const isEditing = !!editingBill;

  const resetForm = () => {
    setForm({
      studentId: "",
      billingCycle: "per_term",
      dueDate: "",
      feeTemplateId: "",
      amount: "",
    });
    setEditingBill(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (bill: FinanceBill) => {
    setEditingBill(bill);
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
      const selectedFee = form.feeTemplateId
        ? feeTemplateLookup.get(form.feeTemplateId)
        : null;

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
        const res = await fetch("/api/admin/finance/billing", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingBill.id }),
        });
        const result = (await res.json()) as {
          success?: boolean;
          error?: string;
        };
        if (!res.ok || !result.success) {
          throw new Error(result.error || "Failed to update bill");
        }
      } else {
        const res = await fetch("/api/admin/finance/billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await res.json()) as {
          success?: boolean;
          error?: string;
        };
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
      const res = await fetch(
        `/api/admin/finance/billing?id=${deleteConfirm.id}`,
        { method: "DELETE" }
      );
      const result = (await res.json()) as {
        success?: boolean;
        error?: string;
      };
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to delete bill");
      }
      setDeleteConfirm(null);
      await onRefresh();
    } catch (err: unknown) {
      onError(
        err instanceof Error ? err.message : "Failed to delete bill"
      );
    } finally {
      setDeleting(false);
    }
  };

  // ── Open Student Drawer ──
  const openStudentDrawer = async (bill: FinanceBill) => {
    setDrawerBill(bill);
    setDrawerTransactions([]);
    setDrawerError(null);
    setDrawerLoading(true);

    try {
      const res = await fetch(
        `/api/admin/finance/billing/student-transactions?studentId=${bill.student_id}`
      );
      const payload = (await res.json()) as {
        success?: boolean;
        data?: StudentTransaction[];
        error?: string;
      };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to fetch transactions");
      }
      setDrawerTransactions(payload.data || []);
    } catch (err: unknown) {
      setDrawerError(
        err instanceof Error ? err.message : "Failed to load transactions"
      );
    } finally {
      setDrawerLoading(false);
    }
  };

  // ── Filter by class from summary table ──
  const filterByClass = (classId: string) => {
    setClassFilter(classId);
    setViewMode("roster");
    setShowFilters(true);
    setPage(1);
  };

  // ── Get collection rate color ──
  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-emerald-600";
    if (rate >= 50) return "text-amber-600";
    return "text-red-600";
  };

  const getRateBg = (rate: number) => {
    if (rate >= 80) return "bg-emerald-50";
    if (rate >= 50) return "bg-amber-50";
    return "bg-red-50";
  };

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return "bg-emerald-500";
    if (rate >= 50) return "bg-amber-400";
    return "bg-red-400";
  };

  // ── Determine Scholarship/Waived status ──
  const isScholarshipOrWaived = (bill: FinanceBill) =>
    bill.status === "waived" ||
    bill.status === "scholarship" ||
    bill.status === "exempt";

  const isFullyPaid = (bill: FinanceBill) =>
    bill.status === "paid" || Number(bill.balance_amount || 0) <= 0;

  const isUnpaid = (bill: FinanceBill) =>
    Number(bill.amount_paid || 0) <= 0 && Number(bill.balance_amount || 0) > 0;

  return (
    <div className="space-y-6 mt-6">
      {/* ── Navigation hint — no fees yet ── */}
      {fees.length === 0 && onTabChange && (
        <Card className="border-amber-200 bg-amber-50/50 overflow-hidden">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p className="text-xs text-amber-700 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              No fee templates exist yet. Create fee templates first before
              billing students.
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

      {/* ── View Mode Toggle ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("classes")}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
            viewMode === "classes"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
              : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700"
          }`}
        >
          <Building2 className="h-3.5 w-3.5 inline mr-1.5" />
          Class Summary
        </button>
        <button
          onClick={() => setViewMode("roster")}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
            viewMode === "roster"
              ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
              : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700"
          }`}
        >
          <Users className="h-3.5 w-3.5 inline mr-1.5" />
          Student Roster
        </button>
      </div>

      {/* ── SECTION 1: CLASS COLLECTIONS SUMMARY ── */}
      {viewMode === "classes" && (
        <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
          <CardHeader className="border-b border-gray-100 pb-3 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                </div>
                Class Collections Summary
                {bills.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                    {classCollectionData.length} classes
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => setViewMode("roster")}
                >
                  <Users className="h-3.5 w-3.5" />
                  View All Students
                </Button>
              </div>
            </div>
          </CardHeader>

          <div className="overflow-x-auto">
            {classCollectionData.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left font-semibold text-gray-500 py-3 px-4">
                      Class
                    </th>
                    <th className="text-center font-semibold text-gray-500 py-3 px-3">
                      Enrolled
                    </th>
                    <th className="text-center font-semibold text-gray-500 py-3 px-3">
                      <span className="text-emerald-600">Fully Paid</span>
                    </th>
                    <th className="text-center font-semibold text-gray-500 py-3 px-3">
                      <span className="text-amber-600">Partial</span>
                    </th>
                    <th className="text-center font-semibold text-gray-500 py-3 px-3">
                      <span className="text-red-600">Unpaid</span>
                    </th>
                    <th className="text-right font-semibold text-gray-500 py-3 px-3">
                      Total Expected
                    </th>
                    <th className="text-right font-semibold text-gray-500 py-3 px-3">
                      Collected
                    </th>
                    <th className="text-right font-semibold text-gray-500 py-3 px-3">
                      Outstanding
                    </th>
                    <th className="text-center font-semibold text-gray-500 py-3 px-3">
                      Rate
                    </th>
                    <th className="text-center py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {classCollectionData.map((row) => {
                    const collectionRate =
                      row.totalExpected > 0
                        ? Math.round(
                            (row.totalCollected / row.totalExpected) * 100
                          )
                        : 0;
                    return (
                      <tr
                        key={row.classId}
                        className="transition-all duration-150 hover:bg-gray-50 group"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-md bg-indigo-50 group-hover:bg-indigo-100 transition-colors duration-150">
                              <School className="h-3.5 w-3.5 text-indigo-500" />
                            </div>
                            <span className="font-semibold text-gray-900 text-sm">
                              {row.className}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <span className="font-semibold text-gray-700">
                            {row.enrolled}
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          {row.fullyPaid > 0 ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              {row.fullyPaid}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="text-center py-3 px-3">
                          {row.partiallyPaid > 0 ? (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" />
                              {row.partiallyPaid}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="text-center py-3 px-3">
                          {row.unpaid > 0 ? (
                            <span className="inline-flex items-center gap-1 font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="h-3 w-3" />
                              {row.unpaid}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="text-right py-3 px-3 font-medium text-gray-700">
                          {formatMoney(row.totalExpected)}
                        </td>
                        <td className="text-right py-3 px-3 font-medium text-emerald-600">
                          {formatMoney(row.totalCollected)}
                        </td>
                        <td className="text-right py-3 px-3">
                          <span
                            className={`font-medium ${
                              row.outstanding > 0
                                ? "text-red-600"
                                : "text-gray-400"
                            }`}
                          >
                            {formatMoney(row.outstanding)}
                          </span>
                        </td>
                        <td className="text-center py-3 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <div
                              className={`w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden`}
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(collectionRate)}`}
                                style={{ width: `${collectionRate}%` }}
                              />
                            </div>
                            <span
                              className={`text-[11px] font-semibold ${getRateColor(collectionRate)}`}
                            >
                              {collectionRate}%
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-[10px] text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-all duration-150 opacity-0 group-hover:opacity-100"
                            onClick={() => filterByClass(row.classId)}
                          >
                            Details
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  <tr className="border-t-2 border-gray-200 bg-gray-50/80">
                    <td className="py-3 px-4">
                      <span className="font-bold text-gray-800 text-sm">
                        Total
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="font-bold text-gray-800">
                        {bills.length}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="font-bold text-emerald-700">
                        {classCollectionData.reduce(
                          (s, r) => s + r.fullyPaid,
                          0
                        )}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="font-bold text-amber-700">
                        {classCollectionData.reduce(
                          (s, r) => s + r.partiallyPaid,
                          0
                        )}
                      </span>
                    </td>
                    <td className="text-center py-3 px-3">
                      <span className="font-bold text-red-700">
                        {classCollectionData.reduce(
                          (s, r) => s + r.unpaid,
                          0
                        )}
                      </span>
                    </td>
                    <td className="text-right py-3 px-3 font-bold text-gray-800">
                      {formatMoney(
                        classCollectionData.reduce(
                          (s, r) => s + r.totalExpected,
                          0
                        )
                      )}
                    </td>
                    <td className="text-right py-3 px-3 font-bold text-emerald-700">
                      {formatMoney(
                        classCollectionData.reduce(
                          (s, r) => s + r.totalCollected,
                          0
                        )
                      )}
                    </td>
                    <td className="text-right py-3 px-3 font-bold text-red-700">
                      {formatMoney(
                        classCollectionData.reduce(
                          (s, r) => s + r.outstanding,
                          0
                        )
                      )}
                    </td>
                    <td className="text-center py-3 px-3" colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center">
                <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  No class data available
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Bills need to be created first to see class summaries
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── SECTION 2: STUDENT CLEARANCE ROSTER ── */}
      {viewMode === "roster" && (
        <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
          <CardHeader className="border-b border-gray-100 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-100">
                  <Users className="h-4 w-4 text-gray-600" />
                </div>
                Student Clearance Roster
                {filteredBills.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                    {filteredBills.length} student
                    {filteredBills.length !== 1 ? "s" : ""}
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {/* Bulk billing dialog trigger */}
                <Dialog
                  open={bulkModalOpen}
                  onOpenChange={(open) => {
                    setBulkModalOpen(open);
                    if (!open) resetBulkForm();
                  }}
                >
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
                        Create bills for all active students in a class at
                        once. Students who already have active bills for this
                        cycle will be skipped.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">
                          Class
                        </Label>
                        <Select
                          value={bulkForm.classId}
                          onValueChange={(value) =>
                            setBulkForm((prev) => ({
                              ...prev,
                              classId: value,
                            }))
                          }
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
                                    {studentsByClass.get(c.id)?.length || 0}{" "}
                                    students
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {bulkForm.classId && (
                          <p className="text-[10px] text-gray-400 flex items-center gap-1">
                            <UserPlus className="h-3 w-3" />
                            {selectedClassStudents.length} active student
                            {selectedClassStudents.length !== 1 ? "s" : ""} in
                            this class
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">
                          Fee Template
                        </Label>
                        <Select
                          value={bulkForm.feeTemplateId}
                          onValueChange={(value) => {
                            const fee = feeTemplateLookup.get(value);
                            setBulkForm((prev) => ({
                              ...prev,
                              feeTemplateId: value,
                              billingCycle:
                                (fee?.frequency as
                                  | "per_term"
                                  | "per_session"
                                  | "one_time") || prev.billingCycle,
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a fee template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {fees.map((fee) => {
                              const amountForClass = bulkForm.classId
                                ? getFeeAmountForClass(
                                    fee.id,
                                    bulkForm.classId
                                  )
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
                        {selectedBulkFee &&
                          bulkForm.classId &&
                          effectiveAmount > 0 && (
                            <p className="text-[10px] text-gray-400">
                              Per student:{" "}
                              <span className="font-semibold text-gray-700">
                                {formatMoney(effectiveAmount)}
                              </span>
                              {selectedBulkFee.finance_fee_template_classes?.some(
                                (c) => c.class_id === bulkForm.classId
                              ) && (
                                <span className="ml-1 text-indigo-500">
                                  (class-specific pricing)
                                </span>
                              )}
                            </p>
                          )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">
                            Billing Cycle
                          </Label>
                          <Select
                            value={bulkForm.billingCycle}
                            onValueChange={(value) =>
                              setBulkForm((prev) => ({
                                ...prev,
                                billingCycle: value as
                                  | "per_term"
                                  | "per_session"
                                  | "one_time",
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_term">
                                Per Term
                              </SelectItem>
                              <SelectItem value="per_session">
                                Per Session
                              </SelectItem>
                              <SelectItem value="one_time">
                                One-time
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">
                            Due Date
                          </Label>
                          <Input
                            type="date"
                            value={bulkForm.dueDate}
                            onChange={(e) =>
                              setBulkForm((prev) => ({
                                ...prev,
                                dueDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {bulkForm.classId &&
                        selectedBulkFee &&
                        selectedClassStudents.length > 0 && (
                          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                Students to bill
                              </span>
                              <span className="font-semibold text-gray-900">
                                {selectedClassStudents.length}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">
                                Fee per student
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatMoney(effectiveAmount)}
                              </span>
                            </div>
                            <div className="border-t border-indigo-100 pt-2 flex items-center justify-between text-xs">
                              <span className="text-gray-500 font-medium">
                                Total bill value
                              </span>
                              <span className="font-bold text-indigo-700 text-sm">
                                {formatMoney(bulkTotal)}
                              </span>
                            </div>
                          </div>
                        )}

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
                              <p className="text-[10px] mt-0.5 opacity-80">
                                {bulkResult.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      {bulkResult?.created ? (
                        <Button
                          onClick={() => {
                            setBulkModalOpen(false);
                            resetBulkForm();
                          }}
                        >
                          Done
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setBulkModalOpen(false);
                              resetBulkForm();
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                            onClick={handleBulkSubmit}
                            disabled={
                              bulkSaving ||
                              !bulkForm.classId ||
                              !bulkForm.feeTemplateId ||
                              selectedClassStudents.length === 0
                            }
                          >
                            {bulkSaving ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Creating Bills...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4" />
                                Create {selectedClassStudents.length} Bill
                                {selectedClassStudents.length !== 1 ? "s" : ""}
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

                <Dialog
                  open={modalOpen}
                  onOpenChange={(open) => {
                    setModalOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={openCreate}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isEditing ? "Edit Bill" : "Create Bill"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base">
                        <div
                          className={`p-1 rounded-lg ${isEditing ? "bg-amber-100" : "bg-emerald-100"}`}
                        >
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
                          <Label className="text-xs font-medium text-gray-600">
                            Student
                          </Label>
                          <SearchableSelect
                            value={form.studentId}
                            onValueChange={(value) =>
                              setForm((prev) => ({
                                ...prev,
                                studentId: value,
                              }))
                            }
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
                          <Label className="text-xs font-medium text-gray-600">
                            Fee Template
                          </Label>
                          <SearchableSelect
                            value={form.feeTemplateId}
                            onValueChange={(value) => {
                              const fee = feeTemplateLookup.get(value);
                              setForm((prev) => ({
                                ...prev,
                                feeTemplateId: value,
                                billingCycle:
                                  fee?.frequency || prev.billingCycle,
                                amount: fee
                                  ? String(fee.amount)
                                  : prev.amount,
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
                          <Label className="text-xs font-medium text-gray-600">
                            Billing Cycle
                          </Label>
                          <Select
                            value={form.billingCycle}
                            onValueChange={(value) =>
                              setForm((prev) => ({
                                ...prev,
                                billingCycle: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="per_term">
                                Per Term
                              </SelectItem>
                              <SelectItem value="per_session">
                                Per Session
                              </SelectItem>
                              <SelectItem value="one_time">
                                One-time
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">
                            Amount (₦)
                          </Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                amount: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">
                            Due Date
                          </Label>
                          <Input
                            type="date"
                            value={form.dueDate}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                dueDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {selectedStudent && (
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center gap-3 text-sm">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            Billing:{" "}
                            <span className="font-semibold text-gray-900">
                              {selectedStudent.first_name}{" "}
                              {selectedStudent.last_name}
                            </span>
                            <span className="text-gray-300 mx-1.5">·</span>
                            ID:{" "}
                            <span className="font-medium text-gray-700">
                              {selectedStudent.student_id}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setModalOpen(false);
                          resetForm();
                        }}
                      >
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
                            {isEditing ? (
                              <PencilLine className="h-4 w-4" />
                            ) : (
                              <GraduationCap className="h-4 w-4" />
                            )}
                            {isEditing ? "Update Bill" : "Create Bill"}
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* ── Filters ── */}
            {showFilters && (
              <div className="pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search by student name or ID..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Class filter */}
                  <div className="flex items-center gap-1.5">
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

                  {/* Debt threshold */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">
                      Debt &gt;
                    </span>
                    <Input
                      type="number"
                      placeholder="₦0"
                      value={debtThreshold ?? ""}
                      onChange={(e) => {
                        setDebtThreshold(
                          e.target.value ? Number(e.target.value) : null
                        );
                        setPage(1);
                      }}
                      className="h-8 w-[100px] text-xs"
                    />
                  </div>
                </div>

                {/* Status filters */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "all", label: "All" },
                    { key: "paid", label: "✅ Fully Paid" },
                    { key: "partial", label: "🟡 Partial" },
                    { key: "unpaid", label: "🔴 Unpaid" },
                    { key: "overdue", label: "⛔ Overdue" },
                    { key: "waived", label: "🟣 Waived" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setStatusFilter(s.key);
                        setPage(1);
                      }}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                        statusFilter === s.key
                          ? s.key === "all"
                            ? "bg-gray-900 text-white border-gray-900"
                            : s.key === "paid"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : s.key === "overdue"
                                ? "bg-red-100 text-red-800 border-red-300"
                                : s.key === "partial"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : s.key === "unpaid"
                                    ? "bg-slate-100 text-slate-800 border-slate-300"
                                    : "bg-purple-100 text-purple-800 border-purple-300"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Active filter info */}
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
                        setDebtThreshold(null);
                        setPage(1);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                    <span className="text-[10px] text-gray-400">
                      Showing {filteredBills.length} of {bills.length} student
                      {bills.length !== 1 ? "s" : ""}
                    </span>
                    {classFilter !== "all" && (
                      <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {classLookup.get(classFilter) || "Selected class"}
                      </span>
                    )}
                    {debtThreshold !== null && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        Debt &gt; {formatMoney(debtThreshold)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardHeader>

          {/* ── Roster Table ── */}
          <CardContent className="p-0">
            {filteredBills.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="text-left font-semibold text-gray-500 py-3 px-4">
                        Student
                      </th>
                      <th className="text-left font-semibold text-gray-500 py-3 px-3">
                        ID
                      </th>
                      <th className="text-left font-semibold text-gray-500 py-3 px-3">
                        Class
                      </th>
                      <th className="text-left font-semibold text-gray-500 py-3 px-3">
                        Status
                      </th>
                      <th className="text-right font-semibold text-gray-500 py-3 px-3">
                        Total
                      </th>
                      <th className="text-right font-semibold text-gray-500 py-3 px-3">
                        Paid
                      </th>
                      <th className="text-right font-semibold text-gray-500 py-3 px-3">
                        Balance
                      </th>
                      <th className="text-center font-semibold text-gray-500 py-3 px-3">
                        Progress
                      </th>
                      <th className="text-center py-3 px-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginatedBills.map((bill) => {
                      const paidPercent =
                        bill.total_amount > 0
                          ? Math.round(
                              (bill.amount_paid / bill.total_amount) * 100
                            )
                          : 0;
                      const studentInitials =
                        `${(bill.students?.first_name || "")[0] || ""}${(bill.students?.last_name || "")[0] || ""}`.toUpperCase() || "?";

                      const initialsBg = isFullyPaid(bill)
                        ? "bg-emerald-100 text-emerald-700"
                        : isScholarshipOrWaived(bill)
                          ? "bg-purple-100 text-purple-700"
                          : isUnpaid(bill)
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700";

                      return (                          <tr
                          key={bill.id}
                          className="transition-all duration-150 hover:bg-gray-50 group cursor-pointer"
                          onClick={() => openStudentDrawer(bill)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openStudentDrawer(bill);
                            }
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-transform duration-150 group-hover:scale-105 ${initialsBg}`}
                              >
                                {studentInitials || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors duration-150">
                                  {bill.students?.first_name}{" "}
                                  {bill.students?.last_name}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  Due:{" "}
                                  {bill.due_date
                                    ? new Date(bill.due_date).toLocaleDateString(
                                        "en-NG",
                                        {
                                          day: "numeric",
                                          month: "short",
                                          year: "numeric",
                                        }
                                      )
                                    : "No due date"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-[11px] text-gray-500">
                              {bill.students?.student_id || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md text-[11px]">
                              <School className="h-3 w-3 text-gray-400" />
                              {getBillClassName(bill)}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge
                              status={bill.status}
                              balanceAmount={Number(bill.balance_amount || 0)}
                              amountPaid={Number(bill.amount_paid || 0)}
                            />
                          </td>
                          <td className="text-right py-3 px-3 font-medium text-gray-700">
                            {formatMoney(Number(bill.total_amount || 0))}
                          </td>
                          <td className="text-right py-3 px-3 font-medium text-emerald-600">
                            {formatMoney(Number(bill.amount_paid || 0))}
                          </td>
                          <td className="text-right py-3 px-3">
                            <span
                              className={`font-medium ${
                                Number(bill.balance_amount || 0) > 0
                                  ? "text-red-600"
                                  : "text-gray-400"
                              }`}
                            >
                              {formatMoney(Number(bill.balance_amount || 0))}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isFullyPaid(bill)
                                      ? "bg-emerald-500"
                                      : isUnpaid(bill)
                                        ? "bg-red-400"
                                        : "bg-amber-400"
                                  }`}
                                  style={{ width: `${Math.min(100, paidPercent)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-medium text-gray-400 w-8 text-right">
                                {paidPercent}%
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStudentDrawer(bill);
                                }}
                                className="p-1.5 rounded-md hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                                title="View details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(bill);
                                }}
                                className="p-1.5 rounded-md hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                                title="Edit bill"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                              </button>
                              {!isFullyPaid(bill) &&
                                !isScholarshipOrWaived(bill) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm(bill);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Delete bill"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  {bills.length === 0
                    ? "No bills created"
                    : "No students match filter"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {bills.length === 0
                    ? 'Click "Create Bill" above to get started'
                    : "Try adjusting your filter criteria"}
                </p>
              </div>
            )}

            {/* ── Pagination ── */}
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
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-[11px] text-gray-400">
                    of {filteredBills.length}
                  </span>
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
                    const start = Math.max(
                      1,
                      Math.min(safePage - 2, totalPages - 4)
                    );
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
      )}

      {/* ── SECTION 3: STUDENT DRAWER ── */}
      <Sheet
        open={!!drawerBill}
        onOpenChange={(open) => {
          if (!open) {
            setDrawerBill(null);
            setDrawerTransactions([]);
            setDrawerError(null);
          }
        }}
      >
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
          {drawerBill && (
            <>
              <SheetHeader className="border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isFullyPaid(drawerBill)
                        ? "bg-emerald-100 text-emerald-700"
                        : isScholarshipOrWaived(drawerBill)
                          ? "bg-purple-100 text-purple-700"
                          : isUnpaid(drawerBill)
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {`${(drawerBill.students?.first_name || "")[0] || ""}${(drawerBill.students?.last_name || "")[0] || ""}`.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg">
                      {drawerBill.students?.first_name}{" "}
                      {drawerBill.students?.last_name}
                    </SheetTitle>
                    <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Hash className="h-3 w-3" />
                        {drawerBill.students?.student_id || "N/A"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <School className="h-3 w-3" />
                        {getBillClassName(drawerBill)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <CalendarDays className="h-3 w-3" />
                        Due:{" "}
                        {drawerBill.due_date
                          ? new Date(drawerBill.due_date).toLocaleDateString(
                              "en-NG",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )
                          : "N/A"}
                      </span>
                    </SheetDescription>
                  </div>
                  <StatusBadge
                    status={drawerBill.status}
                    balanceAmount={Number(drawerBill.balance_amount || 0)}
                    amountPaid={Number(drawerBill.amount_paid || 0)}
                  />
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {/* Bill Summary Card */}
                <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Payment Summary
                  </h4>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Total Bill</span>
                      <span className="font-semibold text-gray-900">
                        {formatMoney(Number(drawerBill.total_amount || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Paid</span>
                      <span className="font-semibold text-emerald-600">
                        {formatMoney(Number(drawerBill.amount_paid || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-2.5">
                      <span className="text-gray-700 font-medium">
                        Outstanding Balance
                      </span>
                      <span
                        className={`font-bold text-base ${
                          Number(drawerBill.balance_amount || 0) > 0
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {formatMoney(
                          Number(drawerBill.balance_amount || 0)
                        )}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                        <span>Payment Progress</span>
                        <span>
                          {drawerBill.total_amount > 0
                            ? Math.round(
                                (drawerBill.amount_paid /
                                  drawerBill.total_amount) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isFullyPaid(drawerBill)
                              ? "bg-emerald-500"
                              : isUnpaid(drawerBill)
                                ? "bg-red-400"
                                : "bg-amber-400"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              drawerBill.total_amount > 0
                                ? Math.round(
                                    (drawerBill.amount_paid /
                                      drawerBill.total_amount) *
                                      100
                                  )
                                : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fee Itemization */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    Fee Breakdown
                  </h4>
                  {drawerBill.finance_bill_items &&
                  drawerBill.finance_bill_items.length > 0 ? (
                    <div className="space-y-2">
                      {drawerBill.finance_bill_items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {item.title}
                            </p>
                            <p className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                              <span className="capitalize">
                                {item.frequency?.replace("_", " ") || "N/A"}
                              </span>
                              {item.override_type &&
                                item.override_type !== "none" && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                    {item.override_type}
                                  </span>
                                )}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 ml-3">
                            {formatMoney(Number(item.amount || 0))}
                          </span>
                        </div>
                      ))}
                      {/* Total */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <span className="text-sm font-semibold text-gray-700">
                          Total Fee Items
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatMoney(
                            (drawerBill.finance_bill_items || []).reduce(
                              (sum, item) => sum + Number(item.amount || 0),
                              0
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center rounded-lg border border-dashed border-gray-200">
                      <Receipt className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">
                        No fee items detailed
                      </p>
                    </div>
                  )}
                </div>

                {/* Transaction History */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment History
                  </h4>
                  {drawerLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="animate-pulse flex items-center gap-3 p-3 rounded-lg border border-gray-100"
                        >
                          <div className="h-8 w-8 rounded-full bg-gray-200" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-28 bg-gray-200 rounded" />
                            <div className="h-2 w-20 bg-gray-100 rounded" />
                          </div>
                          <div className="h-4 w-16 bg-gray-200 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : drawerError ? (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
                      <AlertTriangle className="h-5 w-5 text-red-400 mx-auto mb-1" />
                      <p className="text-xs text-red-600">{drawerError}</p>
                    </div>
                  ) : drawerTransactions.length > 0 ? (
                    <div className="space-y-2">
                      {drawerTransactions.map((tx) => {
                        const txStatus = tx.status;
                        const isSuccess = txStatus === "success";
                        const isPending =
                          txStatus === "pending" || txStatus === "initiated";
                        const isFailed = txStatus === "failed";

                        return (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                                  isSuccess
                                    ? "bg-emerald-100"
                                    : isPending
                                      ? "bg-amber-100"
                                      : "bg-red-100"
                                }`}
                              >
                                {isSuccess ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : isPending ? (
                                  <Clock className="h-4 w-4 text-amber-600" />
                                ) : (
                                  <X className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {tx.reference}
                                </p>
                                <p className="text-[10px] text-gray-400 flex items-center gap-2">
                                  <span className="capitalize">
                                    {tx.payment_method?.replace("_", " ") ||
                                      "N/A"}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {new Date(
                                      tx.created_at
                                    ).toLocaleDateString("en-NG", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <div className="text-right ml-3">
                              <p className="text-sm font-semibold text-gray-900">
                                {formatMoney(Number(tx.amount || 0))}
                              </p>
                              <span
                                className={`text-[10px] font-medium ${
                                  isSuccess
                                    ? "text-emerald-600"
                                    : isPending
                                      ? "text-amber-600"
                                      : "text-red-600"
                                }`}
                              >
                                {tx.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-gray-400 text-center pt-1">
                        {drawerTransactions.length} transaction
                        {drawerTransactions.length !== 1 ? "s" : ""} found
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 text-center rounded-lg border border-dashed border-gray-200">
                      <CreditCard className="h-6 w-6 text-gray-300 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">
                        No payments recorded yet
                      </p>
                    </div>
                  )}
                </div>

                {/* Receipt Info */}
                {drawerBill.finance_receipts &&
                  drawerBill.finance_receipts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Receipt className="h-3.5 w-3.5" />
                        Receipts
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {drawerBill.finance_receipts.map((r, idx) => (
                          <Badge
                            key={idx}
                            variant="outline"
                            className="gap-1.5 text-[11px] bg-blue-50 text-blue-700 border-blue-200"
                          >
                            <Receipt className="h-3 w-3" />
                            {r.receipt_number}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Quick Actions */}
                <div className="border-t border-gray-100 pt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Quick Actions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {}}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Clearance
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {}}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send Reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => {
                        setDrawerBill(null);
                        openEdit(drawerBill);
                      }}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                      Edit Bill
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Bill
            </AlertTitle>
            <AlertDesc>
              Are you sure you want to delete the bill for{" "}
              <strong>
                {deleteConfirm?.students?.first_name}{" "}
                {deleteConfirm?.students?.last_name}
              </strong>
              ? This action cannot be undone. Any payments recorded against this
              bill will be orphaned.
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
