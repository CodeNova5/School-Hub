"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  Receipt,
  Printer,
  FileDown,
  FileText,
  CheckCircle2,
  Calendar,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
  Search,
} from "lucide-react";
import { generateReceiptPDF, type SchoolInfo } from "@/lib/pdf-export-receipt";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { FinanceReceipt } from "./finance-types";

interface ReceiptsTabProps {
  receipts: FinanceReceipt[];
  formatMoney: (value: number) => string;
}

const PAYMENT_METHODS = ["all", "manual", "cash", "bank_transfer", "card", "paystack"] as const;
const METHOD_LABELS: Record<string, string> = {
  all: "All Methods",
  manual: "Manual",
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  paystack: "Paystack",
};

export function FinanceReceiptsTab({ receipts, formatMoney }: ReceiptsTabProps) {
  const { schoolId } = useSchoolContext();
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilter = searchQuery.trim() !== "" || methodFilter !== "all" || !!dateFrom || !!dateTo;

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      // Search by student name
      if (searchQuery.trim()) {
        const name = `${r.students?.first_name || ""} ${r.students?.last_name || ""}`.toLowerCase();
        const receiptNum = r.receipt_number.toLowerCase();
        const query = searchQuery.trim().toLowerCase();
        if (!name.includes(query) && !receiptNum.includes(query)) return false;
      }

      // Payment method filter
      if (methodFilter !== "all") {
        const method = r.finance_transactions?.payment_method?.toLowerCase() || "manual";
        if (method !== methodFilter) return false;
      }

      // Date range filter
      if (dateFrom && new Date(r.issued_at) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(r.issued_at) > end) return false;
      }

      return true;
    });
  }, [receipts, searchQuery, methodFilter, dateFrom, dateTo]);

  const resetFilters = () => {
    setSearchQuery("");
    setMethodFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // ── Fetch school info for receipt branding ──
  useEffect(() => {
    if (!schoolId) return;
    let ignore = false;
    supabase
      .from("schools")
      .select("name, address, phone, logo_url, motto")
      .eq("id", schoolId)
      .single()
      .then((result: { data: { name: string; address: string | null; phone: string | null; logo_url: string | null; motto: string | null } | null }) => {
        const data = result.data;
        if (!ignore && data) {
          setSchoolInfo({
            name: data.name || "School",
            address: data.address || undefined,
            phone: data.phone || undefined,
            logo_url: data.logo_url || undefined,
            motto: data.motto || undefined,
          });
        }
      })
      .catch(() => {
        // Silently fail — PDF will still work without school info
      });
    return () => { ignore = true; };
  }, [schoolId]);

  const handleDownloadPDF = useCallback(
    async (receipt: FinanceReceipt) => {
      if (loadingPdf) return;
      setLoadingPdf(receipt.id);

      try {
        await generateReceiptPDF(
          {
            receiptNumber: receipt.receipt_number,
            issuedAt: receipt.issued_at,
            studentName: `${receipt.students?.first_name || ""} ${receipt.students?.last_name || ""}`.trim() || "Student",
            studentId: receipt.students?.student_id || undefined,
            amount: receipt.finance_transactions?.amount || 0,
            paymentMethod: receipt.finance_transactions?.payment_method || "manual",
            transactionReference: receipt.finance_transactions?.reference || undefined,
            status: receipt.finance_transactions?.reference ? "success" : "paid",
          },
          schoolInfo || { name: "School" }
        );
        toast.success("Receipt PDF downloaded");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to generate receipt PDF");
      } finally {
        setLoadingPdf(null);
      }
    },
    [schoolInfo, loadingPdf]
  );

  return (
    <div className="space-y-6 mt-6">
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <FileText className="h-4 w-4 text-gray-600" />
              </div>
              Receipts & Invoices
              {receipts.length > 0 && (
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-1">
                  {receipts.length}
                </span>
              )}
            </CardTitle>
            {receipts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
                {hasActiveFilter && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                )}
              </Button>
            )}
          </div>

          {/* Filter controls */}
          {showFilters && (
            <div className="pt-4 space-y-3">
              {/* Student name search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search by student name or receipt #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              {/* Payment method chips */}
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    onClick={() => setMethodFilter(method)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all duration-150 ${
                      methodFilter === method
                        ? method === "all"
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-blue-100 text-blue-800 border-blue-300"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
                    }`}
                  >
                    {METHOD_LABELS[method] || method}
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
                {hasActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-gray-400 hover:text-gray-600"
                    onClick={resetFilters}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Showing count */}
              {hasActiveFilter && (
                <p className="text-[10px] text-gray-400">
                  Showing {filteredReceipts.length} of {receipts.length} receipt{receipts.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filteredReceipts.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {filteredReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="px-5 py-4 transition-all duration-150 hover:bg-gray-50 hover:pl-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-50 shrink-0">
                        <Receipt className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {receipt.receipt_number}
                        </p>
                        <p className="text-sm text-gray-600">
                          {receipt.students?.first_name} {receipt.students?.last_name}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {new Date(receipt.issued_at).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {receipt.finance_transactions?.payment_method && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              {receipt.finance_transactions.payment_method === "bank_transfer"
                                ? "Bank Transfer"
                                : receipt.finance_transactions.payment_method}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-gray-900">
                        {formatMoney(receipt.finance_transactions?.amount || 0)}
                      </p>
                      <div className="flex gap-1.5 mt-1.5 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadPDF(receipt)}
                          disabled={loadingPdf === receipt.id}
                          className="gap-1.5 text-xs h-7 px-2.5 transition-all duration-150 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200"
                        >
                          {loadingPdf === receipt.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <FileDown className="h-3 w-3" />
                          )}
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.print()}
                          className="gap-1.5 text-xs h-7 px-2.5 transition-all duration-150 hover:bg-gray-100"
                        >
                          <Printer className="h-3 w-3" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Receipt className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">
                {receipts.length === 0
                  ? "No receipts yet"
                  : "No receipts match your filters"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {receipts.length === 0
                  ? "Receipts will appear here after payments are recorded"
                  : "Try adjusting your search or filter criteria"}
              </p>
              {receipts.length > 0 && hasActiveFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5 text-xs"
                  onClick={resetFilters}
                >
                  <RotateCcw className="h-3 w-3" />
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
