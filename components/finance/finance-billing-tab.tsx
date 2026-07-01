"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FinanceBill, FeeTemplate, StudentOption } from "./finance-types";

interface BillingTabProps {
  bills: FinanceBill[];
  students: StudentOption[];
  fees: FeeTemplate[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function FinanceBillingTab({
  bills,
  students,
  fees,
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

  const feeTemplateLookup = useMemo(() => {
    const lookup = new Map<string, FeeTemplate>();
    fees.forEach((fee) => lookup.set(fee.id, fee));
    return lookup;
  }, [fees]);

  const submitBill = async () => {
    if (!form.studentId || !form.amount) {
      throw new Error("Select student and amount to create bill");
    }

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
  };

  const handleSubmit = async () => {
    try {
      await submitBill();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Student Bill</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label>Student</Label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={form.studentId}
              onChange={(e) => setForm((prev) => ({ ...prev, studentId: e.target.value }))}
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.first_name} {student.last_name} ({student.student_id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Fee template</Label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={form.feeTemplateId}
              onChange={(e) => {
                const fee = feeTemplateLookup.get(e.target.value);
                setForm((prev) => ({
                  ...prev,
                  feeTemplateId: e.target.value,
                  billingCycle: fee?.frequency || prev.billingCycle,
                  amount: fee ? String(fee.amount) : prev.amount,
                }));
              }}
            >
              <option value="">Custom</option>
              {fees.map((fee) => (
                <option key={fee.id} value={fee.id}>
                  {fee.name} - {formatMoney(fee.amount)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Frequency</Label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={form.billingCycle}
              onChange={(e) => setForm((prev) => ({ ...prev, billingCycle: e.target.value }))}
            >
              <option value="per_term">Per Term</option>
              <option value="per_session">Per Session</option>
              <option value="one_time">One-time</option>
            </select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div>
            <Label>Due date</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
          </div>
          <div className="md:col-span-5">
            <Button onClick={handleSubmit}>Create Bill</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border rounded-md items-center"
            >
              <div className="font-medium text-sm">
                {bill.students?.first_name} {bill.students?.last_name}
              </div>
              <div className="text-sm">Due: {bill.due_date || "N/A"}</div>
              <div className="text-sm">Total: {formatMoney(bill.total_amount)}</div>
              <div className="text-sm">Paid: {formatMoney(bill.amount_paid)}</div>
              <div className="text-sm">Balance: {formatMoney(bill.balance_amount)}</div>
              <div>
                <Badge variant={bill.status === "paid" ? "secondary" : "outline"}>
                  {bill.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
