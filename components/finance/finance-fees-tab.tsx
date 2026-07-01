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
  BookOpen,
  Bus,
  GraduationCap,
  Pencil,
  Plus,
  Tag,
  Layers,
  Loader2,
  CheckCircle2,
  Copy,
  X,
  GripVertical,
} from "lucide-react";
import type { FeeTemplate, ClassOption } from "./finance-types";

interface FeesTabProps {
  fees: FeeTemplate[];
  classes: ClassOption[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

const CATEGORY_ICONS: Record<string, any> = {
  tuition: GraduationCap,
  uniform: BookOpen,
  exam: Pencil,
  bus: Bus,
  custom: Tag,
};

const CATEGORY_COLORS: Record<string, string> = {
  tuition: "bg-blue-100 text-blue-600",
  uniform: "bg-purple-100 text-purple-600",
  exam: "bg-amber-100 text-amber-600",
  bus: "bg-emerald-100 text-emerald-600",
  custom: "bg-gray-100 text-gray-600",
};

const FREQUENCY_LABELS: Record<string, string> = {
  per_term: "Per Term",
  per_session: "Per Session",
  one_time: "One-time",
};

export function FinanceFeesTab({ fees, classes, formatMoney, onRefresh, onError }: FeesTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "tuition",
    frequency: "per_term",
    amount: "",
    description: "",
  });
  const [classAmounts, setClassAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setForm({ name: "", category: "tuition", frequency: "per_term", amount: "", description: "" });
    setClassAmounts({});
  };

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

