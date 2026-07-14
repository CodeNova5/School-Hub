"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Receipt, Printer, FileDown, FileText, CheckCircle2, Calendar, Loader2 } from "lucide-react";
import { generateReceiptPDF, type SchoolInfo } from "@/lib/pdf-export-receipt";
import { useSchoolContext } from "@/hooks/use-school-context";
import type { FinanceReceipt } from "./finance-types";

interface ReceiptsTabProps {
  receipts: FinanceReceipt[];
  formatMoney: (value: number) => string;
}

export function FinanceReceiptsTab({ receipts, formatMoney }: ReceiptsTabProps) {
  const { schoolId } = useSchoolContext();
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);

  // Fetch school info for receipt branding
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
        </CardHeader>
        <CardContent className="p-0">
          {receipts.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {receipts.map((receipt) => (
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
                              {receipt.finance_transactions.payment_method}
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
              <p className="text-sm font-medium text-gray-500">No receipts yet</p>
              <p className="text-xs text-gray-400 mt-1">Receipts will appear here after payments are recorded</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
