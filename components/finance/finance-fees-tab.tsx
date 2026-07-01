"use client";

import { useState } from "react";
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
  BookOpen,
  Bus,
  GraduationCap,
  Pencil,
  Plus,
  Tag,
  Layers,
  Loader2,
  CheckCircle2,
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
  const [form, setForm] = useState({
    name: "",
    category: "tuition",
    frequency: "per_term",
    amount: "",
    description: "",
  });
  const [classAmounts, setClassAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

      setForm({ name: "", category: "tuition", frequency: "per_term", amount: "", description: "" });
      setClassAmounts({});
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

  return (
    <div className="space-y-6 mt-6">
      {/* Create Fee Card */}
      <Card className="overflow-hidden border-blue-100 transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-blue-50 bg-gradient-to-r from-blue-50/50 to-white pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100">
              <Plus className="h-4 w-4 text-blue-600" />
            </div>
            Configure Fee Template
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          {/* Main form row */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Amount (₦)</Label>
              <Input
                placeholder="0.00"
                type="number"
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
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

          {/* Class-specific amounts */}
          <div>
            <Label className="mb-2 block text-xs font-medium text-gray-600">
              Class-specific amounts (optional)
            </Label>
            {classes.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {classes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 border border-gray-200 rounded-lg p-2.5 transition-all duration-150 hover:border-blue-200 hover:bg-blue-50/30"
                  >
                    <span className="text-sm text-gray-700 flex-1 truncate">{item.name}</span>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₦</span>
                      <Input
                        className="w-28 pl-5 h-8 text-xs"
                        type="number"
                        placeholder="Amount"
                        value={classAmounts[item.id] || ""}
                        onChange={(e) =>
                          setClassAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-gray-50 border border-dashed border-gray-200 text-center">
                <Layers className="h-4 w-4 text-gray-300 mx-auto mb-1" />
                <p className="text-xs text-gray-500">No classes found. Add classes first.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fees List */}
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 pb-4">
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
                        <div className="flex items-center gap-1.5 mt-1">
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
              <p className="text-xs text-gray-400 mt-1">Create your first fee template above</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
