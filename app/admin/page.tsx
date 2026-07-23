'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { DashboardSkeleton } from '@/components/dashboard-skeleton';
import { Button } from '@/components/ui/button';

import { SubscriptionGraceBanner } from '@/components/subscription-grace-banner';
import { SubscriptionTermBanner } from '@/components/subscription-term-banner';
import { SubscriptionHolidayBanner } from '@/components/subscription-holiday-banner';
import { StudentLimitBanner, type LimitInfo } from '@/components/student-limit-banner';
import { AlertCircle, FileText, Calendar, GraduationCap } from 'lucide-react';
import { OnboardingChecklist } from '@/components/onboarding-checklist';
import { useRouter } from 'next/navigation';
import { useNotificationSetup } from '@/hooks/use-notification-setup';
import { useSchoolContext } from '@/hooks/use-school-context';
import { supabase } from '@/lib/supabase';
import {
  EnrollmentTrendChart,
  ClassDistributionChart,
} from './components/dashboard-charts';
import {
  WelcomeHeader,
  QuickStatsCards,
  RecentActivities,
  QuickActions,
  KeyMetricsTabs,
  FinanceOverview,
  UpcomingEvents,
  SystemOverview,
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
    trends: {
      totalStudents: number | null;
      totalTeachers: number | null;
      attendanceRate: number | null;
      pendingAdmissions: number | null;
    };
  };
  classDistribution: Array<{ name: string; value: number }>;
  enrollmentTrend: Array<{ month: string; students: number }>;
  recentActivities: {
    events: any[];
    admissions: any[];
    students: any[];
  };
  finance: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  upcomingEvents: Array<{ id: string; title: string; date: string; type: string }>;
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
  const [limitInfo, setLimitInfo] = useState<LimitInfo | null>(null);
  const { syncNotificationToken } = useNotificationSetup({ role: 'admin' });
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      fetchDashboardData();
      fetchStudentLimit();
      syncTokenOnLoad();
    }
  }, [schoolId, schoolLoading]);

  const fetchStudentLimit = async () => {
    try {
      const res = await fetch('/api/admin/check-student-limit');
      const data = await res.json();
      setLimitInfo(data);
    } catch {
      // Silent fail — banner handles gracefully
    }
  };

  const syncTokenOnLoad = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  const getRecentActivities = () => {
    if (!dashboardData) return [];

    const activities: any[] = [];

    dashboardData.recentActivities.students.slice(0, 3).forEach((student: any) => {
      activities.push({
        id: `student-${student.first_name}`,
        activity: 'New student admission',
        details: `${student.first_name} ${student.last_name} was admitted to ${student.classes?.name || 'Class'}`,
        time: formatTimeAgo(student.created_at),
        icon: GraduationCap,
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
        activity: event.event_type === 'holiday' ? 'Holiday added' : 'Event scheduled',
        details: event.title,
        time: formatTimeAgo(event.created_at),
        icon: Calendar,
        color: 'bg-amber-50',
        iconColor: 'text-amber-600',
      });
    });

    return activities.slice(0, 5);
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

  const isNewSchool =
    (dashboardData?.stats?.totalStudents ?? 0) === 0 &&
    (dashboardData?.stats?.totalTeachers ?? 0) === 0;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        {/* ── Critical Banners (only show when relevant) ── */}
        <OnboardingChecklist isNewSchool={isNewSchool} />
        <StudentLimitBanner limitInfo={limitInfo} />
        <SubscriptionGraceBanner />
        <SubscriptionTermBanner />
        <SubscriptionHolidayBanner />

        {/* ── Welcome & Quick Stats ── */}
        <WelcomeHeader
          schoolName="Greenfield Group of Schools"
          notificationCount={12}
        />

        <QuickStatsCards
          stats={{
            totalStudents: dashboardData.stats.totalStudents,
            totalTeachers: dashboardData.stats.totalTeachers,
            totalClasses: dashboardData.stats.totalClasses,
            attendanceRate: dashboardData.stats.attendanceRate,
            pendingAdmissions: dashboardData.stats.pendingAdmissions,
            totalStudentsTrend: dashboardData.stats.trends?.totalStudents ?? null,
            totalTeachersTrend: dashboardData.stats.trends?.totalTeachers ?? null,
            attendanceRateTrend: dashboardData.stats.trends?.attendanceRate ?? null,
            pendingAdmissionsTrend: dashboardData.stats.trends?.pendingAdmissions ?? null,
          }}
        />

        {/* ── Charts & Activity ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EnrollmentTrendChart data={dashboardData.enrollmentTrend} />
          </div>
          <RecentActivities activities={getRecentActivities()} />
        </div>

        {/* ── Class Distribution & Quick Actions ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ClassDistributionChart data={dashboardData.classDistribution} />
          </div>
          <QuickActions />
        </div>

        {/* ── Key Metrics ── */}
        <KeyMetricsTabs
          stats={dashboardData.stats}
          finance={dashboardData.finance}
          systemStatus={dashboardData.systemStatus}
          termName={dashboardData.currentTerm?.name}
        />

        {/* ── Bottom Row: Finance, Events, System ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <FinanceOverview
            totalBilled={dashboardData.finance?.totalBilled ?? 0}
            totalPaid={dashboardData.finance?.totalPaid ?? 0}
            totalOutstanding={dashboardData.finance?.totalOutstanding ?? 0}
            collectionRate={dashboardData.finance?.collectionRate ?? 0}
          />
          <UpcomingEvents events={dashboardData.upcomingEvents ?? []} />
          <SystemOverview
            totalStudents={dashboardData.stats.totalStudents}
            totalTeachers={dashboardData.stats.totalTeachers}
            absentToday={dashboardData.systemStatus.absentToday}
            lateToday={dashboardData.systemStatus.lateToday}
            attendanceRate={dashboardData.systemStatus.attendanceRate}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
