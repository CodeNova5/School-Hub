"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Users } from "lucide-react";
import type { FinanceSettings as FinanceSettingsType, SubaccountForm } from "./finance-types";

interface SettingsTabProps {
  settings: FinanceSettingsType;
  formatMoney: (value: number) => string;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}

export function FinanceSettingsTab({ settings, onRefresh, onError }: SettingsTabProps) {
  const [subaccountForm, setSubaccountForm] = useState<SubaccountForm>({
    businessName: "",
    settlementBank: "",
    accountNumber: "",
  });

  const [localSettings, setLocalSettings] = useState<FinanceSettingsType>(settings);

  // Sync local state when settings prop changes (e.g. after saving via parent refresh)
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const submitSettings = async () => {
    const res = await fetch("/api/admin/finance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paystackSubaccountCode: localSettings.paystack_subaccount_code || "",
        enablePaystackCheckout: localSettings.enable_paystack_checkout ?? true,
        defaultCurrency: localSettings.default_currency || "NGN",
        invoicePrefix: localSettings.invoice_prefix || "INV",
        receiptPrefix: localSettings.receipt_prefix || "RCP",
      }),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to save settings");
    }

    await onRefresh();
  };

  const submitSubaccountCreation = async () => {
    if (
      !subaccountForm.businessName ||
      !subaccountForm.settlementBank ||
      !subaccountForm.accountNumber
    ) {
      throw new Error("Business name, settlement bank and account number are required");
    }

    const res = await fetch("/api/admin/finance/settings/subaccount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subaccountForm),
    });

    const payload = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !payload.success) {
      throw new Error(payload.error || "Failed to create subaccount");
    }

    setSubaccountForm({ businessName: "", settlementBank: "", accountNumber: "" });
    await onRefresh();
  };

  const handleSettingsSubmit = async () => {
    try {
      await submitSettings();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleSubaccountSubmit = async () => {
    try {
      await submitSubaccountCreation();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="space-y-4 mt-6">
      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900 text-sm font-semibold">
            💡 How Student Payments Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-1">
          <p>✓ Students pay school fees through Paystack</p>
          <p>
            ✓ <strong>100% of payments go directly to your school's bank account</strong>
          </p>
          <p>✓ No funds stay in main account — automatic routing to school subaccount</p>
        </CardContent>
      </Card>

      {/* Settings form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Paystack and Finance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Subaccount creation */}
          <div className="md:col-span-2 border rounded-md p-4 space-y-3 bg-amber-50 border-amber-200">
            <div>
              <p className="text-sm font-medium text-amber-900">
                Step 1: Register School Bank Account
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Enter your school's bank details to create a Paystack subaccount. We'll handle API
                registration automatically.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  School/Business Name
                </label>
                <Input
                  placeholder="e.g., ABC School"
                  value={subaccountForm.businessName}
                  onChange={(e) =>
                    setSubaccountForm((prev) => ({ ...prev, businessName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Settlement Bank Code
                </label>
                <Input
                  placeholder="e.g., 001 (GTB)"
                  value={subaccountForm.settlementBank}
                  onChange={(e) =>
                    setSubaccountForm((prev) => ({ ...prev, settlementBank: e.target.value }))
                  }
                />
                <p className="text-xs text-gray-500 mt-0.5">
                  Get codes from Paystack bank list or your bank
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">
                  Account Number
                </label>
                <Input
                  placeholder="e.g., 0123456789"
                  value={subaccountForm.accountNumber}
                  onChange={(e) =>
                    setSubaccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSubaccountSubmit}>
                Create Subaccount via Paystack API
              </Button>
              <p className="text-xs text-gray-600 flex items-center">
                ℹ️ We'll automatically save the subaccount code after creation
              </p>
            </div>
          </div>

          {/* Subaccount code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Paystack Subaccount Code</Label>
              {localSettings.paystack_subaccount_code && (
                <Badge className="bg-green-100 text-green-800 text-xs">✓ Configured</Badge>
              )}
            </div>
            <Input
              placeholder="ACCT_xxxxx"
              value={localSettings.paystack_subaccount_code || ""}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  paystack_subaccount_code: e.target.value,
                }))
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              {localSettings.paystack_subaccount_code
                ? "✓ Student payments will route to this subaccount"
                : "Auto-populated after subaccount creation, or paste existing code"}
            </p>
          </div>

          <div>
            <Label>Default Currency</Label>
            <Input
              placeholder="NGN"
              value={localSettings.default_currency || "NGN"}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, default_currency: e.target.value }))
              }
            />
          </div>

          <div>
            <Label>Invoice Prefix</Label>
            <Input
              placeholder="INV"
              value={localSettings.invoice_prefix || "INV"}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, invoice_prefix: e.target.value }))
              }
            />
          </div>

          <div>
            <Label>Receipt Prefix</Label>
            <Input
              placeholder="RCP"
              value={localSettings.receipt_prefix || "RCP"}
              onChange={(e) =>
                setLocalSettings((prev) => ({ ...prev, receipt_prefix: e.target.value }))
              }
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2 border rounded-md p-3">
            <Users className="h-4 w-4 text-gray-500" />
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={localSettings.enable_paystack_checkout ?? true}
                onChange={(e) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    enable_paystack_checkout: e.target.checked,
                  }))
                }
              />
              Enable Paystack checkout for parents and students
            </label>
          </div>

          <div className="md:col-span-2">
            <Button onClick={handleSettingsSubmit}>Save Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
