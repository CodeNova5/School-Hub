"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FeeTemplate, ClassOption } from "./finance-types";

interface FeesTabProps {
  fees: FeeTemplate[];
  classes: ClassOption[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function FinanceFeesTab({ fees, classes, formatMoney, onRefresh, onError }: FeesTabProps) {
  const [form, setForm] = useState({
    name: "",
    category: "tuition",
    frequency: "per_term",
    amount: "",
    description: "",
  });
  const [classAmounts, setClassAmounts] = useState<Record<string, string>>({});

  const submitFee = async () => {
    const parsedAmount = Number(form.amount);
    if (!form.name || Number.isNaN(parsedAmount)) {
      throw new Error("Fee name and amount are required");
    }

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
  };

  const handleSubmit = async () => {
    try {
      await submitFee();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Configure Fee Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="Fee name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
              className="h-10 rounded-md border px-3"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              <option value="tuition">Tuition</option>
              <option value="uniform">Uniform</option>
              <option value="exam">Exam</option>
              <option value="bus">Bus</option>
              <option value="custom">Custom</option>
            </select>
            <select
              className="h-10 rounded-md border px-3"
              value={form.frequency}
              onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
            >
              <option value="per_term">Per Term</option>
              <option value="per_session">Per Session</option>
              <option value="one_time">One-time</option>
            </select>
            <Input
              placeholder="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
            <Button onClick={handleSubmit}>Create Fee</Button>
          </div>
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />

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
                    onChange={(e) =>
                      setClassAmounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fees Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {fees.map((fee) => (
            <div key={fee.id} className="border rounded-md p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{fee.name}</p>
                  <p className="text-sm text-gray-500">
                    {fee.category} · {fee.frequency}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatMoney(fee.amount)}</p>
                  <Badge variant={fee.is_active ? "secondary" : "outline"}>
                    {fee.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
              </div>
              {fee.finance_fee_template_classes &&
                fee.finance_fee_template_classes.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Class overrides:{" "}
                    {fee.finance_fee_template_classes
                      .map(
                        (entry) =>
                          `${entry.classes?.name || "Class"} (${formatMoney(entry.class_amount)})`
                      )
                      .join(", ")}
                  </div>
                )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
