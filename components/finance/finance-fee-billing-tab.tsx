"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  GraduationCap,
  Plus,
  Tag,
  Layers,
  Loader2,
  CheckCircle2,
  Copy,
  X,
  GripVertical,
  Trash2,
  PencilLine,
  School,
  Sparkles,
  UserPlus,
  BookOpen,
  Bus,
  Pencil,
  Banknote,
  Clock,
  AlertTriangle,
  Users,
  ArrowUpRight,
  History,
} from "lucide-react";
import type { FeeTemplate, ClassOption, StudentOption, FinanceBill } from "./finance-types";

/* ─── Types ─────────────────────────────────────────── */

interface FeeBillingTabProps {
  fees: FeeTemplate[];
  classes: ClassOption[];
  students: StudentOption[];
  bills: FinanceBill[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

interface FeeForm {
  name: string;
  category: string;
  frequency: string;
  amount: string;
  description: string;
}

interface StudentBillingForm {
  studentId: string;
  feeTemplateId: string;
  billingCycle: string;
  dueDate: string;
}

/* ─── Constants ─────────────────────────────────────── */

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  tuition: { icon: GraduationCap, color: "from-blue-500 to-indigo-500", label: "Tuition" },
  uniform: { icon: BookOpen, color: "from-purple-500 to-violet-500", label: "Uniform" },
  exam: { icon: Pencil, color: "from-amber-500 to-orange-500", label: "Exam" },
  bus: { icon: Bus, color: "from-emerald-500 to-teal-500", label: "Bus" },
  custom: { icon: Tag, color: "from-zinc-500 to-zinc-400", label: "Custom" },
};

const FREQUENCY_LABELS: Record<string, string> = {
  per_term: "Per Term",
  per_session: "Per Session",
  one_time: "One-time",
};

/* ─── Helpers ───────────────────────────────────────── */

function buildInitialFeeForm(fee?: FeeTemplate | null): FeeForm {
  if (!fee) return { name: "", category: "tuition", frequency: "per_term", amount: "", description: "" };
  return {
    name: fee.name,
    category: fee.category,
    frequency: fee.frequency,
    amount: String(fee.amount),
    description: fee.description || "",
  };
}

function buildInitialClassAmounts(fee?: FeeTemplate | null): Record<string, string> {
  if (!fee?.finance_fee_template_classes) return {};
  const map: Record<string, string> = {};
  fee.finance_fee_template_classes.forEach((entry) => {
    map[entry.class_id] = String(entry.class_amount);
  });
  return map;
}

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.custom;
}

/* ─── Status Badge with Dot ─────────────────────────── */

