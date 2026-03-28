"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface StatementResponse {
  student: { first_name: string; last_name: string; student_id: string };
  summary: {
    totalDue: number;
    totalPaid: number;
    totalOutstanding: number;
    billCount: number;
  };
  bills: Array<{
    id: string;
    due_date?: string;
    status: string;
    total_amount: number;
    amount_paid: number;
    balance_amount: number;
    finance_bill_items?: Array<{ title: string; amount: number }>;
    finance_receipts?: Array<{ receipt_number: string }>;
  }>;
}

export default function StudentFinancePage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<StatementResponse | null>(null);

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/finance/statement");
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to fetch statement");
      }
      setStatement(payload.data as StatementResponse);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load finance statement");
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (reference: string) => {
    try {
      const res = await fetch(`/api/finance/paystack/verify?reference=${encodeURIComponent(reference)}`);
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Payment verification failed");
      }
      toast.success("Payment verified successfully");
      await fetchStatement();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to verify payment");
    }
  }, [fetchStatement]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  useEffect(() => {
    const reference = searchParams.get("reference");
    if (reference) {
      verifyPayment(reference);
    }
  }, [searchParams, verifyPayment]);

  const formatMoney = useMemo(() => {
    return (value: number) => `NGN ${Number(value || 0).toLocaleString()}`;
  }, []);

  const handlePayNow = async (billId: string, amount: number) => {
    try {
      const callbackUrl = `${window.location.origin}/student/finance`;
      const res = await fetch("/api/finance/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId,
          amount,
          callbackUrl,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to initialize payment");
      }

      window.location.href = payload.data.authorizationUrl as string;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to start payment");
    }
  };

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Finance</h1>
          <p className="text-gray-600">View your school bills and payment history.</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">Loading statement...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Due</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatMoney(statement?.summary.totalDue || 0)}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total Paid</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-green-600">{formatMoney(statement?.summary.totalPaid || 0)}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-orange-600">{formatMoney(statement?.summary.totalOutstanding || 0)}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Bills</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{statement?.summary.billCount || 0}</CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Student Billing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(statement?.bills || []).map((bill) => (
                  <div key={bill.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Due: {bill.due_date || "N/A"}</p>
                        <p className="font-medium">Balance: {formatMoney(bill.balance_amount)}</p>
                      </div>
                      <Badge variant={bill.status === "paid" ? "secondary" : "outline"}>{bill.status}</Badge>
                    </div>

                    <div className="text-sm text-gray-600">
                      Items: {(bill.finance_bill_items || []).map((item) => `${item.title} (${formatMoney(item.amount)})`).join(", ") || "N/A"}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Receipts: {(bill.finance_receipts || []).map((r) => r.receipt_number).join(", ") || "None"}
                      </p>
                      {bill.balance_amount > 0 && (
                        <Button size="sm" onClick={() => handlePayNow(bill.id, bill.balance_amount)}>
                          Pay Now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {(statement?.bills || []).length === 0 && (
                  <p className="text-sm text-gray-500">No finance records found.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
