'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  BookOpen,
  GraduationCap,
  Calendar,
  TrendingUp,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Settings,
  Download,
  Plus,
  Loader2,
  UserPlus,
  Bell,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { useNotificationSetup } from '@/hooks/use-notification-setup';
import { supabase } from '@/lib/supabase';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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
  const { syncNotificationToken } = useNotificationSetup({ role: "admin" });

  useEffect(() => {
    fetchDashboardData();
    syncTokenOnLoad();
  }, []);

  const syncTokenOnLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await syncNotificationToken(user.id, "admin");
      }
    } catch (err) {
      console.error("Failed to sync notification token:", err);
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

  // Format time ago
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

  // Build recent activities from different sources
  const getRecentActivities = () => {
    if (!dashboardData) return [];

    const activities: any[] = [];

    // Add recent students
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

    // Add recent admissions
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

    // Add recent events
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
        <div className="space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !dashboardData) {
    return (
      <DashboardLayout role="admin">
        <div className="space-y-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
              <p className="text-gray-600 mb-4">{error || 'Unknown error'}</p>
              <Button onClick={fetchDashboardData}>Try Again</Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const quickStats = [
    {
      title: 'Total Students',
      value: dashboardData.stats.totalStudents,
      trend: `${dashboardData.stats.totalStudents > 0 ? '+' : ''}${dashboardData.stats.totalStudents}`,
      trendUp: true,
      icon: GraduationCap,
    },
    {
      title: 'Active Teachers',
      value: dashboardData.stats.totalTeachers,
      trend: `${dashboardData.stats.totalTeachers > 0 ? 'Active' : 'None'}`,
      trendUp: true,
      icon: Users,
    },
    {
      title: 'Classes',
      value: dashboardData.stats.totalClasses,
      trend: `${dashboardData.stats.totalClasses} active`,
      trendUp: true,
      icon: BookOpen,
    },
    {
      title: 'Subjects',
      value: dashboardData.stats.totalSubjects,
      trend: `${dashboardData.stats.totalSubjects} subjects`,
      trendUp: true,
      icon: BarChart3,
    },
  ];

  const recentActivities = getRecentActivities();

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's an overview of your school
              {dashboardData.currentSession && ` - ${dashboardData.currentSession.name}`}
            </p>
          </div>
          <div className="flex gap-3">
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

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat, index) => (
            <StatCard
              key={index}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              trend={stat.trend}
              trendUp={stat.trendUp}
            />
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student Enrollment Trend */}
          <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-blue-100 pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5 text-blue-600" />
                  Student Enrollment Trend
                </CardTitle>
                <Badge variant="secondary">Last 6 months</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {dashboardData.enrollmentTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dashboardData.enrollmentTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="students"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={{ fill: '#3B82F6', r: 5 }}
                      activeDot={{ r: 7 }}
                      name="Students Enrolled"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No enrollment data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Class Distribution */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-purple-100 pb-6">
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-purple-600" />
                Class Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {dashboardData.classDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.classDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {dashboardData.classDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  No class data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Analysis */}
        {dashboardData.performanceByClass.length > 0 && (
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="border-b bg-gradient-to-r from-green-50 to-green-100 pb-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  Academic Performance by Class
                </CardTitle>
                <Badge variant="secondary">
                  {dashboardData.currentTerm?.name || 'Current Term'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dashboardData.performanceByClass}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="class" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="average" fill="#10B981" name="Class Average" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="target" fill="#F59E0B" name="Target Score" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Two Column Layout - Activities and System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activities */}
          <Card className="lg:col-span-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="border-b bg-gradient-to-r from-indigo-50 to-indigo-100 pb-6">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-600" />
                Recent Activities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity) => {
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

          {/* System Status */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="border-b bg-gradient-to-r from-rose-50 to-rose-100 pb-6">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Status Item */}
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Server Status</p>
                      <p className="text-xs text-gray-600">All systems operational</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Attendance Rate</p>
                      <p className="text-xs text-gray-600">
                        {dashboardData.systemStatus.attendanceRate}% - 
                        {dashboardData.systemStatus.attendanceRate >= 90 ? ' Excellent' : 
                         dashboardData.systemStatus.attendanceRate >= 80 ? ' Good' : 
                         dashboardData.systemStatus.attendanceRate >= 70 ? ' Fair' : ' Needs Attention'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-orange-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Absent Today</p>
                      <p className="text-xs text-gray-600">
                        {dashboardData.systemStatus.absentToday} student{dashboardData.systemStatus.absentToday !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Late Arrivals</p>
                      <p className="text-xs text-gray-600">
                        {dashboardData.systemStatus.lateToday} student{dashboardData.systemStatus.lateToday !== 1 ? 's' : ''} today
                      </p>
                    </div>
                  </div>
                </div>

                {dashboardData.stats.pendingAdmissions > 0 && (
                  <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                      <div>
                        <p className="font-medium text-gray-900">Pending Admissions</p>
                        <p className="text-xs text-gray-600">
                          {dashboardData.stats.pendingAdmissions} application{dashboardData.stats.pendingAdmissions !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[
            { title: 'Manage Students', icon: GraduationCap, color: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200', path: '/admin/students' },
            { title: 'Manage Teachers', icon: Users, color: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200', path: '/admin/teachers' },
            { title: 'Manage Classes', icon: BookOpen, color: 'bg-green-50', textColor: 'text-green-600', borderColor: 'border-green-200', path: '/admin/classes' },
            { title: 'Notifications', icon: Bell, color: 'bg-amber-50', textColor: 'text-amber-600', borderColor: 'border-amber-200', path: '/admin/notifications' },
            { title: 'Settings', icon: Settings, color: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200', path: '/admin/settings' },
          ].map((action, index) => {
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

        {/* Key Metrics Summary */}
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
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-gray-600">Total Enrollment</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">
                      {dashboardData.stats.totalStudents.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">Active students</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600">Pass Rate</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                      {dashboardData.stats.passRate}%
                    </p>
                    <p className="text-xs text-gray-600 mt-2">Current term</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600">Active Teachers</p>
                    <p className="text-2xl font-bold text-purple-600 mt-2">
                      {dashboardData.stats.totalTeachers}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">Teaching staff</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="academics" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-sm text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-2">
                      {dashboardData.stats.averagePerformance}%
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      {dashboardData.stats.averagePerformance >= 75 ? 'Excellent' : 
                       dashboardData.stats.averagePerformance >= 60 ? 'Good' : 'Needs improvement'}
                    </p>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <p className="text-sm text-gray-600">Total Classes</p>
                    <p className="text-2xl font-bold text-cyan-600 mt-2">
                      {dashboardData.stats.totalClasses}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">Active classes</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-gray-600">Total Subjects</p>
                    <p className="text-2xl font-bold text-amber-600 mt-2">
                      {dashboardData.stats.totalSubjects}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">Available subjects</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attendance" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600">Overall Attendance</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">
                      {dashboardData.systemStatus.attendanceRate}%
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      {dashboardData.systemStatus.attendanceRate >= 90 ? 'Excellent rate' : 
                       dashboardData.systemStatus.attendanceRate >= 80 ? 'Good rate' : 'Needs attention'}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-600">Absent Today</p>
                    <p className="text-2xl font-bold text-red-600 mt-2">
                      {dashboardData.systemStatus.absentToday}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      {dashboardData.stats.totalStudents > 0 
                        ? `${((dashboardData.systemStatus.absentToday / dashboardData.stats.totalStudents) * 100).toFixed(1)}% of total`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-gray-600">Late Arrivals</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-2">
                      {dashboardData.systemStatus.lateToday}
                    </p>
                    <p className="text-xs text-gray-600 mt-2">Today</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
