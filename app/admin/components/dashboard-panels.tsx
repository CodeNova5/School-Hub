'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  GraduationCap,
  Clock,
  Building2,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  Eye,
  FileText,
  Wallet,
  BarChart3,
  CheckCircle,
  AlertCircle,
  Activity,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Target,
  ArrowRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Welcome Header ─────────────────────────────────────────────

interface WelcomeHeaderProps {
  schoolName?: string;
  notificationCount?: number;
}

export function WelcomeHeader({ schoolName = 'your school', notificationCount = 0 }: WelcomeHeaderProps) {
  const router = useRouter();
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, Admin! <span className="inline-block animate-bounce">👋</span>
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here&apos;s what&apos;s happening at <span className="font-medium text-gray-700">{schoolName}</span> today.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/notifications')}
          className="gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
        >
          <Bell className="h-4 w-4" />
          Notifications
          {notificationCount > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/students')}
          className="gap-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
        >
          <Users className="h-4 w-4" />
          Manage Students
        </Button>
        <Button
          size="sm"
          onClick={() => router.push('/admin/admissions')}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Eye className="h-4 w-4" />
          View Admissions
        </Button>
      </div>
    </div>
  );
}

// ─── Quick Stats Cards ─────────────────────────────────────────

interface QuickStatsProps {
  stats: {
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    attendanceRate: number;
    pendingAdmissions: number;
    totalStudentsTrend?: number | null;
    totalTeachersTrend?: number | null;
    attendanceRateTrend?: number | null;
    pendingAdmissionsTrend?: number | null;
  };
}

interface StatCard {
  title: string;
  value: string;
  trend: number | null | undefined;
  trendLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  accentBorder: string;
  onClick: () => void;
}

