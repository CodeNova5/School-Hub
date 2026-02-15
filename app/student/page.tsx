"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3,
  Book,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Users,
  Zap,
  Target,
  TrendingUp,
  FileText,
  Award,
  Bell,
  Activity,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";

interface StudentStats {
  totalAttendance: number;
  presentPercentage: number;
  upcomingAssignments: number;
  upcomingExams: number;
  averageScore: number;
  completedAssignments: number;
}

interface RecentActivity {
  id: string;
  title: string;
  type: "assignment" | "event" | "result" | "announcement";
  date: string;
  icon: any;
  color: string;
}

export default function StudentDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("");
  const [stats, setStats] = useState<StudentStats>({
    totalAttendance: 0,
    presentPercentage: 0,
    upcomingAssignments: 0,
    upcomingExams: 0,
    averageScore: 0,
    completedAssignments: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    loadDashboardData();
    setGreeting(getGreeting());
  }, []);

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  }

  async function loadDashboardData() {
    try {
      setLoading(true);

      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Please log in to continue");
        window.location.href = "/student/login";
        return;
      }

      // get current term ID
      const { data: termData, error: termError } = await supabase
        .from("terms")
        .select("id")
        .eq("is_current", true)
        .single();
        
      if (termError || !termData) {
        console.error("Failed to load current term:", termError);

      }

      // Fetch student details
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          classes (
            id,
            name,
            level,
            education_level
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (studentError || !studentData) {
        toast.error("Student profile not found");
        return;
      }

      setStudentId(studentData.id);
      setStudentName(`${studentData.first_name} ${studentData.last_name}`);
      const classData = studentData.classes as any;
      setStudentClass(classData?.name || "No class assigned");
      
      // Set termId for state
      if (termData && termData.id) {
        setTermId(termData.id);
      }

      // Fetch attendance stats
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", studentData.id);

      let presentPercentage = 0;
      if (attendanceData && attendanceData.length > 0) {
        const present = attendanceData.filter(
          (a) => a.status === "present" || a.status === "late"
        ).length;
        presentPercentage = Math.round(
          ((present) / attendanceData.length) * 100
        );
      }

      // Fetch upcoming events (for exams)
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("event_type", "exam")
        .gt("start_date", new Date().toISOString());

      // Fetch assignments (upcoming)
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*")
        .gt("due_date", new Date().toISOString());

      // Fetch completed assignments
      const { data: submissionsData } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("student_id", studentData.id);

      // Fetch results for average score - use termData.id directly, not state
      let averageScore = 0;
      if (termData && termData.id && classData && classData.id) {
        // First, fetch publication settings to know which components are published
        const { data: pubSettings } = await supabase
          .from("results_publication")
          .select("*")
          .eq("class_id", classData.id)
          .eq("term_id", termData.id)
          .single();

        const { data: resultsData, error: resultsError } = await supabase
          .from("results")
          .select("welcome_test, mid_term_test, vetting, exam")
          .eq("student_id", studentData.id)
          .eq("term_id", termData.id);
        
        if (resultsError) {
          console.error("Error fetching results:", resultsError);
        } else if (resultsData && resultsData.length > 0) {
          // Calculate average based only on published components
          let totalScore = 0;
          let maxScore = 0;

          resultsData.forEach((result: any) => {
            if (pubSettings?.welcome_test_published) {
              totalScore += result.welcome_test || 0;
              maxScore += 10;
            }
            if (pubSettings?.mid_term_test_published) {
              totalScore += result.mid_term_test || 0;
              maxScore += 20;
            }
            if (pubSettings?.vetting_published) {
              totalScore += result.vetting || 0;
              maxScore += 10;
            }
            if (pubSettings?.exam_published) {
              totalScore += result.exam || 0;
              maxScore += 60;
            }
          });

          if (maxScore > 0) {
            averageScore = Math.round((totalScore / maxScore) * 100);
          }
        }
      }

      // Update stats
      setStats({
        totalAttendance: attendanceData?.length || 0,
        presentPercentage,
        upcomingAssignments: assignmentsData?.length || 0,
        upcomingExams: eventsData?.length || 0,
        averageScore,
        completedAssignments: submissionsData?.length || 0,
      });

      // Build recent activities
      const activities: RecentActivity[] = [];

      // Add recent assignments
      if (assignmentsData && assignmentsData.length > 0) {
        assignmentsData.slice(0, 2).forEach((assignment) => {
          activities.push({
            id: assignment.id,
            title: assignment.title,
            type: "assignment",
            date: assignment.due_date,
            icon: BookOpen,
            color: "bg-blue-100 text-blue-600",
          });
        });
      }

      // Add upcoming exams
      if (eventsData && eventsData.length > 0) {
        eventsData.slice(0, 2).forEach((event) => {
          activities.push({
            id: event.id,
            title: event.title,
            type: "event",
            date: event.start_date,
            icon: Calendar,
            color: "bg-red-100 text-red-600",
          });
        });
      }

      // Sort by date
      activities.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setRecentActivities(activities.slice(0, 5));
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <DashboardLayout role="student">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        {/* Premium Welcome Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 rounded-2xl opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 rounded-2xl" />
          <div className="relative px-8 py-12 rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-lg font-medium mb-2">
                  {greeting} 👋
                </p>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {studentName}
                </h1>
                <p className="text-blue-100 text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {studentClass}
                </p>
              </div>
              <div className="hidden md:block text-white/20">
                <Award className="h-32 w-32" />
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Alert */}
        {stats.presentPercentage < 75 && stats.totalAttendance > 0 && (
          <Alert className="border-orange-200 bg-orange-50 border-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <AlertDescription className="text-orange-800 font-medium">
              Your attendance is at {stats.presentPercentage}%. Please maintain
              regular attendance to meet school requirements.
            </AlertDescription>
          </Alert>
        )}

        {/* Premium Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Attendance Stat Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 h-24 w-24 bg-green-100 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
            <CardContent className="relative pt-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-1">Attendance Score</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-gray-900">
                  {stats.presentPercentage}%
                </p>
                <p className="text-sm text-gray-500">
                  {stats.totalAttendance} days
                </p>
              </div>
              <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${stats.presentPercentage}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Assignments Stat Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 h-24 w-24 bg-blue-100 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
            <CardContent className="relative pt-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-blue-100 to-cyan-100 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  Pending
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-1">Assignments</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-gray-900">
                  {stats.upcomingAssignments}
                </p>
                <p className="text-sm text-gray-500">
                  {stats.completedAssignments} completed
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href="/student/assignments" className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-blue-50 hover:bg-blue-100 border-blue-200"
                  >
                    View All
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Average Score Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 h-24 w-24 bg-purple-100 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
            <CardContent className="relative pt-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                  Overall
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-1">Average Score</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-gray-900">
                  {stats.averageScore}%
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href="/student/results" className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-purple-50 hover:bg-purple-100 border-purple-200"
                  >
                    View Results
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Exams Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 h-24 w-24 bg-red-100 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
            <CardContent className="relative pt-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-red-100 to-orange-100 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <Calendar className="h-6 w-6 text-red-600" />
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                  Upcoming
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-1">Exams</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-bold text-gray-900">
                  {stats.upcomingExams}
                </p>
                <p className="text-sm text-gray-500">scheduled</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href="/student/calendar" className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-red-50 hover:bg-red-100 border-red-200"
                  >
                    Calendar
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-blue-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 h-24 w-24 bg-indigo-100 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
            <CardContent className="relative pt-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-indigo-100 to-blue-100 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-indigo-600" />
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full">
                  Today
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-1">Today's Classes</p>
              <p className="text-4xl font-bold text-gray-900 mb-4">-</p>
              <div className="flex gap-2">
                <Link href="/student/timetable" className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full bg-indigo-50 hover:bg-indigo-100 border-indigo-200"
                  >
                    Timetable
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Study Progress Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 to-amber-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute top-0 right-0 h-24 w-24 bg-yellow-100 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
            <CardContent className="relative pt-8 pb-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-gradient-to-br from-yellow-100 to-amber-100 p-3 rounded-xl group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-yellow-600" />
                </div>
                <span className="text-xs font-bold text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full">
                  Progress
                </span>
              </div>
              <p className="text-gray-600 font-medium mb-1">Study Streak</p>
              <p className="text-4xl font-bold text-gray-900 mb-4">Keep Going! 🔥</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
                  disabled
                >
                  In Progress
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities & Quick Links */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Activities */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Recent Activities</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      Your upcoming deadlines and events
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {recentActivities.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivities.map((activity, index) => {
                      const IconComponent = activity.icon;
                      return (
                        <div
                          key={activity.id}
                          className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-blue-200"
                        >
                          <div
                            className={`${activity.color} p-3 rounded-xl flex-shrink-0`}
                          >
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {activity.title}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(activity.date)}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No recent activities</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Target className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Quick Links</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Easy access to features
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Link href="/student/attendance">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <CheckCircle className="h-5 w-5 mr-3" />
                    Attendance
                  </Button>
                </Link>
                <Link href="/student/assignments">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <FileText className="h-5 w-5 mr-3" />
                    Assignments
                  </Button>
                </Link>
                <Link href="/student/results">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <BarChart3 className="h-5 w-5 mr-3" />
                    Results
                  </Button>
                </Link>
                <Link href="/student/calendar">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Calendar className="h-5 w-5 mr-3" />
                    Calendar
                  </Button>
                </Link>
                <Link href="/student/timetable">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Clock className="h-5 w-5 mr-3" />
                    Timetable
                  </Button>
                </Link>
                <Link href="/parent/login">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-left hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Users className="h-5 w-5 mr-3" />
                    Parent Portal
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Motivational Section */}
        <Card className="border-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <CardContent className="pt-8 pb-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h3 className="text-2xl font-bold mb-2">Keep Excelling! 🌟</h3>
                <p className="text-blue-100 max-w-md">
                  Your dedication and hard work are paying off. Stay focused on
                  your goals and continue to achieve great things!
                </p>
                <Link href="/student/results">
                  <Button className="mt-4 bg-white text-blue-600 hover:bg-blue-50">
                    View Your Progress
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="hidden md:block opacity-20">
                <Award className="h-24 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