function StatusDotBadge({ status }: { status: string }) {
  const config: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    paid: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-600", label: "Paid" },
    partial: { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-600", label: "Partial" },
    pending: { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-600", label: "Pending" },
    overdue: { dot: "bg-rose-500", bg: "bg-rose-50", text: "text-rose-600", label: "Overdue" },
    waived: { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-500", label: "Waived" },
    cancelled: { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-500", label: "Cancelled" },
  };
  const cfg = config[status] || { dot: "bg-gray-500", bg: "bg-gray-50", text: "text-gray-500", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text} border border-transparent`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === "overdue" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

/* ───────────────────────────────────────────────────── */
/* ── FEE TEMPLATE CATALOG SECTION ───────────────────── */
/* ───────────────────────────────────────────────────── */

function FeeTemplateCard({
  fee,
  onEdit,
  onDelete,
  formatMoney,
}: {
  fee: FeeTemplate;
  onEdit: (fee: FeeTemplate) => void;
  onDelete: (fee: FeeTemplate) => void;
  formatMoney: (value: number) => string;
}) {
  const cat = getCategoryConfig(fee.category);
  const CatIcon = cat.icon;
  const hasOverrides = fee.finance_fee_template_classes && fee.finance_fee_template_classes.length > 0;

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:border-gray-300 hover:-translate-y-0.5 hover:shadow-lg">
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cat.color} bg-opacity-10 flex items-center justify-center shrink-0`}>
            <CatIcon className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{fee.name}</p>
            <p className="text-[11px] text-gray-500">{FREQUENCY_LABELS[fee.frequency] || fee.frequency}</p>
          </div>
        </div>
        <div className="flex items-start gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onEdit(fee)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-amber-600 transition-colors"
            title="Edit fee"
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(fee)}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete fee"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-xl font-extrabold tracking-tight text-gray-900">{formatMoney(fee.amount)}</span>
        <span className="text-[10px] text-gray-400">base</span>
      </div>

      {fee.description && (
        <p className="text-[11px] text-gray-400 mb-2 line-clamp-1">{fee.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200`}>
          {fee.category}
        </span>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          fee.is_active
            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
            : "bg-gray-100 text-gray-500 border border-gray-200"
        }`}>
          {fee.is_active ? "Active" : "Inactive"}
        </span>
        {hasOverrides && (
          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
            {fee.finance_fee_template_classes!.length} class override{fee.finance_fee_template_classes!.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Class overrides list */}
      {hasOverrides && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
          {fee.finance_fee_template_classes!.map((entry, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-md"
            >
              <CheckCircle2 className="h-2.5 w-2.5 text-indigo-500" />
              {entry.classes?.name || "Class"}: {formatMoney(entry.class_amount)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FeeTemplateModal({
  open,
  onOpenChange,
  fees,
  classes,
  formatMoney,
  onRefresh,
  onError,
  editingFeeFromParent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fees: FeeTemplate[];
  classes: ClassOption[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  editingFeeFromParent?: FeeTemplate | null;
}) {
  const [editingFee, setEditingFee] = useState<FeeTemplate | null>(null);
  const [form, setForm] = useState<FeeForm>(buildInitialFeeForm());
  const [classAmounts, setClassAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isEditing = !!editingFee;
  const hasClassOverrides = useMemo(
    () => Object.values(classAmounts).some((v) => v !== "" && !Number.isNaN(Number(v))),
    [classAmounts]
  );
  const classOverrideCount = useMemo(
    () => Object.entries(classAmounts).filter(([, v]) => v !== "" && !Number.isNaN(Number(v))).length,
    [classAmounts]
  );

  const resetForm = useCallback(() => {
    setForm(buildInitialFeeForm());
    setClassAmounts({});
    setEditingFee(null);
  }, []);

  // Sync form when dialog opens with an editing fee from parent (card edit)
  useEffect(() => {
    if (open) {
      if (editingFeeFromParent) {
        setEditingFee(editingFeeFromParent);
        setForm(buildInitialFeeForm(editingFeeFromParent));
        setClassAmounts(buildInitialClassAmounts(editingFeeFromParent));
      } else {
        resetForm();
      }
    }
  }, [open, editingFeeFromParent, resetForm]);

  const openCreate = useCallback(() => {
    resetForm();
    setEditingFee(null);
  }, [resetForm]);

  const submitFee = async () => {
    const parsedAmount = Number(form.amount);
    if (!form.name || Number.isNaN(parsedAmount)) {
      throw new Error("Fee name and amount are required");
    }
    setSaving(true);
    try {
      const mappedClassAmounts = Object.entries(classAmounts)
        .filter(([, amount]) => amount !== "" && !Number.isNaN(Number(amount)))
        .map(([classId, amount]) => ({ classId, amount: Number(amount) }));

      const payload = {
        name: form.name,
        category: form.category,
        frequency: form.frequency,
        amount: parsedAmount,
        description: form.description,
        classAmounts: mappedClassAmounts,
      };

      if (isEditing && editingFee) {
        const res = await fetch("/api/admin/finance/fees", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, id: editingFee.id }),
        });
        const result = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !result.success) throw new Error(result.error || "Failed to update fee");
      } else {
        const res = await fetch("/api/admin/finance/fees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !result.success) throw new Error(result.error || "Failed to create fee");
      }
      resetForm();
      onOpenChange(false);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitFee();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleFillAllClasses = () => {
    const filled: Record<string, string> = {};
    classes.forEach((c) => { filled[c.id] = form.amount; });
    setClassAmounts(filled);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 text-xs bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shadow-sm"
          onClick={openCreate}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Fee
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-gray-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-gray-900">
            <div className={`p-1 rounded-lg ${isEditing ? "bg-amber-100" : "bg-indigo-100"}`}>
              {isEditing ? (
                <PencilLine className="h-4 w-4 text-amber-600" />
              ) : (
                <Plus className="h-4 w-4 text-indigo-600" />
              )}
            </div>
            {isEditing ? "Edit Fee Template" : "Create Fee Template"}
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            {isEditing
              ? "Update the fee structure and per-class pricing."
              : "Configure the fee structure and set per-class pricing."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Fee details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium text-gray-600">Fee Name</Label>
              <Input
                placeholder="e.g., Tuition Fee"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((prev) => ({ ...prev, category: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((prev) => ({ ...prev, frequency: v }))}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
                  <SelectItem value="per_term">Per Term</SelectItem>
                  <SelectItem value="per_session">Per Session</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Description (optional)</Label>
            <Input
              placeholder="Brief description of this fee"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500"
            />
          </div>

          {/* Base amount */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Base amount</Label>
            <div className="relative max-w-[200px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
              <Input
                className="pl-7 bg-white border-gray-300 text-gray-900 focus:border-indigo-500"
                placeholder="0.00"
                type="number"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <p className="text-[10px] text-gray-400">Default amount. Override per class below.</p>
          </div>

          {/* Class-specific amounts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-gray-600">Per-class fee amounts</Label>
              <div className="flex items-center gap-1.5">
                {hasClassOverrides && (
                  <span className="text-[10px] text-gray-400">{classOverrideCount} class{classOverrideCount !== 1 ? "es" : ""} overridden</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs text-gray-500 border-gray-300 hover:bg-gray-50"
                  onClick={handleFillAllClasses}
                  disabled={!form.amount || Number.isNaN(Number(form.amount))}
                >
                  <Copy className="h-3 w-3" />
                  Fill all
                </Button>
              </div>
            </div>

            {classes.length > 0 ? (
              <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                {classes.map((item) => {
                  const hasValue = classAmounts[item.id] !== undefined && classAmounts[item.id] !== "" && !Number.isNaN(Number(classAmounts[item.id]));
                  const isSameAsBase = hasValue && Number(classAmounts[item.id]) === Number(form.amount);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 ${
                        hasValue && !isSameAsBase ? "bg-indigo-50/50" : "hover:bg-gray-50"
                      }`}
                    >
                      <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                      <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">{item.name}</span>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₦</span>
                        <Input
                          className={`w-32 pl-5 h-8 text-xs bg-white border-gray-300 ${
                            isSameAsBase ? "text-gray-500" : hasValue ? "border-indigo-400 text-gray-900 font-medium" : "text-gray-400"
                          }`}
                          type="number"
                          placeholder={form.amount || "Amount"}
                          value={classAmounts[item.id] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setClassAmounts((prev) => {
                              const next = { ...prev };
                              if (val === "") delete next[item.id];
                              else next[item.id] = val;
                              return next;
                            });
                          }}
                        />
                      </div>
                      {hasValue && !isSameAsBase && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
                      {isSameAsBase && <span className="text-[10px] text-gray-400 shrink-0">Base</span>}
                      {hasValue && (
                        <button
                          onClick={() => setClassAmounts((prev) => { const n = { ...prev }; delete n[item.id]; return n; })}
                          className="p-0.5 rounded hover:bg-gray-200 text-gray-300 hover:text-gray-500 transition-colors shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-center">
                <Layers className="h-4 w-4 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-500">No classes found. Add classes first.</p>
              </div>
            )}
          </div>

          {hasClassOverrides && (
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Summary:</span>{" "}
              {classes.filter((c) => {
                const v = classAmounts[c.id];
                return v !== undefined && v !== "" && !Number.isNaN(Number(v));
              }).length}{" "}
              of {classes.length} classes have custom amounts.
              {classes.some((c) => {
                const v = classAmounts[c.id];
                return v === undefined || v === "" || Number.isNaN(Number(v));
              }) && (
                <span> The remaining classes will use the base amount of {form.amount ? `₦${Number(form.amount).toLocaleString()}` : "—"}.</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} className="border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </Button>
          <Button
            className={`gap-2 text-white ${
              isEditing
                ? "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
            }`}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{isEditing ? "Updating..." : "Creating..."}</>
            ) : (
              <>{isEditing ? <PencilLine className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{isEditing ? "Update Fee" : "Create Fee"}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────────────────────────────── */
/* ── BILL DISPATCH SECTION ──────────────────────────── */
/* ───────────────────────────────────────────────────── */

function BillSchoolModal({
  open,
  onOpenChange,
  fees,
  classes,
  students,
  bills,
  formatMoney,
  onRefresh,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fees: FeeTemplate[];
  classes: ClassOption[];
  students: StudentOption[];
  bills: FinanceBill[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<{ feeTemplateId: string; billingCycle: string; dueDate: string }>({
    feeTemplateId: "",
    billingCycle: "per_term",
    dueDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; message: string } | null>(null);

  const feeTemplateLookup = useMemo(() => {
    const map = new Map<string, FeeTemplate>();
    fees.forEach((f) => map.set(f.id, f));
    return map;
  }, [fees]);

  const studentsByClass = useMemo(() => {
    const map = new Map<string, StudentOption[]>();
    students.forEach((s) => {
      const cid = s.class_id || "";
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(s);
    });
    return map;
  }, [students]);

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const getFeeAmountForClass = useCallback((feeTemplateId: string, classId: string): number => {
    const fee = feeTemplateLookup.get(feeTemplateId);
    if (!fee) return 0;
    const classOverride = (fee.finance_fee_template_classes || []).find((c) => c.class_id === classId);
    return classOverride ? Number(classOverride.class_amount) : Number(fee.amount);
  }, [feeTemplateLookup]);

  const selectedFee = form.feeTemplateId ? feeTemplateLookup.get(form.feeTemplateId) : null;

  // Build per-class breakdown
  const classBreakdown = useMemo(() => {
    if (!form.feeTemplateId || selectedFee) {
      const breakdown: { classId: string; className: string; studentCount: number; feeAmount: number; subtotal: number }[] = [];
      classes.forEach((cls) => {
        const studs = studentsByClass.get(cls.id) || [];
        if (studs.length === 0) return;
        const feeAmt = getFeeAmountForClass(form.feeTemplateId, cls.id);
        if (feeAmt <= 0) return;
        breakdown.push({
          classId: cls.id,
          className: cls.name,
          studentCount: studs.length,
          feeAmount: feeAmt,
          subtotal: feeAmt * studs.length,
        });
      });
      return breakdown;
    }
    return [];
  }, [form.feeTemplateId, selectedFee, classes, studentsByClass, getFeeAmountForClass]);

  const totalStudents = useMemo(() => classBreakdown.reduce((s, c) => s + c.studentCount, 0), [classBreakdown]);
  const totalAmount = useMemo(() => classBreakdown.reduce((s, c) => s + c.subtotal, 0), [classBreakdown]);

  const resetForm = () => {
    setForm({ feeTemplateId: "", billingCycle: "per_term", dueDate: "" });
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!form.feeTemplateId) {
      onError("Please select a fee template");
      return;
    }
    if (totalStudents === 0) {
      onError("No students found to bill");
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/finance/billing/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeTemplateId: form.feeTemplateId,
          billingCycle: form.billingCycle,
          dueDate: form.dueDate || null,
          // Pass null classId to indicate "bill all classes"
          classId: null,
        }),
      });
      const payload = (await res.json()) as { success?: boolean; data?: { created: number; skipped: number; message: string }; error?: string };
      if (!res.ok || !payload.success) throw new Error(payload.error || "Failed to create bills");
      setResult(payload.data!);
      if (payload.data!.created > 0) await onRefresh();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to create bills");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-sm">
          <School className="h-3.5 w-3.5" />
          Bill School
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="p-1 rounded-lg bg-indigo-100">
              <Sparkles className="h-4 w-4 text-indigo-600" />
            </div>
            Bill Entire School
          </DialogTitle>
          <DialogDescription>
            Create bills for all active students across every class using a single fee template.
            Students already billed for this cycle will be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Fee template selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Fee Template</Label>
            <Select
              value={form.feeTemplateId}
              onValueChange={(value) => {
                const fee = feeTemplateLookup.get(value);
                setForm((prev) => ({
                  ...prev,
                  feeTemplateId: value,
                  billingCycle: (fee?.frequency as string) || prev.billingCycle,
                }));
              }}
            >
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Select a fee template..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 text-gray-900">
                {fees.map((fee) => (
                  <SelectItem key={fee.id} value={fee.id}>
                    <span className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-gray-400" />
                      {fee.name}
                      <span className="text-[10px] font-mono text-gray-500 ml-auto">{formatMoney(fee.amount)}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Billing cycle + Due date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Billing Cycle</Label>
              <Select
                value={form.billingCycle}
                onValueChange={(value) => setForm((prev) => ({ ...prev, billingCycle: value }))}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
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
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="bg-white border-gray-300 text-gray-900 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Per-class breakdown */}
          {selectedFee && classBreakdown.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-indigo-500" />
                Billing Breakdown by Class
              </p>
              <div className="divide-y divide-indigo-100">
                {classBreakdown.map((entry) => (
                  <div key={entry.classId} className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500/50 shrink-0" />
                      <span className="text-gray-700">{entry.className}</span>
                      <span className="text-gray-400">({entry.studentCount} students)</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-500">{formatMoney(entry.feeAmount)}</span>
                      <span className="text-gray-300 mx-1">×</span>
                      <span className="text-gray-800 font-semibold">{formatMoney(entry.subtotal)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-indigo-100 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>{totalStudents} student{totalStudents !== 1 ? "s" : ""}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-400">Total</span>
                  <p className="text-sm font-bold text-indigo-600">{formatMoney(totalAmount)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Result banner */}
          {result && (
            <div className={`p-3 rounded-lg border text-sm ${
              result.created > 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}>
              <div className="flex items-start gap-2">
                {result.created > 0
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
                <div>
                  <p className="font-medium text-xs">
                    {result.created > 0
                      ? `Created ${result.created} bill${result.created !== 1 ? "s" : ""} successfully!`
                      : "No new bills created"}
                  </p>
                  <p className="text-[10px] mt-0.5 opacity-80">{result.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          {result?.created ? (
            <Button onClick={() => { onOpenChange(false); resetForm(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} className="border-gray-300 text-gray-600 hover:bg-gray-50">
                Cancel
              </Button>
              <Button
                className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
                onClick={handleSubmit}
                disabled={saving || !form.feeTemplateId || totalStudents === 0}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Creating Bills...</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Create {totalStudents} Bill{totalStudents !== 1 ? "s" : ""}</>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BillStudentModal({
  open,
  onOpenChange,
  fees,
  students,
  classes,
  formatMoney,
  onRefresh,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fees: FeeTemplate[];
  students: StudentOption[];
  classes: ClassOption[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<StudentBillingForm>({ studentId: "", feeTemplateId: "", billingCycle: "per_term", dueDate: "" });
  const [saving, setSaving] = useState(false);

  const feeTemplateLookup = useMemo(() => {
    const map = new Map<string, FeeTemplate>();
    fees.forEach((f) => map.set(f.id, f));
    return map;
  }, [fees]);

  const classLookup = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const selectedStudent = students.find((s) => s.id === form.studentId);
  const selectedFee = form.feeTemplateId ? feeTemplateLookup.get(form.feeTemplateId) : null;

  // Get class-specific amount
  const effectiveAmount = useMemo(() => {
    if (!selectedFee || !selectedStudent?.class_id) return selectedFee?.amount || 0;
    const classOverride = (selectedFee.finance_fee_template_classes || []).find(
      (c) => c.class_id === selectedStudent.class_id
    );
    return classOverride ? Number(classOverride.class_amount) : Number(selectedFee.amount);
  }, [selectedFee, selectedStudent]);

  const studentClassName = selectedStudent?.class_id ? classLookup.get(selectedStudent.class_id) : null;

  const resetForm = () => {
    setForm({ studentId: "", feeTemplateId: "", billingCycle: "per_term", dueDate: "" });
  };

  const handleSubmit = async () => {
    if (!form.studentId || !form.feeTemplateId) {
      onError("Select a student and a fee template");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        studentId: form.studentId,
        classId: selectedStudent?.class_id,
        billingCycle: form.billingCycle,
        dueDate: form.dueDate || null,
        items: [{
          feeTemplateId: selectedFee?.id,
          title: selectedFee?.name || "Custom Fee",
          frequency: selectedFee?.frequency || form.billingCycle,
          amount: effectiveAmount,
          originalAmount: selectedFee?.amount || effectiveAmount,
          overrideType: selectedFee ? "none" : "custom",
          notes: selectedFee ? "" : "Added from billing panel",
        }],
      };

      const res = await fetch("/api/admin/finance/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to create bill");

      resetForm();
      onOpenChange(false);
      await onRefresh();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to create bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm">
          <UserPlus className="h-3.5 w-3.5" />
          Bill Student
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="p-1 rounded-lg bg-emerald-100">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
            </div>
            Bill Individual Student
          </DialogTitle>
          <DialogDescription>
            Issue a bill to a single student. The amount auto-adjusts based on the student&apos;s class and fee template.
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
                  searchTerms: `${s.first_name} ${s.last_name} ${s.student_id}`,
                }))}
                className="bg-white border-gray-300 text-gray-900"
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
                  }));
                }}
                placeholder="Search fee templates..."
                searchPlaceholder="Search by name..."
                emptyMessage="No fee template found"
                options={fees.map((fee) => ({
                  value: fee.id,
                  label: `${fee.name} — ${formatMoney(fee.amount)}`,
                  searchTerms: `${fee.name} ${fee.category}`,
                }))}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Billing Cycle</Label>
              <Select
                value={form.billingCycle}
                onValueChange={(value) => setForm((prev) => ({ ...prev, billingCycle: value }))}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 text-gray-900">
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
                value={form.dueDate}
                onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="bg-white border-gray-300 text-gray-900 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Student info + amount preview */}
          {selectedStudent && selectedFee && (
            <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-gray-800 font-medium">{selectedStudent.first_name} {selectedStudent.last_name}</span>
                <span className="text-gray-400 text-xs">{selectedStudent.student_id}</span>
              </div>
              {studentClassName && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Class: <span className="text-gray-700 font-medium">{studentClassName}</span></span>
                </div>
              )}
              <div className="border-t border-emerald-100 pt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {selectedFee.name} — {selectedFee.frequency === "per_term" ? "Per Term" : selectedFee.frequency === "per_session" ? "Per Session" : "One-time"}
                </span>
                <span className="text-lg font-bold text-emerald-600">{formatMoney(effectiveAmount)}</span>
              </div>
              {selectedStudent.class_id && selectedFee.finance_fee_template_classes?.some((c) => c.class_id === selectedStudent.class_id) && (
                <p className="text-[10px] text-indigo-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Class-specific pricing applied
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }} className="border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </Button>
          <Button
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
            onClick={handleSubmit}
            disabled={saving || !form.studentId || !form.feeTemplateId}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Creating Bill...</>
            ) : (
              <><GraduationCap className="h-4 w-4" />Create Bill</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────────────────────────────────── */
/* ── RECENT DISPATCH LOG ────────────────────────────── */
/* ───────────────────────────────────────────────────── */

function RecentDispatchLog({ bills, formatMoney }: { bills: FinanceBill[]; formatMoney: (value: number) => string }) {
  const recent = useMemo(() => {
    return [...bills]
      .sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""))
      .slice(0, 20);
  }, [bills]);

  if (recent.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-300">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
            <History className="h-3.5 w-3.5 text-gray-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Recent Dispatch History</p>
          <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">Last 20</span>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {recent.map((bill) => {
          const paidPercent = bill.total_amount > 0 ? Math.round((bill.amount_paid / bill.total_amount) * 100) : 0;
          const isFullyPaid = bill.status === "paid" || paidPercent >= 100;
          const isOverdue = bill.status === "overdue";
          return (
            <div key={bill.id} className="flex items-center justify-between px-5 py-3 transition-all duration-150 hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${
                  isFullyPaid ? "bg-emerald-50" : isOverdue ? "bg-rose-50" : "bg-amber-50"
                }`}>
                  {isFullyPaid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    : isOverdue ? <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    : <Clock className="h-3.5 w-3.5 text-amber-600" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {bill.students?.first_name} {bill.students?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bill.due_date ? new Date(bill.due_date).toLocaleDateString("en-NG", { day: "numeric", month: "short" }) : "No due date"}
                    {" · "}{formatMoney(bill.total_amount)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFullyPaid ? "bg-emerald-500" : isOverdue ? "bg-rose-500" : "bg-amber-500"
                    }`}
                    style={{ width: `${Math.min(100, paidPercent)}%` }}
                  />
                </div>
                <StatusDotBadge status={bill.status} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────── */
/* ── MAIN COMPONENT ─────────────────────────────────── */
/* ───────────────────────────────────────────────────── */

export function FinanceFeeBillingTab({
  fees,
  classes,
  students,
  bills,
  formatMoney,
  onRefresh,
  onError,
}: FeeBillingTabProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<FeeTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [billSchoolOpen, setBillSchoolOpen] = useState(false);
  const [billStudentOpen, setBillStudentOpen] = useState(false);

  const [editingFeeForCard, setEditingFeeForCard] = useState<FeeTemplate | null>(null);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/finance/fees?id=${deleteConfirm.id}`, { method: "DELETE" });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to delete fee");
      setDeleteConfirm(null);
      await onRefresh();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Failed to delete fee");
    } finally {
      setDeleting(false);
    }
  };

  const triggerFeeModalEdit = (fee: FeeTemplate) => {
    setEditingFeeForCard(fee);
    setFeeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Section 1: Fee Template Catalog ── */}
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
              <Layers className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Fee Template Catalog</p>
              <p className="text-[11px] text-gray-500">Define fee structures with per-class pricing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FeeTemplateModal
              open={feeModalOpen}
              onOpenChange={(o) => { setFeeModalOpen(o); if (!o) setEditingFeeForCard(null); }}
              fees={fees}
              classes={classes}
              formatMoney={formatMoney}
              onRefresh={onRefresh}
              onError={onError}
              editingFeeFromParent={editingFeeForCard}
            />
          </div>
        </div>

        {/* Fee Cards Grid */}
        {fees.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {fees.map((fee) => (
              <FeeTemplateCard
                key={fee.id}
                fee={fee}
                onEdit={() => triggerFeeModalEdit(fee)}
                onDelete={setDeleteConfirm}
                formatMoney={formatMoney}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-14 text-center">
            <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No fee templates created</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Create your first fee template to start billing students</p>
            <Button
              size="sm"
              className="gap-1.5 text-xs bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
              onClick={() => setFeeModalOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Fee Template
            </Button>
          </div>
        )}
      </div>

      {/* ── Section 2: Bill Dispatch ── */}
      {fees.length > 0 && (
        <div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Bill Dispatch</p>
                <p className="text-[11px] text-gray-500">Apply fees to students — school-wide or individual</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BillStudentModal
                open={billStudentOpen}
                onOpenChange={setBillStudentOpen}
                fees={fees}
                students={students}
                classes={classes}
                formatMoney={formatMoney}
                onRefresh={onRefresh}
                onError={onError}
              />
              <BillSchoolModal
                open={billSchoolOpen}
                onOpenChange={setBillSchoolOpen}
                fees={fees}
                classes={classes}
                students={students}
                bills={bills}
                formatMoney={formatMoney}
                onRefresh={onRefresh}
                onError={onError}
              />
            </div>
          </div>

          {/* Dispatch Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bill School Card */}
            <div
              onClick={() => setBillSchoolOpen(true)}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:border-indigo-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center shrink-0">
                  <School className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">Bill School</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Apply a fee template to all students across every class. Per-class pricing is automatically applied.
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{students.length} active students</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bill Student Card */}
            <div
              onClick={() => setBillStudentOpen(true)}
              className="group relative rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center shrink-0">
                  <UserPlus className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">Bill Student</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Issue a bill to a single student. Useful for late enrollees, custom charges, or one-off fees.
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Individual billing with class-specific pricing</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 3: Recent Dispatch History ── */}
      <RecentDispatchLog bills={bills} formatMoney={formatMoney} />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Fee Template
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?
              This cannot be undone. Bills referencing this fee will no longer be linked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} className="border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4" />Delete</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
