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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Receipt,
  Banknote,
  CreditCard,
  SlidersHorizontal,
  RotateCcw,
  Plus,
  ArrowUpRight,
  Search,
  TrendingUp,
  Wallet,
  Calendar,
  FilterX,
} from "lucide-react";
import type { FinanceBill, FinanceTransactionRow } from "./finance-types";

interface TransactionsTabProps {
  bills: FinanceBill[];
  transactions: FinanceTransactionRow[];
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
  onTabChange?: (tab: string) => void;
}

const STATUS_OPTIONS = ["all", "success", "failed", "pending", "abandoned"] as const;
const METHOD_OPTIONS = ["all", "manual", "cash", "bank_transfer", "card", "paystack"] as const;

const METHOD_LABELS: Record<string, string> = {
  all: "All Methods",
  manual: "Manual",
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  paystack: "Paystack",
};

function getStatusBadge(status: string) {
  const config: Record<string, { color: string; icon: any }> = {
    success: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    failed: { color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
    pending: { color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
    abandoned: { color: "bg-gray-50 text-gray-500 border-gray-200", icon: XCircle },
  };
  const c = config[status] || { color: "bg-gray-50 text-gray-600 border-gray-200", icon: Clock };
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${c.color}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function getMethodIcon(method: string) {
  switch (method) {
    case "card":
      return <CreditCard className="h-3.5 w-3.5" />;
    case "bank_transfer":
      return <Banknote className="h-3.5 w-3.5" />;
    case "cash":
      return <Wallet className="h-3.5 w-3.5" />;
    default:
      return <Receipt className="h-3.5 w-3.5" />;
  }
}

export function FinanceTransactionsTab({
  bills,
  transactions,
  formatMoney,
  onRefresh,
  onError,
  onTabChange,
}: TransactionsTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    billId: "",
    studentId: "",
    amount: "",
    paymentMethod: "manual",
  });
  const [saving, setSaving] = useState(false);

  // ── Filter state ──
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasActiveFilter = searchQuery.trim() !== "" || statusFilter !== "all" || methodFilter !== "all" || !!dateFrom || !!dateTo;

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Student name / reference search
      if (searchQuery.trim()) {
        const name = `${tx.students?.first_name || ""} ${tx.students?.last_name || ""}`.toLowerCase();
        const ref = tx.reference.toLowerCase();
        const q = searchQuery.trim().toLowerCase();
        if (!name.includes(q) && !ref.includes(q)) return false;
      }

      // Status filter
      if (statusFilter !== "all" && tx.status !== statusFilter) return false;

      // Payment method filter
      if (methodFilter !== "all") {
        const method = (tx.payment_method || "manual").toLowerCase();
        if (method !== methodFilter) return false;
      }

      // Date range
      if (dateFrom && new Date(tx.created_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(tx.created_at) > end) return false;
      }

      return true;
    });
  }, [transactions, searchQuery, statusFilter, methodFilter, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setMethodFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // ── Summary from filtered data ──
  const summary = useMemo(() => {
    const totalAmount = filteredTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const successCount = filteredTransactions.filter((tx) => tx.status === "success").length;
    const failedCount = filteredTransactions.filter((tx) => tx.status === "failed").length;
    const pendingCount = filteredTransactions.filter((tx) => tx.status === "pending").length;
    return { totalAmount, successCount, failedCount, pendingCount };
  }, [filteredTransactions]);

  const resetForm = () => {
    setForm({ billId: "", studentId: "", amount: "", paymentMethod: "manual" });
  };

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

      resetForm();
      setModalOpen(false);
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
      {/* Navigation hint — no bills yet */}
      {bills.length === 0 && onTabChange && (
        <Card className="border-indigo-200 bg-indigo-50/50 overflow-hidden">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <p className="text-xs text-indigo-700 flex items-center gap-2">
              <Banknote className="h-3.5 w-3.5 text-indigo-500" />
              No bills exist yet. Create student bills first before recording payments.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-indigo-700 hover:text-indigo-800 hover:bg-indigo-100"
              onClick={() => onTabChange("billing")}
            >
              Go to Billing
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary bar — always visible when there are transactions */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
            <div className="p-2 rounded-lg bg-indigo-50">
              <TrendingUp className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-gray-900 truncate">{formatMoney(summary.totalAmount)}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
            <div className="p-2 rounded-lg bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Successful</p>
              <p className="text-sm font-bold text-gray-900">{summary.successCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
            <div className="p-2 rounded-lg bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Failed</p>
              <p className="text-sm font-bold text-gray-900">{summary.failedCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3.5 flex items-center gap-3 transition-all duration-200 hover:shadow-sm">
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Pending</p>
              <p className="text-sm font-bold text-gray-900">{summary.pendingCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Transactions List */}
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <Banknote className="h-4 w-4 text-gray-600" />
              </div>
              Transactions
              {filteredTransactions.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                  {filteredTransactions.length}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {hasActiveFilter && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
              </Button>
              <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-3.5 w-3.5" />
                    Record Payment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <div className="p-1 rounded-lg bg-indigo-100">
                        <Receipt className="h-4 w-4 text-indigo-600" />
                      </div>
                      Record Payment
                    </DialogTitle>
                    <DialogDescription>
                      Record a payment received from a student against their bill.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    </div>

                    {/* Quick balance info */}
                    {selectedBill && (
                      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Bill balance: <span className="font-semibold text-gray-900">{formatMoney(selectedBill.balance_amount)}</span>
                        </span>
                        <span className="text-gray-600">
                          Total bill: <span className="font-semibold text-gray-900">{formatMoney(selectedBill.total_amount)}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                    <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>
                      Cancel
                    </Button>
                    <Button
                      className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
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
            <div className="pt-4 space-y-3">
              {/* Student / Reference search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search by student name or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Status chips */}
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                        statusFilter === s
                          ? s === "all" ? "bg-gray-900 text-white border-gray-900"
                            : s === "success" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : s === "failed" ? "bg-red-100 text-red-800 border-red-300"
                            : s === "pending" ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment method chips */}
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Payment Method</p>
                <div className="flex flex-wrap gap-1.5">
                  {METHOD_OPTIONS.map((method) => (
                    <button
                      key={method}
                      onClick={() => setMethodFilter(method)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                        methodFilter === method
                          ? method === "all"
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-indigo-100 text-indigo-800 border-indigo-300"
                          : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      {METHOD_LABELS[method] || method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Date Range</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">From</span>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-[150px] text-xs" />
                  </div>
                  <span className="text-[11px] text-gray-300">—</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-400">To</span>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[150px] text-xs" />
                  </div>
                </div>
              </div>

              {/* Filter footer */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-gray-400">
                  Showing {filteredTransactions.length} of {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
                </p>
                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {filteredTransactions.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {/* Table header */}
              <div className="hidden md:grid md:grid-cols-12 gap-3 px-5 py-2.5 bg-gray-50/80 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                <div className="col-span-3">Student</div>
                <div className="col-span-2">Reference</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-2 text-center">Method</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1 text-right">Status</div>
              </div>

              {filteredTransactions.map((tx) => {
                const date = new Date(tx.created_at);
                const dateStr = date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
                const timeStr = date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });

                return (
                  <div
                    key={tx.id}
                    className="md:grid md:grid-cols-12 gap-3 px-5 py-3.5 flex flex-col md:flex-row md:items-center transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                  >
                    {/* Student */}
                    <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${
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
                        <p className="text-[10px] text-gray-400 truncate md:hidden">{tx.reference}</p>
                      </div>
                    </div>

                    {/* Reference (desktop) */}
                    <div className="col-span-2 text-xs text-gray-500 font-mono truncate hidden md:block">{tx.reference}</div>

                    {/* Amount */}
                    <div className="col-span-2 text-sm font-bold text-gray-900 text-right md:text-right">
                      {formatMoney(tx.amount)}
                    </div>

                    {/* Method */}
                    <div className="col-span-2 flex justify-center md:justify-center mt-1 md:mt-0">
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                        {getMethodIcon(tx.payment_method)}
                        {tx.payment_method === "bank_transfer" ? "Bank Transfer" : tx.payment_method}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="col-span-2 text-[11px] text-gray-400 flex items-center gap-1 mt-1 md:mt-0">
                      <Calendar className="h-3 w-3 shrink-0 text-gray-300" />
                      <span className="truncate">{dateStr}</span>
                      <span className="text-[10px] text-gray-300 hidden sm:inline">{timeStr}</span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1 text-right mt-1 md:mt-0">
                      {getStatusBadge(tx.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-14 text-center">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {transactions.length === 0 ? "No transactions recorded" : "No transactions match your filters"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {transactions.length === 0
                  ? 'Click "Record Payment" above to get started'
                  : "Try adjusting your search or filter criteria"}
              </p>
              {transactions.length > 0 && hasActiveFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-1.5 text-xs"
                  onClick={resetFilters}
                >
                  <FilterX className="h-3.5 w-3.5" />
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
