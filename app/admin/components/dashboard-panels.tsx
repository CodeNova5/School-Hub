'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Quick Stats Cards ─────────────────────────────────────────────

interface QuickStatsProps {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
  };
}

export function QuickStatsCards({ stats }: QuickStatsProps) {
  const router = useRouter();

  const cards = [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      trend: `${stats.totalStudents > 0 ? '+' : ''}${stats.totalStudents}`,
      trendUp: true,
      icon: GraduationCap,
      onClick: () => router.push('/admin/students'),
    },
    {
      title: 'Active Teachers',
      value: stats.totalTeachers,
      trend: stats.totalTeachers > 0 ? 'Active' : 'None',
      trendUp: true,
      icon: Users,
      onClick: () => router.push('/admin/teachers'),
    },
    {
      title: 'Classes',
      value: stats.totalClasses,
      trend: `${stats.totalClasses} active`,
      trendUp: true,
      icon: BookOpen,
      onClick: () => router.push('/admin/classes'),
    },
    {
      title: 'Subjects',
      value: stats.totalSubjects,
      trend: `${stats.totalSubjects} subjects`,
      trendUp: true,
      icon: BarChart3,
      onClick: () => router.push('/admin/subjects'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}

// ─── Recent Activities ─────────────────────────────────────────────

interface Activity {
  id: string;
  activity: string;
  details: string;
  time: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  iconColor: string;
}

interface RecentActivitiesProps {
  activities: Activity[];
}

export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-indigo-100 pb-6">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600" />
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {activities.length > 0 ? (
            activities.map((activity) => {
              const IconComponent = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                >
                  <div
                    className={`${activity.color} p-3 rounded-lg flex items-center justify-center flex-shrink-0`}
                  >
                    <IconComponent className={`h-5 w-5 ${activity.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{activity.activity}</p>
                    <p className="text-sm text-gray-600 mt-1">{activity.details}</p>
                    <p className="text-xs text-gray-500 mt-2">{activity.time}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              No recent activities
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── System Status ─────────────────────────────────────────────────

interface SystemStatusProps {
  systemStatus: {
    absentToday: number;
    lateToday: number;
    attendanceRate: number;
  };
  pendingAdmissions: number;
}

export function SystemStatus({ systemStatus, pendingAdmissions }: SystemStatusProps) {
  const attendanceLabel =
    systemStatus.attendanceRate >= 90 ? 'Excellent' :
    systemStatus.attendanceRate >= 80 ? 'Good' :
    systemStatus.attendanceRate >= 70 ? 'Fair' : 'Needs Attention';

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-rose-100 pb-6">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-600" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <StatusItem
            color="bg-green-50 border-green-200"
            dotColor="bg-green-500"
            label="Server Status"
            detail="All systems operational"
          />
          <StatusItem
            color="bg-blue-50 border-blue-200"
            dotColor="bg-blue-500"
            label="Attendance Rate"
            detail={`${systemStatus.attendanceRate}% - ${attendanceLabel}`}
          />
          <StatusItem
            color="bg-orange-50 border-orange-200"
            dotColor="bg-orange-500"
            label="Absent Today"
            detail={`${systemStatus.absentToday} student${systemStatus.absentToday !== 1 ? 's' : ''}`}
          />
          <StatusItem
            color="bg-yellow-50 border-yellow-200"
            dotColor="bg-yellow-500"
            label="Late Arrivals"
            detail={`${systemStatus.lateToday} student${systemStatus.lateToday !== 1 ? 's' : ''} today`}
          />
          {pendingAdmissions > 0 && (
            <StatusItem
              color="bg-purple-50 border-purple-200"
              dotColor="bg-purple-500"
              label="Pending Admissions"
              detail={`${pendingAdmissions} application${pendingAdmissions !== 1 ? 's' : ''}`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusItem({ color, dotColor, label, detail }: { color: string; dotColor: string; label: string; detail: string }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${color}`}>
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 ${dotColor} rounded-full`} />
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-600">{detail}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { title: 'Manage Students', icon: GraduationCap, color: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200', path: '/admin/students' },
  { title: 'Manage Teachers', icon: Users, color: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200', path: '/admin/teachers' },
  { title: 'Manage Classes', icon: BookOpen, color: 'bg-green-50', textColor: 'text-green-600', borderColor: 'border-green-200', path: '/admin/classes' },
  { title: 'JAMB CBT Access', icon: FileText, color: 'bg-cyan-50', textColor: 'text-cyan-600', borderColor: 'border-cyan-200', path: '/admin/jamb' },
  { title: 'Notifications', icon: Bell, color: 'bg-amber-50', textColor: 'text-amber-600', borderColor: 'border-amber-200', path: '/admin/notifications' },
  { title: 'Settings', icon: Settings, color: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200', path: '/admin/settings' },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
      {QUICK_ACTIONS.map((action, index) => {
        const IconComponent = action.icon;
        return (
          <Button
            key={index}
            variant="outline"
            onClick={() => router.push(action.path)}
            className={`h-auto py-6 flex flex-col items-center justify-center gap-3 ${action.borderColor} hover:shadow-lg transition-all`}
          >
            <div className={`${action.color} p-3 rounded-lg`}>
              <IconComponent className={`h-6 w-6 ${action.textColor}`} />
            </div>
            <span className="text-sm font-medium text-gray-900">{action.title}</span>
          </Button>
        );
      })}
    </div>
  );
}

// ─── Key Metrics Tabs ──────────────────────────────────────────────

interface KeyMetricsTabsProps {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    totalSubjects: number;
    averagePerformance: number;
    passRate: number;
  };
  systemStatus: {
    absentToday: number;
    lateToday: number;
    attendanceRate: number;
  };
}

export function KeyMetricsTabs({ stats, systemStatus }: KeyMetricsTabsProps) {
  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100 pb-6">
        <CardTitle>Key Metrics Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="academics">Academics</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricBox
                bg="bg-blue-50 border-blue-200"
                textColor="text-blue-600"
                label="Total Enrollment"
                value={stats.totalStudents.toLocaleString()}
                sub="Active students"
              />
              <MetricBox
                bg="bg-green-50 border-green-200"
                textColor="text-green-600"
                label="Pass Rate"
                value={`${stats.passRate}%`}
                sub="Current term"
              />
              <MetricBox
                bg="bg-purple-50 border-purple-200"
                textColor="text-purple-600"
                label="Active Teachers"
                value={stats.totalTeachers.toString()}
                sub="Teaching staff"
              />
            </div>
          </TabsContent>

          <TabsContent value="academics" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricBox
                bg="bg-indigo-50 border-indigo-200"
                textColor="text-indigo-600"
                label="Average Score"
                value={`${stats.averagePerformance}%`}
                sub={stats.averagePerformance >= 75 ? 'Excellent' : stats.averagePerformance >= 60 ? 'Good' : 'Needs improvement'}
              />
              <MetricBox
                bg="bg-cyan-50 border-cyan-200"
                textColor="text-cyan-600"
                label="Total Classes"
                value={stats.totalClasses.toString()}
                sub="Active classes"
              />
              <MetricBox
                bg="bg-amber-50 border-amber-200"
                textColor="text-amber-600"
                label="Total Subjects"
                value={stats.totalSubjects.toString()}
                sub="Available subjects"
              />
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricBox
                bg="bg-green-50 border-green-200"
                textColor="text-green-600"
                label="Overall Attendance"
                value={`${systemStatus.attendanceRate}%`}
                sub={systemStatus.attendanceRate >= 90 ? 'Excellent rate' : systemStatus.attendanceRate >= 80 ? 'Good rate' : 'Needs attention'}
              />
              <MetricBox
                bg="bg-red-50 border-red-200"
                textColor="text-red-600"
                label="Absent Today"
                value={systemStatus.absentToday.toString()}
                sub={stats.totalStudents > 0 ? `${((systemStatus.absentToday / stats.totalStudents) * 100).toFixed(1)}% of total` : 'N/A'}
              />
              <MetricBox
                bg="bg-yellow-50 border-yellow-200"
                textColor="text-yellow-600"
                label="Late Arrivals"
                value={systemStatus.lateToday.toString()}
                sub="Today"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MetricBox({ bg, textColor, label, value, sub }: { bg: string; textColor: string; label: string; value: string; sub: string }) {
  return (
    <div className={`p-4 rounded-lg border ${bg}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-2xl font-bold ${textColor} mt-2`}>{value}</p>
      <p className="text-xs text-gray-600 mt-2">{sub}</p>
    </div>
  );
}
