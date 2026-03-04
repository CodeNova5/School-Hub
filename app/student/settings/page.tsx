"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, Mail, User } from 'lucide-react';
import { useSchoolContext } from '@/hooks/use-school-context';

interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  student_id: string;
  class_id?: string;
}

export default function StudentSettingsPage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchStudentProfile();
    }
  }, [schoolId, schoolLoading]);

  async function fetchStudentProfile() {
    if (!schoolId) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push('/student/login');
        return;
      }

      const user = session.user;

      // Fetch student profile
      const { data: studentData, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, email, phone, student_id, class_id')
        .eq('user_id', user.id)
        .eq('school_id', schoolId)
        .single();

      if (error || !studentData) {
        toast.error('Failed to load profile');
        return;
      }

      setStudent(studentData);
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

      const response = await fetch('/api/student/reset-password', {
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
      // sign out the user after initiating password reset
      await supabase.auth.signOut();
      router.push('/student/login');
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
      router.push('/student/login');
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-8 px-2 sm:px-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold break-words">Settings</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base break-words">Manage your profile and security preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 text-sm">First Name</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 overflow-x-auto">
                  <p className="text-gray-900 font-medium break-words text-sm">{student?.first_name || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-700 text-sm">Last Name</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 overflow-x-auto">
                  <p className="text-gray-900 font-medium break-words text-sm">{student?.last_name || '-'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 text-sm">Student ID</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 overflow-x-auto">
                  <p className="text-gray-900 font-medium break-words text-sm">{student?.student_id || '-'}</p>
                </div>
              </div>
              <div>
                <Label className="text-gray-700 flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 overflow-x-auto">
                  <p className="text-gray-900 font-medium break-words text-sm">{student?.email || '-'}</p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-gray-700 text-sm">Phone Number</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded-md border border-gray-200 overflow-x-auto">
                <p className="text-gray-900 font-medium break-words text-sm">{student?.phone || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 text-base sm:text-lg">
              <Lock className="w-5 h-5" />
              Password & Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700 break-words">
              Reset your password to create a new one. A verification email will be sent to {student?.email}, and all active sessions will be terminated.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleResetPassword}
                disabled={resettingPassword}
                variant="default"
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
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
                className="border-red-300 text-red-600 hover:bg-red-50 w-full sm:w-auto"
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
