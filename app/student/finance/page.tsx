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

interface SchoolFinanceSettings {
  paystack_subaccount_code?: string | null;
  enable_paystack_checkout: boolean;
  default_currency: string;
  school_name?: string;
}

export default function StudentFinancePage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<StatementResponse | null>(null);
  const [settings, setSettings] = useState<SchoolFinanceSettings | null>(null);

  const fetchStatement = useCallback(async () => {
    setLoading(true);
    try {
      const [statementRes, settingsRes] = await Promise.all([
        fetch("/api/student/finance/statement"),
        fetch("/api/student/finance/settings"),
      ]);

      const statementPayload = await statementRes.json();
      const settingsPayload = await settingsRes.json();

      if (!statementRes.ok || !statementPayload.success) {
        throw new Error(statementPayload.error || "Failed to fetch statement");
      }

      if (!settingsRes.ok || !settingsPayload.success) {
        console.warn("Could not fetch finance settings:", settingsPayload.error);
      }

      setStatement(statementPayload.data as StatementResponse);
      setSettings(settingsPayload.data as SchoolFinanceSettings);
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
            {/* School Account Details Debug Section */}
            {settings && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-blue-900">School Account Details (RLS Test)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">School:</span>
                    <span className="ml-2 font-medium">{settings.school_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Paystack Subaccount Code:</span>
                    <span className="ml-2 font-medium font-mono text-blue-700">
                      {settings.paystack_subaccount_code ? (
                        <>
                          {settings.paystack_subaccount_code}
                          <Badge className="ml-2 bg-green-100 text-green-800">✓ Configured</Badge>
                        </>
                      ) : (
                        <Badge className="ml-2 bg-red-100 text-red-800">✗ Not Set</Badge>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Checkout Enabled:</span>
                    <span className="ml-2 font-medium">{settings.enable_paystack_checkout ? "Yes" : "No"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Currency:</span>
                    <span className="ml-2 font-medium">{settings.default_currency}</span>
                  </div>
                </CardContent>
              </Card>
            )}
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
