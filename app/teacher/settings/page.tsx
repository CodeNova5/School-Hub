"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, Mail } from 'lucide-react';

interface TeacherProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

export default function TeacherSettingsPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetchTeacherProfile();
  }, []);

  async function fetchTeacherProfile() {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/teacher/login');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/teacher/login');
        return;
      }

      // Fetch teacher profile
      const { data: teacherData, error } = await supabase
        .from('teachers')
        .select('id, first_name, last_name, email, phone')
        .eq('user_id', user.id)
        .single();

      if (error || !teacherData) {
        toast.error('Failed to load profile');
        return;
      }

      setTeacher(teacherData);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    try {
      setResettingPassword(true);
      const { data: { user } } = await supabase.auth.getUser();

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
      // sign out the user after initiating password reset
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

  if (loading) {
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
          <p className="text-gray-600 mt-1">Manage your profile and security preferences</p>
        </div>

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