      const res = await fetch("/api/admin/finance/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          frequency: form.frequency,
          amount: parsedAmount,
          description: form.description,
          classAmounts: mappedClassAmounts,
        }),
      });

      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create fee");
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
      await submitFee();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleFillAllClasses = () => {
    const filled: Record<string, string> = {};
    classes.forEach((c) => {
      filled[c.id] = form.amount;
    });
    setClassAmounts(filled);
  };

  const hasClassOverrides = useMemo(() => {
    return Object.values(classAmounts).some((v) => v !== "" && !Number.isNaN(Number(v)));
  }, [classAmounts]);

  const classOverrideCount = useMemo(() => {
    return Object.entries(classAmounts).filter(
      ([, v]) => v !== "" && !Number.isNaN(Number(v))
    ).length;
  }, [classAmounts]);

  return (
    <div className="space-y-6 mt-6">
      {/* Fees List */}
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Layers className="h-4 w-4 text-gray-600" />
              </div>
              Fees Management
              {fees.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                  {fees.length}
                </span>
              )}
            </CardTitle>
            <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" />
                  Add Fee
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <div className="p-1 rounded-lg bg-blue-100">
                      <Plus className="h-4 w-4 text-blue-600" />
                    </div>
                    Create Fee Template
                  </DialogTitle>
                  <DialogDescription>
                    Configure the fee structure and set per-class pricing.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                  {/* Fee details row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-medium text-gray-600">Fee Name</Label>
                      <Input
                        placeholder="e.g., Tuition Fee"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Category</Label>
                      <Select
                        value={form.category}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tuition">Tuition</SelectItem>
                          <SelectItem value="uniform">Uniform</SelectItem>
                          <SelectItem value="exam">Exam</SelectItem>
                          <SelectItem value="bus">Bus</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Frequency</Label>
                      <Select
                        value={form.frequency}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, frequency: value }))}
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
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Description (optional)</Label>
                    <Input
                      placeholder="Brief description of this fee"
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {/* Base amount */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Base amount</Label>
                    <div className="relative max-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                      <Input
                        className="pl-7"
                        placeholder="0.00"
                        type="number"
                        value={form.amount}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400">
                      This is the default amount. You can override it per class below.
                    </p>
                  </div>

                  {/* Class-specific amounts */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium text-gray-600">
                        Per-class fee amounts
                      </Label>
                      <div className="flex items-center gap-1.5">
                        {hasClassOverrides && (
                          <span className="text-[10px] text-gray-400">
                            {classOverrideCount} class{classOverrideCount !== 1 ? "es" : ""} overridden
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs text-gray-500"
                          onClick={handleFillAllClasses}
                          disabled={!form.amount || Number.isNaN(Number(form.amount))}
                          title="Copy base amount to all classes"
                        >
                          <Copy className="h-3 w-3" />
                          Fill all
                        </Button>
                      </div>
                    </div>

                    {classes.length > 0 ? (
                      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
                        {classes.map((item) => {
                          const hasValue =
                            classAmounts[item.id] !== undefined &&
                            classAmounts[item.id] !== "" &&
                            !Number.isNaN(Number(classAmounts[item.id]));
                          const isSameAsBase =
                            hasValue && Number(classAmounts[item.id]) === Number(form.amount);

                          return (
                            <div
                              key={item.id}
                              className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 ${
                                hasValue && !isSameAsBase
                                  ? "bg-blue-50/50"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                              <span className="text-sm font-medium text-gray-700 flex-1 min-w-0 truncate">
                                {item.name}
                              </span>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₦</span>
                                <Input
                                  className={`w-32 pl-5 h-8 text-xs ${
                                    isSameAsBase
                                      ? "border-gray-200 text-gray-500"
                                      : hasValue
                                      ? "border-blue-300 text-gray-900 font-medium"
                                      : "border-gray-200"
                                  }`}
                                  type="number"
                                  placeholder={form.amount || "Amount"}
                                  value={classAmounts[item.id] ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setClassAmounts((prev) => {
                                      const next = { ...prev };
                                      if (val === "") {
                                        delete next[item.id];
                                      } else {
                                        next[item.id] = val;
                                      }
                                      return next;
                                    });
                                  }}
                                />
                              </div>
                              {hasValue && !isSameAsBase && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                              )}
                              {isSameAsBase && (
                                <span className="text-[10px] text-gray-400 shrink-0">Base</span>
                              )}
                              {hasValue && (
                                <button
                                  onClick={() =>
                                    setClassAmounts((prev) => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    })
                                  }
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

                  {/* Summary */}
                  {hasClassOverrides && (
                    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">Summary:</span>{" "}
                      {classes.filter((c) => {
                        const v = classAmounts[c.id];
                        return v !== undefined && v !== "" && !Number.isNaN(Number(v));
                      }).length}{" "}
                      of {classes.length} classes have custom amounts set.
                      {classes.some((c) => {
                        const v = classAmounts[c.id];
                        return v === undefined || v === "" || Number.isNaN(Number(v));
                      }) && (
                        <span>
                          {" "}
                          The remaining classes will use the base amount of{" "}
                          {form.amount ? `₦${Number(form.amount).toLocaleString()}` : "—"}.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button
                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                    onClick={handleSubmit}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Fee
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {fees.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {fees.map((fee) => {
                const CatIcon = CATEGORY_ICONS[fee.category] || Tag;
                const catColor = CATEGORY_COLORS[fee.category] || "bg-gray-100 text-gray-600";
                return (
                  <div
                    key={fee.id}
                    className="px-5 py-4 transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 ${catColor}`}>
                          <CatIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{fee.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {FREQUENCY_LABELS[fee.frequency] || fee.frequency}
                          </p>
                          {fee.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{fee.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-gray-900">{formatMoney(fee.amount)}</p>
                        <div className="flex items-center gap-1.5 mt-1 justify-end">
                          <span className="text-[10px] text-gray-400 capitalize bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {fee.category}
                          </span>
                          <Badge
                            variant={fee.is_active ? "secondary" : "outline"}
                            className={`text-[10px] ${
                              fee.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-50 text-gray-500 border-gray-200"
                            }`}
                          >
                            {fee.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {fee.finance_fee_template_classes &&
                      fee.finance_fee_template_classes.length > 0 && (
                        <div className="mt-2 ml-11 flex flex-wrap gap-1">
                          {fee.finance_fee_template_classes.map((entry, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-full"
                            >
                              <CheckCircle2 className="h-2.5 w-2.5 text-blue-400" />
                              {entry.classes?.name || "Class"}: {formatMoney(entry.class_amount)}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Tag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No fee templates created</p>
              <p className="text-xs text-gray-400 mt-1">Click "Add Fee" to create your first fee template</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
