'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

// Mock data
const studentEnrollmentData = [
  { month: 'Jan', students: 240, capacity: 400 },
  { month: 'Feb', students: 380, capacity: 400 },
  { month: 'Mar', students: 350, capacity: 400 },
  { month: 'Apr', students: 420, capacity: 450 },
  { month: 'May', students: 480, capacity: 500 },
  { month: 'Jun', students: 510, capacity: 500 },
];

const classDistributionData = [
  { name: 'JSS 1', value: 45 },
  { name: 'JSS 2', value: 48 },
  { name: 'JSS 3', value: 52 },
  { name: 'SSS 1', value: 50 },
  { name: 'SSS 2', value: 48 },
  { name: 'SSS 3', value: 45 },
];

const performanceData = [
  { class: 'JSS 1', average: 72, target: 80 },
  { class: 'JSS 2', average: 75, target: 80 },
  { class: 'JSS 3', average: 78, target: 80 },
  { class: 'SSS 1', average: 76, target: 85 },
  { class: 'SSS 2', average: 79, target: 85 },
  { class: 'SSS 3', average: 82, target: 85 },
];

const recentActivities = [
  {
    id: 1,
    activity: 'New student enrolled',
    details: 'Chioma Okoro - JSS 1A',
    time: '2 hours ago',
    icon: Users,
    color: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    id: 2,
    activity: 'Grade publication',
    details: 'SSS 3 results published',
    time: '5 hours ago',
    icon: FileText,
    color: 'bg-green-50',
    iconColor: 'text-green-600',
  },
  {
    id: 3,
    activity: 'Teacher assignment',
    details: 'Mr. Adebayo assigned to Chemistry',
    time: '1 day ago',
    icon: BookOpen,
    color: 'bg-purple-50',
    iconColor: 'text-purple-600',
  },
  {
    id: 4,
    activity: 'Holiday updated',
    details: 'Mid-term break added',
    time: '1 day ago',
    icon: Calendar,
    color: 'bg-orange-50',
    iconColor: 'text-orange-600',
  },
];

const quickStats = [
  {
    title: 'Total Students',
    value: 2847,
    trend: '+12.5%',
    trendUp: true,
    icon: GraduationCap,
  },
  {
    title: 'Active Teachers',
    value: 156,
    trend: '+3.2%',
    trendUp: true,
    icon: Users,
  },
  {
    title: 'Classes',
    value: 24,
    trend: '+2',
    trendUp: true,
    icon: BookOpen,
  },
  {
    title: 'Subjects',
    value: 89,
    trend: '-1',
    trendUp: false,
    icon: BarChart3,
  },
];

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 2847,
    totalTeachers: 156,
    totalClasses: 24,
    totalSubjects: 89,
    attendanceRate: 94.2,
    averagePerformance: 76.8,
  });

  useEffect(() => {
    // Fetch dashboard data
    // This would be replaced with actual API calls
  }, []);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your school</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="lg">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Entry
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={studentEnrollmentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis stroke="#9ca3af" />
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
                  />
                  <Line
                    type="monotone"
                    dataKey="capacity"
                    stroke="#D1D5DB"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
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
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={classDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {classDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Performance Analysis */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="border-b bg-gradient-to-r from-green-50 to-green-100 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-green-600" />
                Academic Performance by Class
              </CardTitle>
              <Badge variant="secondary">Current Term</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis stroke="#9ca3af" />
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
                {recentActivities.map((activity) => {
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
                })}
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
                      <p className="text-xs text-gray-600">94.2% - Excellent</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-purple-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Data Backup</p>
                      <p className="text-xs text-gray-600">Last run: 2 hours ago</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-orange-500 rounded-full"></div>
                    <div>
                      <p className="font-medium text-gray-900">Storage Used</p>
                      <p className="text-xs text-gray-600">68% - Adequate</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access & Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: 'Manage Students', icon: GraduationCap, color: 'bg-blue-50', textColor: 'text-blue-600', borderColor: 'border-blue-200' },
            { title: 'Manage Teachers', icon: Users, color: 'bg-purple-50', textColor: 'text-purple-600', borderColor: 'border-purple-200' },
            { title: 'Create Classes', icon: BookOpen, color: 'bg-green-50', textColor: 'text-green-600', borderColor: 'border-green-200' },
            { title: 'Settings', icon: Settings, color: 'bg-orange-50', textColor: 'text-orange-600', borderColor: 'border-orange-200' },
          ].map((action, index) => {
            const IconComponent = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
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
                    <p className="text-2xl font-bold text-blue-600 mt-2">2,847</p>
                    <p className="text-xs text-gray-600 mt-2">↑ 12.5% from last term</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600">Pass Rate</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">87%</p>
                    <p className="text-xs text-gray-600 mt-2">↑ 3.2% from last year</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-gray-600">Teacher Efficiency</p>
                    <p className="text-2xl font-bold text-purple-600 mt-2">92%</p>
                    <p className="text-xs text-gray-600 mt-2">Excellent performance</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="academics" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-sm text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold text-indigo-600 mt-2">76.8%</p>
                    <p className="text-xs text-gray-600 mt-2">Above target benchmark</p>
                  </div>
                  <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                    <p className="text-sm text-gray-600">Top Performer</p>
                    <p className="text-2xl font-bold text-cyan-600 mt-2">SSS 3</p>
                    <p className="text-xs text-gray-600 mt-2">Average: 82%</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-gray-600">Need Attention</p>
                    <p className="text-2xl font-bold text-amber-600 mt-2">JSS 1</p>
                    <p className="text-xs text-gray-600 mt-2">Average: 72%</p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attendance" className="space-y-4 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-gray-600">Overall Attendance</p>
                    <p className="text-2xl font-bold text-green-600 mt-2">94.2%</p>
                    <p className="text-xs text-gray-600 mt-2">Excellent rate</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-gray-600">Absent Today</p>
                    <p className="text-2xl font-bold text-red-600 mt-2">23</p>
                    <p className="text-xs text-gray-600 mt-2">0.8% of total</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-gray-600">Late Arrivals</p>
                    <p className="text-2xl font-bold text-yellow-600 mt-2">12</p>
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
