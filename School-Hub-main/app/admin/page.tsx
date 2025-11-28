"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { StatCard } from '@/components/stat-card';
import { Users, GraduationCap, School, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalClasses: 0,
    pendingAdmissions: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const [students, teachers, classes, admissions] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('teachers').select('id', { count: 'exact', head: true }),
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('admissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalStudents: students.count || 0,
        totalTeachers: teachers.count || 0,
        totalClasses: classes.count || 0,
        pendingAdmissions: admissions.count || 0,
      });
    }

    fetchStats();
  }, []);

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's an overview of your school.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            trend="+12% from last month"
            trendUp={true}
          />
          <StatCard
            title="Total Teachers"
            value={stats.totalTeachers}
            icon={GraduationCap}
            trend="+2 new this month"
            trendUp={true}
          />
          <StatCard
            title="Total Classes"
            value={stats.totalClasses}
            icon={School}
          />
          <StatCard
            title="Pending Admissions"
            value={stats.pendingAdmissions}
            icon={ClipboardList}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">New student enrolled</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Teacher completed training</p>
                    <p className="text-xs text-gray-500">5 hours ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-orange-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">New admission application</p>
                    <p className="text-xs text-gray-500">1 day ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">15</p>
                    <p className="text-xs text-gray-500">Nov</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Mid-term Examinations</p>
                    <p className="text-xs text-gray-500">All classes</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">20</p>
                    <p className="text-xs text-gray-500">Nov</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Parent-Teacher Meeting</p>
                    <p className="text-xs text-gray-500">Main Hall</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">25</p>
                    <p className="text-xs text-gray-500">Nov</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Sports Day</p>
                    <p className="text-xs text-gray-500">Sports Ground</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
