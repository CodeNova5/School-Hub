"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Loader2, Lock, Mail, Landmark, CheckCircle2, XCircle, DollarSign, ExternalLink, Sparkles } from 'lucide-react';

interface TeacherProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  paystack_subaccount_code?: string;
}

interface PayrollSettings {
  salary_amount: number;
  total_paid: number;
}

export default function TeacherSettingsPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [payroll, setPayroll] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  // Subaccount form
  const [subaccountForm, setSubaccountForm] = useState({
    businessName: "",
    settlementBank: "",
    accountNumber: "",
    accountName: "",
  });
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);

  useEffect(() => {
    fetchTeacherProfile();
  }, [schoolId]);

  async function fetchTeacherProfile() {
    if (!schoolId) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push('/teacher/login');
        return;
      }

      const user = session.user;

      // Fetch teacher profile with subaccount code
      const { data: teacherData, error } = await supabase
        .from('teachers')
        .select('id, first_name, last_name, email, phone, paystack_subaccount_code')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .single();

      if (error || !teacherData) {
        toast.error('Failed to load profile');
        return;
      }

      setTeacher(teacherData);

      // Fetch payroll info
      try {
        const res = await fetch("/api/teacher/payroll/settings");
        const payload = await res.json();
        if (res.ok && payload.success && payload.data) {
          setPayroll({
            salary_amount: payload.data.settings?.salary_amount || 0,
            total_paid: payload.data.summary?.totalPaid || 0,
          });
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
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubaccount() {
    if (!subaccountForm.settlementBank || !subaccountForm.accountNumber) {
      toast.error('Bank code and account number are required');
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

  async function handleResetPassword() {
    const confirmed = window.confirm(
      'Are you sure you want to reset your password? A reset email will be sent to your inbox, and you will be signed out.'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setResettingPassword(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        toast.error('User session not found');
        return;
      }

      const response = await fetch('/api/teacher/reset-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to send reset email');
        return;
      }

      toast.success('Password reset email sent! Check your inbox.');
      await supabase.auth.signOut();
      router.push('/teacher/login');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error('Failed to send reset email');
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully');
      router.push('/teacher/login');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  }

  if (schoolLoading || loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your profile, payroll, and security preferences</p>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700">First Name</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-900 font-medium">{teacher?.first_name || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-700">Last Name</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-gray-900 font-medium">{teacher?.last_name || '-'}</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-gray-700 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 font-medium">{teacher?.email || '-'}</p>
              </div>
            </div>

            <div>
              <Label className="text-gray-700">Phone Number</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200">
                <p className="text-gray-900 font-medium">{teacher?.phone || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payroll / Paystack Subaccount */}
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Landmark className="w-5 h-5" />
              Payroll & Payment Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Subaccount Status */}
            <div className="rounded-xl border p-4 bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Paystack Subaccount</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Your subaccount is what allows the school to pay your salary directly to your bank account via Paystack checkout.
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
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-xs text-emerald-700 font-mono break-all">
                    Subaccount Code: {teacher.paystack_subaccount_code}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    ✓ Your account is ready to receive salary payments from the school.
                  </p>
                </div>
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
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-semibold">Total Received</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    NGN {payroll.total_paid.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Subaccount Creation Form */}
            {!teacher?.paystack_subaccount_code && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Set Up Your Paystack Subaccount</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Enter your bank details below to create a Paystack subaccount. Once set up, the school admin can pay your salary directly to this account.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-amber-800">Business/Display Name</Label>
                    <Input
                      placeholder="Your full name"
                      value={subaccountForm.businessName}
                      onChange={(e) => setSubaccountForm((prev) => ({ ...prev, businessName: e.target.value }))}
                      className="h-10 rounded-xl border-amber-200"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-amber-800">Account Name</Label>
                    <Input
                      placeholder="Account holder name"
                      value={subaccountForm.accountName}
                      onChange={(e) => setSubaccountForm((prev) => ({ ...prev, accountName: e.target.value }))}
                      className="h-10 rounded-xl border-amber-200"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-amber-800">Bank Code</Label>
                    <Input
                      placeholder="e.g. 001 (GTB)"
                      value={subaccountForm.settlementBank}
                      onChange={(e) => setSubaccountForm((prev) => ({ ...prev, settlementBank: e.target.value }))}
                      className="h-10 rounded-xl border-amber-200"
                    />
                    <p className="text-xs text-amber-600 mt-0.5">Get this from Paystack bank list or your bank</p>
                  </div>
                  <div>
                    <Label className="text-xs text-amber-800">Account Number</Label>
                    <Input
                      placeholder="e.g. 0123456789"
                      value={subaccountForm.accountNumber}
                      onChange={(e) => setSubaccountForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
                      className="h-10 rounded-xl border-amber-200"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleCreateSubaccount}
                  disabled={creatingSubaccount}
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                >
                  {creatingSubaccount ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Subaccount...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Create Paystack Subaccount</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password & Security */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <Lock className="w-5 h-5" />
              Password & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700">
              Reset your password to create a new one. A verification email will be sent to {teacher?.email}, and all active sessions will be terminated.
            </p>
            <div className="flex gap-3">
              <Button 
                onClick={handleResetPassword}
                disabled={resettingPassword}
                variant="default"
                className="bg-orange-600 hover:bg-orange-700"
              >
                {resettingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Email...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
