"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  BookOpen, 
  ClipboardList, 
  CheckCircle2, 
  TrendingUp, 
  Calendar,
  MessageSquare,
  Award,
  ArrowRight
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface TeacherStats {
  totalStudents: number;
  totalClasses: number;
  pendingAssignments: number;
  completedSubmissions: number;
  averageScore: number;
}

interface UpcomingClass {
  id: string;
  name: string;
  time: string;
  students: number;
  subject: string;
}

interface RecentActivity {
  id: string;
  type: 'submission' | 'assignment' | 'grade' | 'attendance';
  title: string;
  description: string;
  timestamp: string;
}

export default function TeacherDashboard() {
  const [stats, setStats] = useState<TeacherStats>({
    totalStudents: 0,
    totalClasses: 0,
    pendingAssignments: 0,
    completedSubmissions: 0,
    averageScore: 0,
  });

  const [upcomingClasses, setUpcomingClasses] = useState<UpcomingClass[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeacherData() {
      try {
        // Fetch teacher's students count
        const { count: studentCount } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true });

        // Fetch teacher's classes count
        const { count: classCount } = await supabase
          .from('subject_classes')
          .select('id', { count: 'exact', head: true });

        // Fetch pending assignments
        const { count: assignmentCount } = await supabase
          .from('assignments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Set mock data for demo (you can replace with actual API calls)
        setStats({
          totalStudents: studentCount || 0,
          totalClasses: classCount || 0,
          pendingAssignments: assignmentCount || 0,
          completedSubmissions: 24,
          averageScore: 78,
        });

        // Mock upcoming classes
        setUpcomingClasses([
          {
            id: '1',
            name: 'Mathematics 101',
            time: '09:00 AM - 10:30 AM',
            students: 35,
            subject: 'Mathematics',
          },
          {
            id: '2',
            name: 'English Literature',
            time: '11:00 AM - 12:30 PM',
            students: 28,
            subject: 'English',
          },
          {
            id: '3',
            name: 'Physics Lab',
            time: '02:00 PM - 03:30 PM',
            students: 22,
            subject: 'Physics',
          },
        ]);

        // Mock recent activities
        setRecentActivities([
          {
            id: '1',
            type: 'submission',
            title: 'New Assignment Submission',
            description: 'Student submitted "Math Problem Set 5"',
            timestamp: '2 hours ago',
          },
          {
            id: '2',
            type: 'grade',
            title: 'Grades Published',
            description: '28 students received their midterm evaluations',
            timestamp: '5 hours ago',
          },
          {
            id: '3',
            type: 'assignment',
            title: 'New Assignment Created',
            description: 'Physics Assignment: Chapter 5 Exercises',
            timestamp: '1 day ago',
          },
          {
            id: '4',
            type: 'attendance',
            title: 'Attendance Recorded',
            description: 'Morning attendance for Class 2B completed',
            timestamp: '1 day ago',
          },
        ]);

        setLoading(false);
      } catch (error) {
        console.error('Error fetching teacher data:', error);
        setLoading(false);
      }
    }

    fetchTeacherData();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission':
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case 'assignment':
        return <ClipboardList className="h-4 w-4 text-purple-600" />;
      case 'grade':
        return <Award className="h-4 w-4 text-green-600" />;
      case 'attendance':
        return <Users className="h-4 w-4 text-orange-600" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'submission':
        return 'bg-blue-50 border-l-4 border-blue-600';
      case 'assignment':
        return 'bg-purple-50 border-l-4 border-purple-600';
      case 'grade':
        return 'bg-green-50 border-l-4 border-green-600';
      case 'attendance':
        return 'bg-orange-50 border-l-4 border-orange-600';
      default:
        return 'bg-gray-50 border-l-4 border-gray-600';
    }
  };

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl opacity-10 blur-xl" />
          <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16" />
            <div className="relative z-10">
              <h1 className="text-4xl font-bold mb-2">Welcome Back!</h1>
              <p className="text-blue-100 text-lg">You're doing great! Keep engaging with your students.</p>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={Users}
            trend="+8 new this month"
            trendUp={true}
          />
          <StatCard
            title="Classes"
            value={stats.totalClasses}
            icon={BookOpen}
          />
          <StatCard
            title="Pending Assignments"
            value={stats.pendingAssignments}
            icon={ClipboardList}
            trend="Review pending"
            trendUp={false}
          />
          <StatCard
            title="Submissions"
            value={stats.completedSubmissions}
            icon={CheckCircle2}
            trend="+5 this week"
            trendUp={true}
          />
          <StatCard
            title="Average Score"
            value={`${stats.averageScore}%`}
            icon={TrendingUp}
            trend="+2% improvement"
            trendUp={true}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Upcoming Classes */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <CardTitle>Today's Classes</CardTitle>
                  </div>
                  <Link href="/teacher/timetable">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                      View All <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {upcomingClasses.length > 0 ? (
                    upcomingClasses.map((classItem, index) => (
                      <div
                        key={classItem.id}
                        className="group p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100 hover:border-blue-300 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{classItem.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{classItem.time}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-medium">
                            <Users className="h-3 w-3" />
                            {classItem.students}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
                            {classItem.subject}
                          </span>
                          <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            Start Class
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No classes scheduled today</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card className="border-0 shadow-lg h-full">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-purple-50">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <Link href="/teacher/assignments">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all">
                    <ClipboardList className="h-4 w-4 mr-2" />
                    New Assignment
                  </Button>
                </Link>
                <Link href="/teacher/results/entry">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all">
                    <Award className="h-4 w-4 mr-2" />
                    Record Grades
                  </Button>
                </Link>
                <Link href="/teacher/classes">
                  <Button className="w-full bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white shadow-md hover:shadow-lg transition-all">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Classes
                  </Button>
                </Link>
                <Link href="/teacher/students">
                  <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50">
                    <BookOpen className="h-4 w-4 mr-2" />
                    View Students
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activities */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-emerald-50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              <CardTitle>Recent Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-4 rounded-lg ${getActivityColor(activity.type)} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{activity.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-2">{activity.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No recent activities</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-cyan-50">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
                Class Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {['Mathematics 101', 'Physics Lab', 'English Literature'].map((subject) => (
                  <div key={subject}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{subject}</span>
                      <span className="text-sm font-bold text-blue-600">85%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full" style={{ width: '85%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-orange-50">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" />
                Student Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Assignment Completion</span>
                    <span className="text-sm font-bold text-orange-600">92%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full" style={{ width: '92%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Class Attendance</span>
                    <span className="text-sm font-bold text-green-600">88%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full" style={{ width: '88%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Assessment Scores</span>
                    <span className="text-sm font-bold text-purple-600">78%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full" style={{ width: '78%' }} />
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
