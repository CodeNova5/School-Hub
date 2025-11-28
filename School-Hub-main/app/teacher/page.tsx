"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { StatCard } from '@/components/stat-card';
import { School, Users, FileText, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TeacherDashboard() {
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    pendingGrading: 0,
    upcomingExams: 0,
  });

  useEffect(() => {
    async function fetchStats() {
      const [classes, students, submissions] = await Promise.all([
        supabase.from('subject_assignments').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        totalClasses: classes.count || 0,
        totalStudents: students.count || 0,
        pendingGrading: submissions.count || 0,
        upcomingExams: 3,
      });
    }

    fetchStats();
  }, []);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's your teaching overview.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="My Classes"
            value={stats.totalClasses}
            icon={School}
          />
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
          />
          <StatCard
            title="Pending Grading"
            value={stats.pendingGrading}
            icon={FileText}
          />
          <StatCard
            title="Upcoming Exams"
            value={stats.upcomingExams}
            icon={ClipboardCheck}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-bold">8:00 AM</p>
                  </div>
                  <div>
                    <p className="font-medium">Mathematics - Grade 10A</p>
                    <p className="text-sm text-gray-600">Room 201</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-bold">10:00 AM</p>
                  </div>
                  <div>
                    <p className="font-medium">Mathematics - Grade 10B</p>
                    <p className="text-sm text-gray-600">Room 203</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-bold">1:00 PM</p>
                  </div>
                  <div>
                    <p className="font-medium">Mathematics - Grade 11</p>
                    <p className="text-sm text-gray-600">Room 205</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <button className="w-full p-4 text-left bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold text-blue-900">Mark Attendance</p>
                <p className="text-sm text-blue-700">Record today's attendance</p>
              </button>
              <button className="w-full p-4 text-left bg-gradient-to-r from-green-50 to-green-100 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold text-green-900">Grade Assignments</p>
                <p className="text-sm text-green-700">{stats.pendingGrading} pending submissions</p>
              </button>
              <button className="w-full p-4 text-left bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg hover:shadow-md transition-shadow">
                <p className="font-semibold text-orange-900">Create Assignment</p>
                <p className="text-sm text-orange-700">Add new assignment for classes</p>
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
