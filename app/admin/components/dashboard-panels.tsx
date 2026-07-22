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
  HardDrive,
  Wifi,
  Database,
  BookOpen,
  ClipboardList,
  CalendarDays,
  Target,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Welcome Header ─────────────────────────────────────────────

interface WelcomeHeaderProps {
  schoolName?: string;
  notificationCount?: number;
}

export function WelcomeHeader({ schoolName = 'your school', notificationCount = 12 }: WelcomeHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          Welcome back, Super Admin! <span className="text-2xl">👋</span>
        </h1>
        <p className="text-gray-500 mt-1">
          Here&apos;s what&apos;s happening in {schoolName} today.
        </p>
      </div>
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/notifications')}
          className="gap-2 border-gray-200 hover:bg-gray-50"
        >
          <Bell className="h-4 w-4" />
          Notifications
          {notificationCount > 0 && (
            <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {notificationCount}
            </span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/students')}
          className="gap-2 border-gray-200 hover:bg-gray-50"
        >
          <Users className="h-4 w-4" />
          Manage Students
        </Button>
        <Button
          size="sm"
          onClick={() => router.push('/admin/admissions')}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
    totalStudentsTrend?: number;
    totalTeachersTrend?: number;
    attendanceRateTrend?: number;
  };
}

export function QuickStatsCards({ stats }: QuickStatsProps) {
  const router = useRouter();

  const cards = [
    {
      title: 'Total Students',
      value: stats.totalStudents.toLocaleString(),
      trend: stats.totalStudentsTrend,
      trendLabel: 'from last term',
      icon: Users,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      onClick: () => router.push('/admin/students'),
    },
    {
      title: 'Total Teachers',
      value: stats.totalTeachers.toLocaleString(),
      trend: stats.totalTeachersTrend,
      trendLabel: 'from last term',
      icon: GraduationCap,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      onClick: () => router.push('/admin/teachers'),
    },
    {
      title: 'Attendance Rate (Today)',
      value: `${stats.attendanceRate}%`,
      trend: stats.attendanceRateTrend,
      trendLabel: 'from yesterday',
      icon: Activity,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      onClick: () => router.push('/admin/attendance'),
    },
    {
      title: 'Total Classes',
      value: stats.totalClasses.toLocaleString(),
      trend: undefined,
      trendLabel: 'No change',
      icon: Building2,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      onClick: () => router.push('/admin/classes'),
    },
    {
      title: 'Pending Admissions',
      value: stats.pendingAdmissions.toLocaleString(),
      trend: stats.pendingAdmissions > 0 ? -4 : undefined,
      trendLabel: 'less than last week',
      icon: UserPlus,
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
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
            className="cursor-pointer hover:shadow-md transition-all duration-200 border-gray-100"
            onClick={card.onClick}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
                  {card.trend !== undefined ? (
                    <div className="flex items-center gap-1 mt-2">
                      {card.trend > 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : card.trend < 0 ? (
                        <TrendingDown className="h-3 w-3 text-rose-500" />
                      ) : (
                        <Minus className="h-3 w-3 text-gray-400" />
                      )}
                      <span className={`text-xs font-medium ${card.trend > 0 ? 'text-emerald-600' : card.trend < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                        {card.trend > 0 ? '+' : ''}{card.trend}%
                      </span>
                      <span className="text-xs text-gray-400">{card.trendLabel}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-2">
                      <Minus className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{card.trendLabel}</span>
                    </div>
                  )}
                </div>
                <div className={`${card.iconBg} p-3 rounded-full`}>
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
    <Card className="h-full border-gray-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/history')}
            className="text-blue-600 hover:text-blue-700 text-xs font-medium h-8"
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {activities.length > 0 ? (
            activities.map((activity, idx) => {
              const IconComponent = activity.icon;
              return (
                <div key={activity.id}>
                  <div className="flex items-start gap-3 py-3">
                    <div className={`${activity.color} p-2 rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className={`h-4 w-4 ${activity.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.activity}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.details}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">{activity.time}</span>
                  </div>
                  {idx < activities.length - 1 && <Separator />}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No recent activities</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Key Metrics Tabs ──────────────────────────────────────────

interface KeyMetricsTabsProps {
  stats: {
    totalSubjects: number;
    totalStudents: number;
    totalTeachers: number;
    passRate: number;
    averagePerformance: number;
  };
  systemStatus: {
    attendanceRate: number;
    absentToday: number;
    lateToday: number;
  };
  termName?: string;
}

export function KeyMetricsTabs({ stats, systemStatus, termName }: KeyMetricsTabsProps) {
  return (
    <Card className="border-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">Key Metrics</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="academics" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-gray-50">
            <TabsTrigger value="academics" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Academics
            </TabsTrigger>
            <TabsTrigger value="finance" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Finance
            </TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Attendance
            </TabsTrigger>
            <TabsTrigger value="operations" className="text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
              Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="academics" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={BookOpen}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                label="Subjects"
                value={stats.totalSubjects}
                sub="Active subjects"
              />
              <MetricCard
                icon={FileText}
                iconBg="bg-amber-100"
                iconColor="text-amber-600"
                label="Exams Conducted"
                value={24}
                sub="This term"
              />
              <MetricCard
                icon={BarChart3}
                iconBg="bg-emerald-100"
                iconColor="text-emerald-600"
                label="Results Published"
                value={1156}
                sub="This term"
              />
              <MetricCard
                icon={Target}
                iconBg="bg-violet-100"
                iconColor="text-violet-600"
                label="Pass Rate"
                value={`${stats.passRate}%`}
                sub="This term"
              />
            </div>
          </TabsContent>

          <TabsContent value="finance" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={Wallet}
                iconBg="bg-emerald-100"
                iconColor="text-emerald-600"
                label="Total Revenue"
                value="₦12.5M"
                sub="This term"
              />
              <MetricCard
                icon={CheckCircle}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                label="Fees Collected"
                value="₦8.7M"
                sub="70.3% collection"
              />
              <MetricCard
                icon={AlertCircle}
                iconBg="bg-rose-100"
                iconColor="text-rose-600"
                label="Outstanding"
                value="₦3.7M"
                sub="Pending payments"
              />
              <MetricCard
                icon={TrendingUp}
                iconBg="bg-violet-100"
                iconColor="text-violet-600"
                label="Avg Fee/Student"
                value="₦125K"
                sub="Per term"
              />
            </div>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={CheckCircle}
                iconBg="bg-emerald-100"
                iconColor="text-emerald-600"
                label="Present Today"
                value={stats.totalStudents - systemStatus.absentToday}
                sub={`${systemStatus.attendanceRate}% rate`}
              />
              <MetricCard
                icon={AlertCircle}
                iconBg="bg-rose-100"
                iconColor="text-rose-600"
                label="Absent Today"
                value={systemStatus.absentToday}
                sub="Students"
              />
              <MetricCard
                icon={Clock}
                iconBg="bg-amber-100"
                iconColor="text-amber-600"
                label="Late Arrivals"
                value={systemStatus.lateToday}
                sub="Today"
              />
              <MetricCard
                icon={Activity}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                label="Avg. Attendance"
                value={`${systemStatus.attendanceRate}%`}
                sub="This term"
              />
            </div>
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                icon={Users}
                iconBg="bg-blue-100"
                iconColor="text-blue-600"
                label="Active Users"
                value={156}
                sub="Online now"
              />
              <MetricCard
                icon={HardDrive}
                iconBg="bg-amber-100"
                iconColor="text-amber-600"
                label="Storage Used"
                value="42.7 GB"
                sub="of 100 GB"
              />
              <MetricCard
                icon={Wifi}
                iconBg="bg-emerald-100"
                iconColor="text-emerald-600"
                label="System Uptime"
                value="99.9%"
                sub="Operational"
              />
              <MetricCard
                icon={Database}
                iconBg="bg-violet-100"
                iconColor="text-violet-600"
                label="DB Status"
                value="Healthy"
                sub="All systems go"
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
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className={`${iconBg} p-2.5 rounded-lg flex-shrink-0`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-lg font-bold text-gray-900 mt-0.5">{value}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────

const QUICK_ACTIONS = [
  { title: 'Add Student', icon: Users, color: 'bg-blue-50', textColor: 'text-blue-600', path: '/admin/students' },
  { title: 'Record Attendance', icon: ClipboardList, color: 'bg-emerald-50', textColor: 'text-emerald-600', path: '/admin/attendance' },
  { title: 'Create Notice', icon: Bell, color: 'bg-amber-50', textColor: 'text-amber-600', path: '/admin/notifications' },
  { title: 'Add Teacher', icon: GraduationCap, color: 'bg-rose-50', textColor: 'text-rose-600', path: '/admin/teachers' },
  { title: 'Generate Report', icon: FileText, color: 'bg-violet-50', textColor: 'text-violet-600', path: '/admin/reports' },
  { title: 'Fee Payment', icon: Wallet, color: 'bg-indigo-50', textColor: 'text-indigo-600', path: '/admin/finance' },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <Card className="border-gray-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                onClick={() => router.push(action.path)}
                className="h-auto py-4 flex flex-col items-center justify-center gap-2 border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200"
              >
                <div className={`${action.color} p-2.5 rounded-lg`}>
                  <IconComponent className={`h-4 w-4 ${action.textColor}`} />
                </div>
                <span className="text-xs font-medium text-gray-700">{action.title}</span>
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
  totalBilled?: string;
  totalPaid?: string;
  dueAmount?: string;
  collectionRate?: number;
}

export function FinanceOverview({
  totalBilled = '₦12,450,000',
  totalPaid = '₦8,750,000',
  dueAmount = '₦3,700,000',
  collectionRate = 70.3,
}: FinanceOverviewProps) {
  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Finance Overview</CardTitle>
          <Badge variant="outline" className="text-xs font-normal">This Term</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Total Billed</p>
            <p className="text-xl font-bold text-gray-900">{totalBilled}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600">{totalPaid}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Due Amount</p>
            <p className="text-xl font-bold text-rose-600">{dueAmount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Collection Rate</p>
            <p className="text-xl font-bold text-blue-600">{collectionRate}%</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>
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
}export function UpcomingEvents({ events = [
  { id: '1', date: 'May 27, 2025', title: "Children's Day Celebration" },
  { id: '2', date: 'May 30, 2025', title: 'End of Term 2' },
  { id: '3', date: 'Jun 2, 2025', title: 'Term 3 Resumes' },
] }: UpcomingEventsProps) {
  const router = useRouter();

  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">Upcoming Events</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/calendar')}
            className="text-blue-600 hover:text-blue-700 text-xs font-medium h-8"
          >
            View Calendar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {events.map((event, idx) => (
            <div key={event.id}>
              <div className="flex items-center gap-3 py-3">
                <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 font-medium">{event.date}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{event.title}</p>
                </div>
              </div>
              {idx < events.length - 1 && <Separator />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── System Overview ───────────────────────────────────────────

interface SystemOverviewProps {
  activeUsers?: number;
  storageUsed?: string;
  storageTotal?: string;
  uptime?: string;
  dbStatus?: 'Healthy' | 'Warning' | 'Critical';
}

export function SystemOverview({
  activeUsers = 156,
  storageUsed = '42.7 GB',
  storageTotal = '100 GB',
  uptime = '99.9%',
  dbStatus = 'Healthy',
}: SystemOverviewProps) {
  return (
    <Card className="border-gray-100 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-gray-900">System Overview</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Users</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{activeUsers}</p>
              <p className="text-[10px] text-emerald-500 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Online now
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-violet-50 p-2 rounded-lg flex-shrink-0">
              <HardDrive className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Storage Used</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{storageUsed}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">of {storageTotal}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg flex-shrink-0">
              <Wifi className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">System Uptime</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{uptime}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Operational</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-amber-50 p-2 rounded-lg flex-shrink-0">
              <Database className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Database Status</p>
              <p className="text-lg font-bold text-gray-900 mt-0.5">{dbStatus}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">All systems go</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
