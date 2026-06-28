'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { Button } from '@/components/ui/button';
import { SubscriptionGraceBanner } from '@/components/subscription-grace-banner';
import { SubscriptionTermBanner } from '@/components/subscription-term-banner';
import { SubscriptionHolidayBanner } from '@/components/subscription-holiday-banner';
import { SubscriptionYearlyTimeline } from '@/components/subscription-yearly-timeline';
import { Bell, GraduationCap, Plus, AlertCircle, UserPlus, FileText, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useNotificationSetup } from '@/hooks/use-notification-setup';
import { useSchoolContext } from '@/hooks/use-school-context';
import { supabase } from '@/lib/supabase';
import {
  EnrollmentTrendChart,
  ClassDistributionChart,
  PerformanceChart,
} from './components/dashboard-charts';
import {
  QuickStatsCards,
  RecentActivities,
  SystemStatus,
  QuickActions,
  KeyMetricsTabs,
} from './components/dashboard-panels';

interface DashboardData {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    attendanceRate: number;
    averagePerformance: number;
    passRate: number;
    pendingAdmissions: number;
  };
  classDistribution: Array<{ name: string; value: number }>;
  enrollmentTrend: Array<{ month: string; students: number }>;
  performanceByClass: Array<{ class: string; average: number; target: number }>;
  recentActivities: {
    events: any[];
    admissions: any[];
    students: any[];
  };
  systemStatus: {
    absentToday: number;
    lateToday: number;
    attendanceRate: number;
  };
  currentSession: any;
  currentTerm: any;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { syncNotificationToken } = useNotificationSetup({ role: 'admin' });
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchDashboardData();
      syncTokenOnLoad();
    }
  }, [schoolId, schoolLoading]);

  const syncTokenOnLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user && schoolId) {
        await syncNotificationToken(user.id, 'admin', schoolId);
      }
    } catch (err) {
      console.error('Failed to sync notification token:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/dashboard');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }

      setDashboardData(result.data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return then.toLocaleDateString();
  };

  const getRecentActivities = () => {
    if (!dashboardData) return [];

    const activities: any[] = [];

    dashboardData.recentActivities.students.slice(0, 3).forEach((student: any) => {
      activities.push({
        id: `student-${student.first_name}`,
        activity: 'New student enrolled',
        details: `${student.first_name} ${student.last_name} - ${student.classes?.name || 'No Class'}`,
        time: formatTimeAgo(student.created_at),
        icon: UserPlus,
        color: 'bg-blue-50',
        iconColor: 'text-blue-600',
      });
    });

    dashboardData.recentActivities.admissions.slice(0, 2).forEach((admission: any) => {
      activities.push({
        id: `admission-${admission.id}`,
        activity: 'New admission application',
        details: `${admission.first_name} ${admission.last_name} - ${admission.status}`,
        time: formatTimeAgo(admission.created_at),
        icon: FileText,
        color: 'bg-green-50',
        iconColor: 'text-green-600',
      });
    });

    dashboardData.recentActivities.events.slice(0, 2).forEach((event: any) => {
      activities.push({
        id: `event-${event.id}`,
        activity: event.event_type === 'holiday' ? 'Holiday scheduled' : 'Event scheduled',
        details: event.title,
        time: formatTimeAgo(event.created_at),
        icon: Calendar,
        color: 'bg-orange-50',
        iconColor: 'text-orange-600',
      });
    });

    return activities.slice(0, 4);
  };

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  if (error || !dashboardData) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
            <p className="text-gray-600 mb-4">{error || 'Unknown error'}</p>
            <Button onClick={fetchDashboardData}>Try Again</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <SubscriptionGraceBanner />
        <SubscriptionTermBanner />
        <SubscriptionHolidayBanner />
        <SubscriptionYearlyTimeline />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's an overview of your school
              {dashboardData.currentSession && ` - ${dashboardData.currentSession.name}`}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button variant="outline" size="lg" onClick={() => router.push('/admin/notifications')}>
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push('/admin/students')}>
              <GraduationCap className="h-4 w-4 mr-2" />
              Manage Students
            </Button>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/admin/admissions')}>
              <Plus className="h-4 w-4 mr-2" />
              View Admissions
            </Button>
          </div>
        </div>

        {/* Stats */}
        <QuickStatsCards stats={dashboardData.stats} />

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <EnrollmentTrendChart data={dashboardData.enrollmentTrend} />
          <ClassDistributionChart data={dashboardData.classDistribution} />
        </div>

        {dashboardData.performanceByClass.length > 0 && (
          <PerformanceChart
            data={dashboardData.performanceByClass}
            termName={dashboardData.currentTerm?.name}
          />
        )}

        {/* Activities & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RecentActivities activities={getRecentActivities()} />
          <SystemStatus
            systemStatus={dashboardData.systemStatus}
            pendingAdmissions={dashboardData.stats.pendingAdmissions}
          />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Key Metrics */}
        <KeyMetricsTabs
          stats={dashboardData.stats}
          systemStatus={dashboardData.systemStatus}
        />
      </div>
    </DashboardLayout>
  );
}
