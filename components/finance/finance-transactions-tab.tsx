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
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Receipt,
  Banknote,
  CreditCard,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import type { FinanceBill, FinanceTransactionRow } from "./finance-types";

interface TransactionsTabProps {
  bills: FinanceBill[];
  transactions: FinanceTransactionRow[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    abandoned: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-[10px] ${styles[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {status === "success" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : status === "failed" ? (
        <XCircle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {status}
    </Badge>
  );
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
  const [saving, setSaving] = useState(false);

  // ── Filter state ──
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;
      if (dateFrom && new Date(tx.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(tx.created_at) > end) return false;
      }
      return true;
    });
  }, [transactions, statusFilter, dateFrom, dateTo]);

  const submitTransaction = async () => {
    if (!form.billId || !form.studentId || !form.amount) {
      throw new Error("Bill, student and amount are required");
    }

    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await submitTransaction();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const selectedBill = bills.find((b) => b.id === form.billId);

  return (
    <div className="space-y-6 mt-6">
      {/* Record Payment Card */}
      <Card className="overflow-hidden border-indigo-100 transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/50 to-white pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-100">
              <Receipt className="h-4 w-4 text-indigo-600" />
            </div>
            Record Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Bill</Label>
              <SearchableSelect
                value={form.billId}
                onValueChange={(value) => {
                  const bill = bills.find((b) => b.id === value);
                  setForm((prev) => ({
                    ...prev,
                    billId: value,
                    studentId: bill?.student_id || "",
                    amount: bill ? String(bill.balance_amount) : prev.amount,
                  }));
                }}
                placeholder="Search for a bill..."
                searchPlaceholder="Search by student name..."
                emptyMessage="No bill found"
                options={bills.map((bill) => ({
                  value: bill.id,
                  label: `${bill.students?.first_name || ""} ${bill.students?.last_name || ""} — ${formatMoney(bill.balance_amount)}`,
                  searchTerms: `${bill.students?.first_name || ""} ${bill.students?.last_name || ""} ${bill.students?.student_id || ""}`,
                }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₦</span>
                <Input
                  className="pl-7"
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Method</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value) => setForm((prev) => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Student</Label>
              <div className="h-10 px-3 rounded-md border border-gray-200 bg-gray-50 flex items-center text-sm text-gray-500 truncate">
                {selectedBill?.students?.first_name
                  ? `${selectedBill.students.first_name} ${selectedBill.students.last_name}`
                  : "Auto-filled from bill"}
              </div>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Save Payment
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick balance info */}
          {selectedBill && (
            <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Bill balance: <span className="font-semibold text-gray-900">{formatMoney(selectedBill.balance_amount)}</span>
              </span>
              <span className="text-gray-600">
                Total bill: <span className="font-semibold text-gray-900">{formatMoney(selectedBill.total_amount)}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Banknote className="h-4 w-4 text-gray-600" />
              </div>
              Transactions
              {transactions.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                  {transactions.length}
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
              {(statusFilter !== "all" || dateFrom || dateTo) && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              )}
            </Button>
          </div>

          {/* Filter controls */}
          {showFilters && (
            <div className="pt-3 space-y-3">
              {/* Status chips */}
              <div className="flex flex-wrap gap-1.5">
                {["all", "success", "failed", "pending", "abandoned"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                      statusFilter === s
                        ? s === "all"
                          ? "bg-gray-900 text-white border-gray-900"
                          : s === "success"
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : s === "failed"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : s === "pending"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-gray-100 text-gray-700 border-gray-300"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>

              {/* Date range */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">From</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
                <span className="text-[11px] text-gray-300">—</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">To</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 w-[150px] text-xs"
                  />
                </div>
                {(statusFilter !== "all" || dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => {
                      setStatusFilter("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Results summary */}
              {transactions.length > 0 && (
                <p className="text-[10px] text-gray-400">
                  Showing {filteredTransactions.length} of {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {filteredTransactions.map((tx, idx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-3 px-5 py-3.5 items-center transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1 rounded-md ${
                      tx.status === "success" ? "bg-emerald-100" : tx.status === "failed" ? "bg-red-100" : "bg-amber-100"
                    }`}>
                      {tx.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : tx.status === "failed" ? (
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {tx.students?.first_name} {tx.students?.last_name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{tx.reference}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 truncate">{tx.reference}</div>
                  <div className="text-sm font-semibold text-gray-900">{formatMoney(tx.amount)}</div>
                  <div className="text-sm text-gray-500 capitalize">
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {tx.payment_method === "bank_transfer" ? "Bank Transfer" : tx.payment_method}
                    </span>
                  </div>
                  <div>{getStatusBadge(tx.status)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {transactions.length === 0 ? "No transactions recorded" : "No transactions match filters"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {transactions.length === 0
                  ? "Record a payment above to see it here"
                  : "Try adjusting your filter criteria"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
