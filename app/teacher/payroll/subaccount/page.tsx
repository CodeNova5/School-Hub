"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import {
  Loader2,
  Landmark,
  CheckCircle2,
  XCircle,
  DollarSign,
  Sparkles,
  ArrowLeft,
  Banknote,
  ExternalLink,
  Shield,
  Info,
  Calendar,
  Clock,
  ChevronsUpDown,
  Search,
  AlertCircle,
  Building2,
  LayoutDashboard,
  Settings,
  Pencil,
  Eye,
} from "lucide-react";
import Link from "next/link";

interface TeacherProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  paystack_subaccount_code?: string;
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
}

interface PaymentRecord {
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  period_label: string;
  reference?: string;
  payment_method?: string;
}

interface PayrollData {
  salary_amount: number;
  total_paid: number;
  pending_payments: number;
}

export default function TeacherPayrollSubaccountPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  // Subaccount form
  const [subaccountForm, setSubaccountForm] = useState({
    businessName: "",
    settlementBank: "",
    accountNumber: "",
    accountName: "",
  });
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksFailed, setBanksFailed] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [editingSubaccount, setEditingSubaccount] = useState(false);
  const [updatingSubaccount, setUpdatingSubaccount] = useState(false);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchTeacherProfile();
      fetchBanks();
    }
  }, [schoolId, schoolLoading]);

  async function fetchBanks() {
    setBanksLoading(true);
    setBanksFailed(false);
    try {
      const res = await fetch("/api/teacher/payroll/banks");
      const payload = await res.json();
      if (res.ok && payload.success && Array.isArray(payload.data)) {
        setBanks(payload.data);
      } else {
        setBanksFailed(true);
      }
    } catch {
      setBanksFailed(true);
    } finally {
      setBanksLoading(false);
    }
  }

  async function fetchTeacherProfile() {
    if (!schoolId) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/teacher/login");
        return;
      }

      const user = session.user;

      // Fetch teacher profile with subaccount code
      const { data: teacherData, error } = await supabase
        .from("teachers")
        .select("id, first_name, last_name, email, phone, paystack_subaccount_code, bank_name, bank_code, account_number, account_name")
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .single();

      if (error || !teacherData) {
        toast.error("Failed to load profile");
        return;
      }

      setTeacher(teacherData);

      // Fetch payroll info
      try {
        const res = await fetch("/api/teacher/payroll/settings");
        const payload = await res.json();
        if (res.ok && payload.success && payload.data) {
          const payments = (payload.data.recentPayments || []) as PaymentRecord[];
          setRecentPayments(payments);
          setPayroll({
            salary_amount: payload.data.settings?.salary_amount || 0,
            total_paid: payload.data.summary?.totalPaid || 0,
            pending_payments: payload.data.summary?.pendingPayments || 0,
          });

          // Store bank details from the teacher payload
          const t = payload.data.teacher;
          if (t?.bank_code || t?.account_number) {
            setTeacher((prev) =>
              prev
                ? {
                    ...prev,
                    bank_name: t.bank_name,
                    bank_code: t.bank_code,
                    account_number: t.account_number,
                    account_name: t.account_name,
                  }
                : prev
            );
          }
        }
      } catch {
        // Non-critical
      }

      // Pre-fill business name
      setSubaccountForm((prev) => ({
        ...prev,
        businessName: `${teacherData.first_name} ${teacherData.last_name}`,
      }));
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubaccount() {
    if (!subaccountForm.settlementBank || !subaccountForm.accountNumber) {
      toast.error("Bank code and account number are required");
      return;
    }
    setCreatingSubaccount(true);
    try {
      const res = await fetch("/api/teacher/payroll/subaccount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: subaccountForm.businessName || teacher?.first_name + " " + teacher?.last_name,
          settlementBank: subaccountForm.settlementBank,
          accountNumber: subaccountForm.accountNumber,
          accountName: subaccountForm.accountName,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create subaccount");
      }
      toast.success("Paystack subaccount created! You can now receive salary payments.");
      await fetchTeacherProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to create subaccount");
    } finally {
      setCreatingSubaccount(false);
    }
  }

  async function handleUpdateSubaccount() {
    if (!subaccountForm.settlementBank || !subaccountForm.accountNumber) {
      toast.error("Bank and account number are required");
      return;
    }
    setUpdatingSubaccount(true);
    try {
      const res = await fetch("/api/teacher/payroll/subaccount", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: subaccountForm.businessName || teacher?.first_name + " " + teacher?.last_name,
          settlementBank: subaccountForm.settlementBank,
          accountNumber: subaccountForm.accountNumber,
          accountName: subaccountForm.accountName,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update subaccount");
      }
      toast.success("Subaccount details updated successfully!");
      setEditingSubaccount(false);
      await fetchTeacherProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to update subaccount");
    } finally {
      setUpdatingSubaccount(false);
    }
  }

  function startEditing() {
    // Pre-fill form with current bank details
    setSubaccountForm({
      businessName: `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim(),
      settlementBank: teacher?.bank_code || "",
      accountNumber: teacher?.account_number || "",
      accountName: teacher?.account_name || "",
    });
    setEditingSubaccount(true);
  }

  function cancelEditing() {
    setEditingSubaccount(false);
    setSubaccountForm({
      businessName: `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim(),
      settlementBank: "",
      accountNumber: "",
      accountName: "",
    });
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, { class: string; label: string }> = {
      success: { class: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Paid" },
      pending: { class: "bg-amber-100 text-amber-800 border-amber-200", label: "Pending" },
      failed: { class: "bg-red-100 text-red-800 border-red-200", label: "Failed" },
      cancelled: { class: "bg-slate-100 text-slate-600 border-slate-200", label: "Cancelled" },
      reversed: { class: "bg-purple-100 text-purple-800 border-purple-200", label: "Reversed" },
    };
    const v = variants[status] || variants.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${v.class}`}>
        {status === "success" && <CheckCircle2 className="h-3 w-3" />}
        {status === "pending" && <Clock className="h-3 w-3" />}
        {status === "failed" && <XCircle className="h-3 w-3" />}
        {v.label}
      </span>
    );
  }

  const isLoading = schoolLoading || loading;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Link href="/teacher/settings" className="hover:text-gray-700 flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                Settings
              </Link>
              <span>/</span>
              <span className="text-gray-900">Payroll Setup</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Payroll &amp; Payment Setup</h1>
            <p className="text-gray-600 mt-1">
              Set up your Paystack subaccount to receive salary payments from your school.
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── Tabs ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 p-1 bg-slate-100 rounded-xl">
                <TabsTrigger
                  value="overview"
                  className="flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-sm"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="setup"
                  className="flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-sm"
                >
                  <Settings className="h-4 w-4" />
                  Setup
                  {!teacher?.paystack_subaccount_code && (
                    <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  className="flex items-center justify-center gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm py-2.5 text-sm"
                >
                  <Banknote className="h-4 w-4" />
                  History
                </TabsTrigger>
              </TabsList>

              {/* ═══════ Overview Tab ═══════ */}
              <TabsContent value="overview" className="space-y-6 mt-6 focus-visible:outline-none">
                {/* How it works banner */}
                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-blue-100 text-blue-700 shrink-0">
                        <Info className="h-5 w-5" />
                      </div>
                      <div className="text-sm text-blue-900 space-y-1">
                        <p className="font-semibold">How Payroll Works</p>
                        <p>
                          Your school uses Paystack to pay your salary directly to your bank account. Setting up a
                          subaccount allows the school to route payments securely to your bank.
                        </p>
                        <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-blue-800">
                          <li>Enter your bank details below to create a Paystack subaccount</li>
                          <li>The admin sets your salary amount</li>
                          <li>Admin processes payment → money goes directly to your bank account</li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Status & Salary Summary */}
                <Card className={teacher?.paystack_subaccount_code ? "border-emerald-200" : "border-amber-200"}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Landmark className="h-5 w-5" />
                      Payroll Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status Banner */}
                    <div
                      className={`rounded-xl border p-4 ${
                        teacher?.paystack_subaccount_code
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Subaccount Status</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {teacher?.paystack_subaccount_code
                              ? "Your subaccount is active and ready to receive salary payments."
                              : "You need to set up a subaccount before the school can pay you."}
                          </p>
                        </div>
                        <div>
                          {teacher?.paystack_subaccount_code ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 rounded-full px-3 py-1">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Configured
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 rounded-full px-3 py-1">
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Not Set
                            </Badge>
                          )}
                        </div>
                      </div>

                      {teacher?.paystack_subaccount_code && (
                        <div className="mt-3 p-3 bg-emerald-100/50 border border-emerald-200 rounded-lg">
                          <div className="flex items-center gap-2 text-emerald-800">
                            <Shield className="h-4 w-4" />
                            <p className="text-xs font-mono break-all">
                              Subaccount Code: {teacher.paystack_subaccount_code}
                            </p>
                          </div>
                          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Ready to receive salary payments from the school.
                          </p>
                        </div>
                      )}

                      {!teacher?.paystack_subaccount_code && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("setup")}
                          className="mt-3 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          <Settings className="h-3.5 w-3.5 mr-1.5" />
                          Go to Setup
                        </Button>
                      )}
                    </div>

                    {/* Salary Info */}
                    {payroll && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                          <div className="flex items-center gap-2 text-blue-800">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-sm font-semibold">Your Salary</span>
                          </div>
                          <p className="text-2xl font-bold text-blue-900 mt-1">
                            {payroll.salary_amount > 0
                              ? `NGN ${payroll.salary_amount.toLocaleString()}`
                              : "Not set by admin"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                          <div className="flex items-center gap-2 text-emerald-800">
                            <Banknote className="h-4 w-4" />
                            <span className="text-sm font-semibold">Total Received</span>
                          </div>
                          <p className="text-2xl font-bold text-emerald-900 mt-1">
                            NGN {payroll.total_paid.toLocaleString()}
                          </p>
                          {payroll.pending_payments > 0 && (
                            <p className="text-xs text-amber-600 mt-1">
                              {payroll.pending_payments} pending payment{payroll.pending_payments > 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══════ Setup Tab ═══════ */}
              <TabsContent value="setup" className="space-y-6 mt-6 focus-visible:outline-none">
                <Card className={teacher?.paystack_subaccount_code ? "border-emerald-200" : "border-amber-200"}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Paystack Subaccount Setup
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {!teacher?.paystack_subaccount_code ? (
                      <>
                        {/* Form Intro */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                          <p className="text-sm font-semibold text-amber-900">Set Up Your Paystack Subaccount</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Enter your bank details below. Once set up, the school admin can pay your salary directly
                            to this account.
                          </p>
                        </div>

                        {/* Subaccount Creation Form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-gray-700">Business/Display Name</Label>
                            <Input
                              placeholder="Your full name"
                              value={subaccountForm.businessName}
                              onChange={(e) =>
                                setSubaccountForm((prev) => ({ ...prev, businessName: e.target.value }))
                              }
                              className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-700">Account Name</Label>
                            <Input
                              placeholder="Account holder name"
                              value={subaccountForm.accountName}
                              onChange={(e) =>
                                setSubaccountForm((prev) => ({ ...prev, accountName: e.target.value }))
                              }
                              className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-700">Bank</Label>
                            {banksFailed ? (
                              <>
                                <div className="flex items-center justify-between gap-2 p-2 mb-1.5 rounded-lg bg-red-50 border border-red-200">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                    <p className="text-xs text-red-700">Could not load bank list.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={fetchBanks}
                                    className="text-xs font-medium text-red-700 underline hover:text-red-800 shrink-0"
                                  >
                                    Retry
                                  </button>
                                </div>
                                <Input
                                  placeholder="e.g. 001 (GTB)"
                                  value={subaccountForm.settlementBank}
                                  onChange={(e) =>
                                    setSubaccountForm((prev) => ({ ...prev, settlementBank: e.target.value }))
                                  }
                                  className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                                />
                              </>
                            ) : (
                              <Popover open={bankOpen} onOpenChange={setBankOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={bankOpen}
                                    disabled={banksLoading}
                                    className="h-10 w-full justify-between rounded-xl border-gray-200 bg-white text-sm font-normal hover:bg-gray-50 focus-visible:ring-blue-500"
                                  >
                                    {banksLoading ? (
                                      <span className="text-gray-400 flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Loading banks...
                                      </span>
                                    ) : subaccountForm.settlementBank ? (
                                      <span className="flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-gray-500" />
                                        {banks.find((b) => b.code === subaccountForm.settlementBank)?.name ||
                                          subaccountForm.settlementBank}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 flex items-center gap-2">
                                        <Search className="h-3.5 w-3.5" />
                                        Search for your bank...
                                      </span>
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search banks..." />
                                    <CommandList>
                                      <CommandEmpty>No bank found.</CommandEmpty>
                                      <CommandGroup>
                                        {banks.map((bank) => (
                                          <CommandItem
                                            key={bank.code}
                                            value={bank.name}
                                            onSelect={() => {
                                              setSubaccountForm((prev) => ({ ...prev, settlementBank: bank.code }));
                                              setBankOpen(false);
                                            }}
                                          >
                                            <Building2 className="mr-2 h-4 w-4 text-gray-400" />
                                            {bank.name}
                                            {subaccountForm.settlementBank === bank.code && (
                                              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                                            )}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">
                              {banksFailed
                                ? "Enter bank code manually"
                                : "Search and select your bank from the list"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-700">Account Number</Label>
                            <Input
                              placeholder="e.g. 0123456789"
                              value={subaccountForm.accountNumber}
                              onChange={(e) =>
                                setSubaccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                              }
                              className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleCreateSubaccount}
                          disabled={creatingSubaccount}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl w-full sm:w-auto"
                        >
                          {creatingSubaccount ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Subaccount...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" /> Create Paystack Subaccount
                            </>
                          )}
                        </Button>
                      </>
                    ) : editingSubaccount ? (
                      <>
                        {/* Edit Mode */}
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                          <div className="flex items-center gap-2 text-blue-800">
                            <Pencil className="h-4 w-4" />
                            <p className="text-sm font-semibold">Edit Your Bank Details</p>
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
                            Update your bank account information below. Changes will be applied to future salary
                            payments.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-gray-700">Business/Display Name</Label>
                            <Input
                              placeholder="Your full name"
                              value={subaccountForm.businessName}
                              onChange={(e) =>
                                setSubaccountForm((prev) => ({ ...prev, businessName: e.target.value }))
                              }
                              className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-700">Account Name</Label>
                            <Input
                              placeholder="Account holder name"
                              value={subaccountForm.accountName}
                              onChange={(e) =>
                                setSubaccountForm((prev) => ({ ...prev, accountName: e.target.value }))
                              }
                              className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-700">Bank</Label>
                            {banksFailed ? (
                              <>
                                <div className="flex items-center justify-between gap-2 p-2 mb-1.5 rounded-lg bg-red-50 border border-red-200">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                    <p className="text-xs text-red-700">Could not load bank list.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={fetchBanks}
                                    className="text-xs font-medium text-red-700 underline hover:text-red-800 shrink-0"
                                  >
                                    Retry
                                  </button>
                                </div>
                                <Input
                                  placeholder="e.g. 001 (GTB)"
                                  value={subaccountForm.settlementBank}
                                  onChange={(e) =>
                                    setSubaccountForm((prev) => ({ ...prev, settlementBank: e.target.value }))
                                  }
                                  className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                                />
                              </>
                            ) : (
                              <Popover open={bankOpen} onOpenChange={setBankOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={bankOpen}
                                    disabled={banksLoading}
                                    className="h-10 w-full justify-between rounded-xl border-gray-200 bg-white text-sm font-normal hover:bg-gray-50 focus-visible:ring-blue-500"
                                  >
                                    {banksLoading ? (
                                      <span className="text-gray-400 flex items-center gap-2">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Loading banks...
                                      </span>
                                    ) : subaccountForm.settlementBank ? (
                                      <span className="flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-gray-500" />
                                        {banks.find((b) => b.code === subaccountForm.settlementBank)?.name ||
                                          subaccountForm.settlementBank}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400 flex items-center gap-2">
                                        <Search className="h-3.5 w-3.5" />
                                        Search for your bank...
                                      </span>
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search banks..." />
                                    <CommandList>
                                      <CommandEmpty>No bank found.</CommandEmpty>
                                      <CommandGroup>
                                        {banks.map((bank) => (
                                          <CommandItem
                                            key={bank.code}
                                            value={bank.name}
                                            onSelect={() => {
                                              setSubaccountForm((prev) => ({
                                                ...prev,
                                                settlementBank: bank.code,
                                              }));
                                              setBankOpen(false);
                                            }}
                                          >
                                            <Building2 className="mr-2 h-4 w-4 text-gray-400" />
                                            {bank.name}
                                            {subaccountForm.settlementBank === bank.code && (
                                              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" />
                                            )}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">
                              {banksFailed
                                ? "Enter bank code manually"
                                : "Search and select your bank from the list"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-700">Account Number</Label>
                            <Input
                              placeholder="e.g. 0123456789"
                              value={subaccountForm.accountNumber}
                              onChange={(e) =>
                                setSubaccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))
                              }
                              className="h-10 rounded-xl border-gray-200 focus-visible:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            onClick={handleUpdateSubaccount}
                            disabled={updatingSubaccount}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                          >
                            {updatingSubaccount ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-2" /> Save Changes
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={cancelEditing}
                            disabled={updatingSubaccount}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* View Mode - Current Account Details */}
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            <p className="text-base font-semibold text-emerald-900">Subaccount Active</p>
                          </div>

                          {/* Subaccount Code */}
                          <div className="p-3 bg-emerald-100/50 border border-emerald-200 rounded-lg mb-4">
                            <div className="flex items-center gap-2 text-emerald-800">
                              <Shield className="h-4 w-4" />
                              <p className="text-xs font-mono break-all">
                                Code: {teacher.paystack_subaccount_code}
                              </p>
                            </div>
                          </div>

                          {/* Bank Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-white rounded-lg border border-emerald-100">
                              <p className="text-xs text-gray-500 mb-1">Bank</p>
                              <p className="text-sm font-medium text-gray-900">
                                {teacher?.bank_name
                                  ? teacher.bank_name
                                  : teacher?.bank_code
                                    ? banks.find((b) => b.code === teacher.bank_code)?.name ||
                                      `Code: ${teacher.bank_code}`
                                    : "—"}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-emerald-100">
                              <p className="text-xs text-gray-500 mb-1">Account Number</p>
                              <p className="text-sm font-medium text-gray-900">
                                {teacher?.account_number
                                  ? teacher.account_number.slice(0, -4).replace(/./g, "*") +
                                    teacher.account_number.slice(-4)
                                  : "—"}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-emerald-100">
                              <p className="text-xs text-gray-500 mb-1">Account Name</p>
                              <p className="text-sm font-medium text-gray-900">
                                {teacher?.account_name || "—"}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-emerald-100">
                              <p className="text-xs text-gray-500 mb-1">Business Name</p>
                              <p className="text-sm font-medium text-gray-900">
                                {teacher?.first_name} {teacher?.last_name}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            variant="default"
                            className="rounded-xl bg-blue-600 hover:bg-blue-700"
                            onClick={startEditing}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Bank Details
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setActiveTab("overview")}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Overview
                          </Button>
                          <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setActiveTab("history")}
                          >
                            <Banknote className="h-4 w-4 mr-2" />
                            View History
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ═══════ History Tab ═══════ */}
              <TabsContent value="history" className="space-y-6 mt-6 focus-visible:outline-none">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Banknote className="h-5 w-5" />
                      Payment History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentPayments.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Banknote className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium">No payments yet</p>
                        <p className="text-xs mt-1">
                          Your salary payments will appear here once processed by the admin.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-2 font-medium text-gray-500">Period</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-500">Amount</th>
                              <th className="text-center py-3 px-2 font-medium text-gray-500">Status</th>
                              <th className="text-center py-3 px-2 font-medium text-gray-500">Method</th>
                              <th className="text-right py-3 px-2 font-medium text-gray-500">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {recentPayments.map((payment, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-2">
                                  <p className="font-medium text-gray-900">{payment.period_label}</p>
                                </td>
                                <td className="py-3 px-2 text-right font-semibold text-gray-900">
                                  NGN {Number(payment.amount).toLocaleString()}
                                </td>
                                <td className="py-3 px-2 text-center">{getStatusBadge(payment.status)}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className="text-xs text-gray-500 capitalize">
                                    {payment.payment_method === "paystack"
                                      ? "Paystack"
                                      : payment.payment_method === "bank_transfer"
                                        ? "Bank Transfer"
                                        : payment.payment_method === "cash"
                                          ? "Cash"
                                          : payment.payment_method || "—"}
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <span className="text-xs text-gray-500 flex items-center justify-end gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {payment.paid_at
                                      ? new Date(payment.paid_at).toLocaleDateString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                        })
                                      : new Date(payment.created_at).toLocaleDateString("en-US", {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                        })}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Help section */}
                <Card className="border-slate-200 bg-slate-50">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3 text-sm text-slate-700">
                      <ExternalLink className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">Need help?</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Contact your school admin if you need your bank code or have questions about the payroll
                          process. You can also visit{" "}
                          <a
                            href="https://paystack.com/gh/banking"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            Paystack's bank list
                          </a>{" "}
                          to find your bank code.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