export function QuickStatsCards({ stats }: QuickStatsProps) {
  const router = useRouter();

  const cards: StatCard[] = [
    {
      title: 'Total Students',
      value: stats.totalStudents.toLocaleString(),
      trend: stats.totalStudentsTrend,
      trendLabel: 'from last term',
      icon: Users,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      accentBorder: 'border-l-blue-500',
      onClick: () => router.push('/admin/students'),
    },
    {
      title: 'Total Teachers',
      value: stats.totalTeachers.toLocaleString(),
      trend: stats.totalTeachersTrend,
      trendLabel: 'from last term',
      icon: GraduationCap,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      accentBorder: 'border-l-indigo-500',
      onClick: () => router.push('/admin/teachers'),
    },
    {
      title: 'Attendance Today',
      value: `${stats.attendanceRate}%`,
      trend: stats.attendanceRateTrend,
      trendLabel: 'from yesterday',
      icon: Activity,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      accentBorder: 'border-l-emerald-500',
      onClick: () => router.push('/admin/attendance'),
    },
    {
      title: 'Total Classes',
      value: stats.totalClasses.toLocaleString(),
      trend: undefined,
      trendLabel: 'No change',
      icon: Building2,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      accentBorder: 'border-l-amber-500',
      onClick: () => router.push('/admin/classes'),
    },
    {
      title: 'Pending Admissions',
      value: stats.pendingAdmissions.toLocaleString(),
      trend: stats.pendingAdmissionsTrend ?? undefined,
      trendLabel: 'vs prev. week',
      icon: UserPlus,
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      accentBorder: 'border-l-rose-500',
      onClick: () => router.push('/admin/admissions'),
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const IconComponent = card.icon;
        return (
          <Card
            key={index}
            className={`cursor-pointer group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 border-gray-100 border-l-4 ${card.accentBorder}`}
            onClick={card.onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1.5 group-hover:text-blue-600 transition-colors">
                    {card.value}
                  </p>
                  {card.trend != null ? (
                    <div className="flex items-center gap-1 mt-2">
                      {card.trend > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : card.trend < 0 ? (
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                      ) : (
                        <Minus className="h-3 w-3 text-gray-400" />
                      )}
                      <span
                        className={`text-xs font-semibold ${
                          card.trend > 0
                            ? 'text-emerald-600'
                            : card.trend < 0
                              ? 'text-rose-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {card.trend > 0 ? '+' : ''}
                        {card.trend}%
                      </span>
                      <span className="text-[10px] text-gray-400">{card.trendLabel}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-2">
                      <Minus className="h-3 w-3 text-gray-300" />
                      <span className="text-[10px] text-gray-400">No previous data</span>
                    </div>
                  )}
                </div>
                <div
                  className={`${card.iconBg} p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-200`}
                >
                  <IconComponent className={`h-5 w-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Recent Activity ───────────────────────────────────────────

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
  const router = useRouter();

  return (
    <Card className="h-full border-gray-100 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
            {activities.length > 0 && (
              <Badge variant="info" className="text-[10px] px-1.5 py-0">
                {activities.length}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/history')}
            className="text-blue-600 hover:text-blue-700 text-xs font-medium h-7 gap-1"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-0">
          {activities.length > 0 ? (
            activities.map((activity, idx) => {
              const IconComponent = activity.icon;
              return (
                <div key={activity.id}>
                  <div className="flex items-start gap-3 py-3 px-1 rounded-lg hover:bg-gray-50 transition-colors -mx-1">
                    <div
                      className={`${activity.color} p-2 rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <IconComponent className={`h-4 w-4 ${activity.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 leading-snug">
                        {activity.activity}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.details}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap mt-0.5">
                      {activity.time}
                    </span>
                  </div>
                  {idx < activities.length - 1 && <Separator className="ml-10" />}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-gray-400">
              <Activity className="h-10 w-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm font-medium">No recent activities</p>
              <p className="text-xs mt-1">Activity will appear here as things happen</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Key Metrics Tabs ──────────────────────────────────────────

function formatNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`;
  return `₦${amount.toLocaleString()}`;
}

interface KeyMetricsTabsProps {
  stats: {
    totalSubjects: number;
    totalStudents: number;
    totalTeachers: number;
    totalClasses: number;
    passRate: number;
    averagePerformance: number;
  };
  finance?: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    collectionRate: number;
  };
  systemStatus: {
    attendanceRate: number;
    absentToday: number;
    lateToday: number;
  };
  termName?: string;
}

export function KeyMetricsTabs({ stats, finance, systemStatus, termName }: KeyMetricsTabsProps) {
  return (
    <Card className="border-gray-100">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">Key Metrics</CardTitle>
            {termName && (
              <p className="text-xs text-gray-500 mt-0.5">{termName}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="academics" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-5 bg-gray-50/80 p-1 rounded-xl">
            <TabsTrigger
              value="academics"
              className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 rounded-lg"
            >
              📚 Academics
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 rounded-lg"
            >
              💰 Finance
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 rounded-lg"
            >
              ✅ Attendance
            </TabsTrigger>
            <TabsTrigger
              value="operations"
              className="text-xs font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 rounded-lg"
            >
              ⚙️ Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="academics" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                icon={BookOpen}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                label="Subjects"
                value={stats.totalSubjects}
                sub="Active this term"
              />
              <MetricCard
                icon={FileText}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                label="Exams Conducted"
                value={24}
                sub="This term"
              />
              <MetricCard
                icon={BarChart3}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                label="Results Published"
                value={1156}
                sub="This term"
              />
              <MetricCard
                icon={Target}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                label="Pass Rate"
                value={`${stats.passRate}%`}
                sub="This term"
              />
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                icon={Wallet}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                label="Total Billed"
                value={formatNaira(finance?.totalBilled ?? 0)}
                sub="This term"
              />
              <MetricCard
                icon={CheckCircle}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                label="Fees Collected"
                value={formatNaira(finance?.totalPaid ?? 0)}
                sub={`${finance?.collectionRate ?? 0}% collection`}
              />
              <MetricCard
                icon={AlertCircle}
                iconBg="bg-rose-50"
                iconColor="text-rose-600"
                label="Outstanding"
                value={formatNaira(finance?.totalOutstanding ?? 0)}
                sub="Pending payments"
              />
              <MetricCard
                icon={TrendingUp}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                label="Collection Rate"
                value={`${finance?.collectionRate ?? 0}%`}
                sub="Overall"
              />
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                icon={CheckCircle}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
                label="Present Today"
                value={stats.totalStudents - systemStatus.absentToday}
                sub={`${systemStatus.attendanceRate}% rate`}
              />
              <MetricCard
                icon={AlertCircle}
                iconBg="bg-rose-50"
                iconColor="text-rose-600"
                label="Absent Today"
                value={systemStatus.absentToday}
                sub="Students"
              />
              <MetricCard
                icon={Clock}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                label="Late Arrivals"
                value={systemStatus.lateToday}
                sub="Today"
              />
              <MetricCard
                icon={Activity}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                label="Avg. Attendance"
                value={`${systemStatus.attendanceRate}%`}
                sub="This term"
              />
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-3 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard
                icon={Users}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                label="Total Students"
                value={stats.totalStudents}
                sub="Active"
              />
              <MetricCard
                icon={GraduationCap}
                iconBg="bg-indigo-50"
                iconColor="text-indigo-600"
                label="Total Teachers"
                value={stats.totalTeachers}
                sub="Active"
              />
              <MetricCard
                icon={Building2}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                label="Total Classes"
                value={stats.totalClasses}
                sub="All levels"
              />
              <MetricCard
                icon={BookOpen}
                iconBg="bg-violet-50"
                iconColor="text-violet-600"
                label="Avg Performance"
                value={`${stats.averagePerformance}`}
                sub="Score average"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50/80 hover:bg-gray-100 transition-all duration-200 group">
      <div
        className={`${iconBg} p-2.5 rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform duration-200`}
      >
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    title: 'Add Student',
    icon: Users,
    color: 'bg-blue-50',
    textColor: 'text-blue-600',
    hoverBorder: 'hover:border-blue-200',
    path: '/admin/students',
  },
  {
    title: 'Record Attendance',
    icon: ClipboardList,
    color: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-200',
    path: '/admin/attendance',
  },
  {
    title: 'Create Notice',
    icon: Bell,
    color: 'bg-amber-50',
    textColor: 'text-amber-600',
    hoverBorder: 'hover:border-amber-200',
    path: '/admin/notifications',
  },
  {
    title: 'Add Teacher',
    icon: GraduationCap,
    color: 'bg-rose-50',
    textColor: 'text-rose-600',
    hoverBorder: 'hover:border-rose-200',
    path: '/admin/teachers',
  },
  {
    title: 'Generate Report',
    icon: FileText,
    color: 'bg-violet-50',
    textColor: 'text-violet-600',
    hoverBorder: 'hover:border-violet-200',
    path: '/admin/reports',
  },
  {
    title: 'Fee Payment',
    icon: Wallet,
    color: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    hoverBorder: 'hover:border-indigo-200',
    path: '/admin/finance',
  },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-900">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          {QUICK_ACTIONS.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                onClick={() => router.push(action.path)}
                className={`h-auto py-4 flex flex-col items-center justify-center gap-2.5 border-gray-100 ${action.hoverBorder} hover:shadow-md transition-all duration-200 group`}
              >
                <div
                  className={`${action.color} p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-200`}
                >
                  <IconComponent className={`h-4 w-4 ${action.textColor}`} />
                </div>
                <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
                  {action.title}
                </span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Finance Overview ──────────────────────────────────────────

interface FinanceOverviewProps {
  totalBilled?: number;
  totalPaid?: number;
  totalOutstanding?: number;
  collectionRate?: number;
}

export function FinanceOverview({
  totalBilled = 0,
  totalPaid = 0,
  totalOutstanding = 0,
  collectionRate = 0,
}: FinanceOverviewProps) {
  const hasData = totalBilled > 0 || totalPaid > 0;

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Finance Overview</CardTitle>
          <Badge variant="outline" className="text-[10px] font-normal">
            All Time
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {hasData ? (
          <div className="space-y-4">
            {/* Collection Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 font-medium">Collection Rate</span>
                <span className="text-sm font-bold text-blue-600">{collectionRate}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(collectionRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50/80">
                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">
                  Total Paid
                </p>
                <p className="text-lg font-bold text-emerald-700 mt-0.5">{formatNaira(totalPaid)}</p>
              </div>
              <div className="p-3 rounded-lg bg-rose-50/80">
                <p className="text-[10px] text-rose-600 font-medium uppercase tracking-wider">
                  Outstanding
                </p>
                <p className="text-lg font-bold text-rose-700 mt-0.5">{formatNaira(totalOutstanding)}</p>
              </div>
            </div>

            <div className="pt-1">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Billed</p>
              <p className="text-xl font-bold text-gray-900">{formatNaira(totalBilled)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Wallet className="h-8 w-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm font-medium">No finance data yet</p>
            <p className="text-xs mt-1">Billing data will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Upcoming Events ───────────────────────────────────────────

interface Event {
  id: string;
  date: string;
  title: string;
}

interface UpcomingEventsProps {
  events?: Event[];
}
export function UpcomingEvents({ events = [] }: UpcomingEventsProps) {
  const router = useRouter();

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Upcoming Events</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/calendar')}
            className="text-blue-600 hover:text-blue-700 text-xs font-medium h-7 gap-1"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {events.length > 0 ? (
          <div className="space-y-0">
            {events.map((event, idx) => (
              <div key={event.id}>
                <div className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-gray-50 transition-colors -mx-1">
                  <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 font-medium">{event.date}</p>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{event.title}</p>
                  </div>
                </div>
                {idx < events.length - 1 && <Separator className="ml-10" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <CalendarDays className="h-8 w-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm font-medium">No upcoming events</p>
            <p className="text-xs mt-1">Schedule events from the calendar</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── System Overview ───────────────────────────────────────────

interface SystemOverviewProps {
  totalStudents?: number;
  totalTeachers?: number;
  absentToday?: number;
  lateToday?: number;
  attendanceRate?: number;
}

export function SystemOverview({
  totalStudents = 0,
  totalTeachers = 0,
  absentToday = 0,
  lateToday = 0,
  attendanceRate = 0,
}: SystemOverviewProps) {
  const presentToday = totalStudents - absentToday;
  const attendancePct = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-900">Today&apos;s Summary</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/80">
            <div className="bg-emerald-50 p-2 rounded-lg flex-shrink-0">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                Present Today
              </p>
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-gray-900">{presentToday}</p>
                <span className="text-[10px] text-emerald-500 font-medium">
                  {attendancePct}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/80">
            <div className="bg-rose-50 p-2 rounded-lg flex-shrink-0">
              <AlertCircle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                Absent Today
              </p>
              <p className="text-lg font-bold text-gray-900">{absentToday}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50/80">
              <div className="bg-amber-50 p-2 rounded-lg flex-shrink-0">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  Late
                </p>
                <p className="text-sm font-bold text-gray-900">{lateToday}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50/80">
              <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                  Teachers
                </p>
                <p className="text-sm font-bold text-gray-900">{totalTeachers}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
