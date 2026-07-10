"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Loader2, Lock, Mail, Landmark, CheckCircle2, XCircle, DollarSign, ExternalLink, Pen } from 'lucide-react';

interface TeacherProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  paystack_subaccount_code?: string;
  signature_url?: string;
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
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  // Helper function to upload file to GitHub
  async function uploadFileToGitHub(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "teacher_signature");
      formData.append("teacher_id", teacher?.id || "");

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unknown error');
      }

      return result.fileUrl;
    } catch (error) {
      console.error('Failed to upload signature:', error);
      toast.error('Failed to upload signature');
      return null;
    }
  }

  async function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !teacher) return;

    setUploadingSignature(true);
    try {
      // Preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const signatureUrl = await uploadFileToGitHub(file);
      if (signatureUrl) {
        // Save to database
        const { error: updateError } = await supabase
          .from('teachers')
          .update({ signature_url: signatureUrl, updated_at: new Date().toISOString() })
          .eq('id', teacher.id);

        if (updateError) {
          toast.error('Failed to save signature URL');
          return;
        }

        setTeacher(prev => prev ? { ...prev, signature_url: signatureUrl } : null);
        toast.success('Signature uploaded successfully!');
      }
    } finally {
      setUploadingSignature(false);
    }
  }

  // Subaccount creation is handled on the dedicated /teacher/payroll/subaccount page

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

      // Fetch teacher profile with subaccount code and signature
      const { data: teacherData, error } = await supabase
        .from('teachers')
        .select('id, first_name, last_name, email, phone, paystack_subaccount_code, signature_url')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .maybeSingle();

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

    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
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

            {/* Signature Preview */}
            <div className="border-t pt-4">
              <Label className="text-gray-700 text-sm font-semibold">Signature</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                {teacher?.signature_url ? (
                  <div className="flex flex-col gap-2">
                    <img
                      src={teacher.signature_url}
                      alt="Teacher Signature"
                      className="h-14 object-contain"
                    />
                    <a href={teacher.signature_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                      Open in new tab
                    </a>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No signature uploaded</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pen className="w-5 h-5" />
              Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
Upload your signature as an image (PNG, JPG) or vector SVG file. SVG files stay perfectly sharp on printed report cards. Use a free tool like Vectorizer.ai to convert a paper signature to SVG.
            </p>

            {/* Preview current signature */}
            {signaturePreview && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">New signature preview:</p>
                <img
                  src={signaturePreview}
                  alt="Signature Preview"
                  className="h-12 object-contain"
                />
                <p className="text-xs text-green-600 mt-2">✓ Ready to upload</p>
              </div>
            )}

            {teacher?.signature_url && !signaturePreview && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 mb-2">Current signature:</p>
                <img
                  src={teacher.signature_url}
                  alt="Current Signature"
                  className="h-12 object-contain"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Input
                id="teacher_signature"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleSignatureUpload}
                disabled={uploadingSignature}
                className="text-sm"
              />
              {uploadingSignature && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
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
          <CardContent className="space-y-4">
            {/* Subaccount Status */}
            <div className="rounded-xl border p-4 bg-slate-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Paystack Subaccount</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Your subaccount allows the school to pay your salary directly to your bank account.
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

            {/* Link to dedicated subaccount page */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">
                    {teacher?.paystack_subaccount_code ? "Manage Subaccount" : "Set Up Subaccount"}
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    {teacher?.paystack_subaccount_code
                      ? "View your subaccount details, salary info, and payment history."
                      : "Enter your bank details to create a Paystack subaccount and start receiving salary payments."}
                  </p>
                </div>
                <Button
                  asChild
                  className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl shrink-0"
                >
                  <Link href="/teacher/payroll/subaccount">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {teacher?.paystack_subaccount_code ? "Manage" : "Set Up"}
                  </Link>
                </Button>
              </div>
            </div>
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
