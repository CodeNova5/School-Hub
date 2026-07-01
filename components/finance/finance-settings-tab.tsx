"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Landmark, Loader2, CheckCircle2, AlertCircle, Building2, CreditCard } from "lucide-react";
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const submitSettings = async () => {
    setSavingSettings(true);
    try {
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
    } finally {
      setSavingSettings(false);
    }
  };

  const submitSubaccountCreation = async () => {
    if (!subaccountForm.businessName || !subaccountForm.settlementBank || !subaccountForm.accountNumber) {
      throw new Error("Business name, settlement bank and account number are required");
    }

    setCreatingSubaccount(true);
    try {
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
    } finally {
      setCreatingSubaccount(false);
    }
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

  const isConfigured = !!localSettings.paystack_subaccount_code;

  return (
    <div className="space-y-6 mt-6">
      {/* Info card */}
      <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-blue-900 text-sm font-semibold flex items-center gap-2">
            <div className="p-1 rounded-lg bg-blue-100">
              <CreditCard className="h-4 w-4 text-blue-600" />
            </div>
            How Student Payments Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p>Students pay school fees securely through <strong>Paystack</strong></p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p><strong>100% of payments</strong> go directly to your school's bank account via subaccount routing</p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p>No funds stay in our main account — <strong>automatic settlement</strong> to your registered bank</p>
          </div>
        </CardContent>
      </Card>

      {/* Main settings card */}
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md">
        <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white pb-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gray-100">
              <Settings className="h-4 w-4 text-gray-600" />
            </div>
            Paystack & Finance Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Subaccount registration */}
            <div className="md:col-span-2 border border-amber-200 rounded-xl p-5 space-y-4 bg-gradient-to-br from-amber-50 to-orange-50/30">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-900">Step 1: Register School Bank Account</p>
                </div>
                <p className="text-xs text-amber-700">
                  Create a Paystack subaccount so payments route directly to your school's bank account.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">School/Business Name</label>
                  <Input
                    placeholder="e.g., ABC School"
                    value={subaccountForm.businessName}
                    onChange={(e) =>
                      setSubaccountForm((prev) => ({ ...prev, businessName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Settlement Bank Code</label>
                  <Input
                    placeholder="e.g., 001 (GTB)"
                    value={subaccountForm.settlementBank}
                    onChange={(e) =>
                      setSubaccountForm((prev) => ({ ...prev, settlementBank: e.target.value }))
                    }
                  />
                  <p className="text-[10px] text-gray-400">Find codes in Paystack's bank list</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Account Number</label>
                  <Input
                    placeholder="e.g., 0123456789"
                    value={subaccountForm.accountNumber}
                    onChange={(e) =>
                      setSubaccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2 border-amber-300 hover:bg-amber-100 transition-all duration-200"
                  onClick={handleSubaccountSubmit}
                  disabled={creatingSubaccount}
                >
                  {creatingSubaccount ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Landmark className="h-4 w-4" />
                      Create Subaccount
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500">
                  The subaccount code will auto-save after creation
                </p>
              </div>
            </div>

            {/* Subaccount code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-600">Paystack Subaccount Code</Label>
                {isConfigured ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                    Not set up
                  </Badge>
                )}
              </div>
              <Input
                placeholder="ACCT_xxxxx"
                value={localSettings.paystack_subaccount_code || ""}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, paystack_subaccount_code: e.target.value }))
                }
              />
              <p className="text-[10px] text-gray-400">
                {isConfigured
                  ? "Student payments will route to this subaccount"
                  : "Auto-populated after subaccount creation"}
              </p>
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Default Currency</Label>
              <Input
                placeholder="NGN"
                value={localSettings.default_currency || "NGN"}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, default_currency: e.target.value }))
                }
              />
            </div>

            {/* Invoice prefix */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Invoice Prefix</Label>
              <Input
                placeholder="INV"
                value={localSettings.invoice_prefix || "INV"}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, invoice_prefix: e.target.value }))
                }
              />
            </div>

            {/* Receipt prefix */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Receipt Prefix</Label>
              <Input
                placeholder="RCP"
                value={localSettings.receipt_prefix || "RCP"}
                onChange={(e) =>
                  setLocalSettings((prev) => ({ ...prev, receipt_prefix: e.target.value }))
                }
              />
            </div>

            {/* Paystack checkout toggle */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 border border-gray-200 rounded-lg p-3.5 transition-all duration-150 hover:border-indigo-200 hover:bg-indigo-50/20">
                <Users className="h-5 w-5 text-gray-400 shrink-0" />
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={localSettings.enable_paystack_checkout ?? true}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        enable_paystack_checkout: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Enable Paystack checkout</span>
                    <p className="text-xs text-gray-400">Allow parents and students to pay online</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Save button */}
            <div className="md:col-span-2">
              <Button
                className="gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                onClick={handleSettingsSubmit}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Settings className="h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
