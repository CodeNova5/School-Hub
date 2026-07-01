"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";
import type { FinanceReceipt } from "./finance-types";

interface ReceiptsTabProps {
  receipts: FinanceReceipt[];
  formatMoney: (value: number) => string;
}

export function FinanceReceiptsTab({ receipts, formatMoney }: ReceiptsTabProps) {
  return (
    <div className="space-y-4 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>Receipts & Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {receipts.map((receipt) => (
            <div
              key={receipt.id}
              className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-md items-center"
            >
              <div className="font-medium text-sm">{receipt.receipt_number}</div>
              <div className="text-sm">
                {receipt.students?.first_name} {receipt.students?.last_name}
              </div>
              <div className="text-sm">
                {formatMoney(receipt.finance_transactions?.amount || 0)}
              </div>
              <div className="text-sm">{new Date(receipt.issued_at).toLocaleString()}</div>
              <div>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Receipt className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </div>
          ))}
          {receipts.length === 0 && (
            <p className="text-sm text-gray-500">No receipts yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
