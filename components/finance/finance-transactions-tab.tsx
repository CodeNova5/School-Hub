"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FinanceBill, FinanceTransactionRow } from "./finance-types";

interface TransactionsTabProps {
  bills: FinanceBill[];
  transactions: FinanceTransactionRow[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function FinanceTransactionsTab({
  bills,
  transactions,
  formatMoney,
  onRefresh,
  onError,
}: TransactionsTabProps) {
  const [form, setForm] = useState({
    billId: "",
    studentId: "",
    amount: "",
    paymentMethod: "manual",
  });

  const submitTransaction = async () => {
    if (!form.billId || !form.studentId || !form.amount) {
      throw new Error("Bill, student and amount are required");
    }

    const res = await fetch("/api/admin/finance/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billId: form.billId,
        studentId: form.studentId,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        provider: "manual",
        status: "success",
      }),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to record transaction");
    }

    setForm({ billId: "", studentId: "", amount: "", paymentMethod: "manual" });
    await onRefresh();
  };

  const handleSubmit = async () => {
    try {
      await submitTransaction();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Record Payment</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Bill</Label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={form.billId}
              onChange={(e) => {
                const selectedBill = bills.find((bill) => bill.id === e.target.value);
                setForm((prev) => ({
                  ...prev,
                  billId: e.target.value,
                  studentId: selectedBill?.student_id || "",
                }));
              }}
            >
              <option value="">Select bill</option>
              {bills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.students?.first_name} {bill.students?.last_name} -{" "}
                  {formatMoney(bill.balance_amount)}
                </option>
              ))}
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
            <Label>Method</Label>
            <select
              className="w-full h-10 rounded-md border px-3"
              value={form.paymentMethod}
              onChange={(e) => setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="manual">Manual</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={handleSubmit}>
              Save Payment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-md items-center"
            >
              <div className="text-sm font-medium">
                {tx.students?.first_name} {tx.students?.last_name}
              </div>
              <div className="text-sm">{tx.reference}</div>
              <div className="text-sm font-semibold">{formatMoney(tx.amount)}</div>
              <div className="text-sm">{tx.payment_method}</div>
              <div>
                <Badge variant={tx.status === "success" ? "secondary" : "outline"}>
                  {tx.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
