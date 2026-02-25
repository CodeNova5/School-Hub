"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  Calendar,
  MessageSquare,
  Award,
  ArrowRight,
  Loader2,
  Clock
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { Event } from '@/lib/types';
import Link from 'next/link';
import { toast } from 'sonner';
import { NotificationPermissionComponent } from "@/components/notification-permission";
import { useNotificationSetup } from '@/hooks/use-notification-setup';

interface TeacherStats {
  totalStudents: number;
  totalClasses: number;
  pendingAssignments: number;
  completedSubmissions: number;
  averageScore: number;
  averageAttendance?: number;
}

interface UpcomingClass {
  id: string;
  name: string;
  time: string;
  students: number;
  subject: string;
  classId: string;
}

interface RecentActivity {
  id: string;
  type: 'submission' | 'assignment' | 'grade' | 'attendance';
  title: string;
  description: string;
  timestamp: string;
}

interface ClassPerformance {
  name: string;
  score: number;
}

interface UpcomingEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  location?: string;
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
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('');
  const { syncNotificationToken } = useNotificationSetup({ role: "teacher" });

  useEffect(() => {
    async function fetchTeacherData() {
      try {
        setLoading(true);

        // Get current user
        const user = await getCurrentUser();
        if (!user) {
          toast.error('Please log in to continue');
          console.error('No user found');
          return;
        }

        // Sync notification token
        await syncNotificationToken(user.id, "teacher");

        // Get teacher info
        const teacher = await getTeacherByUserId(user.id);
        if (!teacher) {
          toast.error('Teacher profile not found');
          return;
        }

        setTeacherName(`${teacher.first_name} ${teacher.last_name}`);

        // Fetch classes assigned to this teacher
        const { data: classes, error: classError } = await supabase
          .from('classes')
          .select('id, name')
          .eq('class_teacher_id', teacher.id);

        if (classError) throw classError;
        const classIds = classes?.map(c => c.id) || [];
        const totalClasses = classIds.length;

        // Fetch students in all teacher's classes
        let students: any[] = [];
        if (classIds.length > 0) {
          const { data: studentsData, error: studentError } = await supabase
            .from('students')
            .select('id, class_id')
            .in('class_id', classIds)
            .eq('status', 'active');

          if (studentError) throw studentError;
          students = studentsData || [];
        } else {
        }
        const totalStudents = students.length;

        // Fetch subject classes for this teacher
        const { data: subjectClasses, error: subjectError } = await supabase
          .from('subject_classes')
          .select(`
            id,
            subject_id,
            class_id,
            subjects(name),
            classes(name)
          `)
          .eq('teacher_id', teacher.id);

        if (subjectError) throw subjectError;

        // Fetch assignments for this teacher (using direct teacher_id query)
        let assignments: any[] = [];

        // Get current session and term
        const { data: currentSession } = await supabase
          .from("sessions")
          .select("id")
          .eq("is_current", true)
          .single();

        const { data: currentTerm } = await supabase
          .from("terms")
          .select("id")
          .eq("is_current", true)
          .single();
        let assignmentQuery = supabase
          .from('assignments')
          .select(`
            id,
            title,
            due_date,
            subjects(name),
            assignment_submissions(id, grade)
          `)
          .eq('teacher_id', teacher.id);

        // Filter by session/term
        if (currentSession) {
          assignmentQuery = assignmentQuery.eq('session_id', currentSession.id);
        }
        if (currentTerm) {
          assignmentQuery = assignmentQuery.eq('term_id', currentTerm.id);
        }

        const { data: assignmentsData, error: assignmentError } = await assignmentQuery;
        if (assignmentError) throw assignmentError;

        // Use assignments directly (already filtered by teacher_id)
        assignments = assignmentsData || [];

        const pendingAssignments = assignments?.filter(
          a => new Date(a.due_date) > new Date()
        ).length || 0;

        const completedSubmissions = assignments?.reduce(
          (sum, a) => sum + (a.assignment_submissions?.length || 0),
          0
        ) || 0;

        // Calculate average score
        let totalScore = 0;
        let scoreCount = 0;
        assignments?.forEach(a => {
          a.assignment_submissions?.forEach((sub: any) => {
            if (sub.grade !== null) {
              totalScore += sub.grade;
              scoreCount++;
            }
          });
        });
        const averageScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

        setStats({
          totalStudents,
          totalClasses,
          pendingAssignments,
          completedSubmissions,
          averageScore,
        });


        // Fetch today's timetable
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const { data: allPeriodSlots, error: periodSlotsError } = await supabase
          .from('period_slots')
          .select('id, start_time, end_time, day_of_week')
          .eq('day_of_week', today)
          .order('start_time', { ascending: true });

        if (periodSlotsError) throw periodSlotsError;

        // Get current time
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;

        // Find current period index
        let currentPeriodIndex = 0;
        if (allPeriodSlots) {
          for (let i = 0; i < allPeriodSlots.length; i++) {
            const slot = allPeriodSlots[i];
            const [startHour, startMinute] = slot.start_time.split(':').map(Number);
            const [endHour, endMinute] = slot.end_time.split(':').map(Number);
            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;

            if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
              currentPeriodIndex = i;
              break;
            } else if (currentTimeInMinutes < startTimeInMinutes) {
              currentPeriodIndex = i;
              break;
            }
          }
        }

        // Get slots from current period to current + 5 periods
        const maxPeriodIndex = Math.min(currentPeriodIndex + 6, allPeriodSlots?.length || 0);
        const relevantPeriodIds = allPeriodSlots
          ?.slice(currentPeriodIndex, maxPeriodIndex)
          .map(slot => slot.id) || [];

        const { data: timetableData, error: timetableError } = await supabase
          .from('timetable_entries')
          .select(`
            *,
            classes(id, name),
            subject_classes(
              subjects(name),
              teachers(id)
            ),
            period_slots(start_time, end_time)
          `)
          .in('period_slot_id', relevantPeriodIds);

        if (timetableError) throw timetableError;

        // Filter timetable for this teacher and get students count
        const todayClasses: UpcomingClass[] = [];
        if (timetableData) {
          for (const entry of timetableData) {
            const subjectClass = Array.isArray(entry.subject_classes)
              ? entry.subject_classes[0]
              : entry.subject_classes;

            if (subjectClass?.teachers?.id === teacher.id) {
              const classData = entry.classes;
              const studentCount = students?.filter(
                s => s.class_id === classData.id
              ).length || 0;

              const startTime = entry.period_slots?.start_time || '';
              const endTime = entry.period_slots?.end_time || '';

              todayClasses.push({
                id: entry.id,
                name: classData.name,
                time: `${startTime} - ${endTime}`,
                students: studentCount,
                subject: subjectClass?.subjects?.name || 'Unknown',
                classId: classData.id,
              });
            }
          }
        }

        setUpcomingClasses(todayClasses);

        // Fetch upcoming events
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .gte('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(5);

        if (!eventsError && eventsData) {
          const formattedEvents: UpcomingEvent[] = eventsData.map((event: Event) => {
            const eventDate = new Date(event.start_date);
            const formattedDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return {
              id: event.id,
              title: event.title,
              date: formattedDate,
              type: event.event_type,
              location: event.location,
            };
          });
          setUpcomingEvents(formattedEvents);
        }

        // Fetch recent activities (recent assignments)
        let recentAssignments: any[] = [];

        let recentQuery = supabase
          .from('assignments')
          .select(`
            id,
            title,
            created_at,
            subjects(name),
            assignment_submissions(id)
          `)
          .eq('teacher_id', teacher.id)
          .order('created_at', { ascending: false })
          .limit(4);

        // Filter by session/term
        if (currentSession) {
          recentQuery = recentQuery.eq('session_id', currentSession.id);
        }
        if (currentTerm) {
          recentQuery = recentQuery.eq('term_id', currentTerm.id);
        }

        const { data: assignmentsDataRecent, error: recentError } = await recentQuery;
        if (recentError) throw recentError;

        // Use assignments directly (already filtered by teacher_id)
        recentAssignments = assignmentsDataRecent || [];

        const activities: RecentActivity[] = [];
        recentAssignments?.forEach((assignment: any) => {
          const submissionCount = assignment.assignment_submissions?.length || 0;
          const createdDate = new Date(assignment.created_at);
          const timeAgo = getTimeAgo(createdDate);

          activities.push({
            id: assignment.id,
            type: 'assignment',
            title: 'Assignment Created',
            description: `"${assignment.title}" for ${assignment.subjects?.name || 'Unknown Subject'}`,
            timestamp: timeAgo,
          });

          if (submissionCount > 0) {
            activities.push({
              id: `sub-${assignment.id}`,
              type: 'submission',
              title: `${submissionCount} Submission${submissionCount > 1 ? 's' : ''}`,
              description: `Students submitted responses to "${assignment.title}"`,
              timestamp: timeAgo,
            });
          }
        });

        setRecentActivities(activities.slice(0, 4));

        // Calculate class performance from results
        if (subjectClasses && subjectClasses.length > 0) {
          const subjectClassIds = subjectClasses.map(sc => sc.id);

          let resultsQuery = supabase
            .from('results')
            .select(`
              id,
              subject_class_id,
              student_id,
              exam,
              students(class_id)
            `)
            .in('subject_class_id', subjectClassIds);

          // Filter by session/term
          if (currentSession) {
            resultsQuery = resultsQuery.eq('session_id', currentSession.id);
          }
          if (currentTerm) {
            resultsQuery = resultsQuery.eq('term_id', currentTerm.id);
          }

        }
        // Fetch attendance data for the teacher's classes
        let totalAttendance = 0;
        let attendanceCount = 0;
        if (classIds.length > 0) {
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('student_id, status')
            .in('class_id', classIds);

          if (!attendanceError && attendanceData) {
            attendanceData.forEach((record: any) => {
              if (record.status === 'present') {
                totalAttendance++;
              }
              attendanceCount++;
            });
          }
        }
        const averageClassAttendance = attendanceCount > 0 ? Math.round((totalAttendance / attendanceCount) * 100) : 0;

        setStats(prev => ({
          ...prev,
          averageAttendance: averageClassAttendance
        }));

        setLoading(false);
      } catch (error) {
        console.error('Error fetching teacher data:', error);
        toast.error('Failed to load dashboard data');
        setLoading(false);
      }
    }

    fetchTeacherData();
  }, []);

  const getTimeAgo = (date: Date): string => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    const intervals: { [key: string]: number } = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [key, value] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / value);
      if (interval >= 1) {
        return interval === 1 ? `${interval} ${key} ago` : `${interval} ${key}s ago`;
      }
    }
    return 'just now';
  };

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

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="space-y-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="ml-2 text-lg text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <NotificationPermissionComponent role="teacher" autoPromptDelay={3000} />
      <div className="space-y-6 md:space-y-8">
        {/* Header Section */}
        <div className="relative pt-12 md:pt-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl opacity-10 blur-xl" />
          <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg md:rounded-2xl p-4 md:p-8 text-white shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full -mr-20 -mt-20 hidden sm:block" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white opacity-5 rounded-full -ml-16 -mb-16 hidden sm:block" />
            <div className="relative z-10">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Welcome Back, {teacherName}!</h1>
              <p className="text-blue-100 text-sm md:text-lg">You're doing great! Keep engaging with your students.</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Upcoming Classes */}
          <div className="col-span-1 lg:col-span-2">
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50 p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <CardTitle className="text-lg md:text-xl">Today's Classes</CardTitle>
                  </div>
                  <Link href="/teacher/timetable">
                    <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs md:text-sm">
                      View All <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-3 md:space-y-4">
                  {upcomingClasses.length > 0 ? (
                    upcomingClasses.map((classItem, index) => (
                      <div
                        key={classItem.id}
                        className="group p-3 md:p-4 rounded-lg md:rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100 hover:border-blue-300 transition-all cursor-pointer"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 md:mb-3 sm:gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm md:text-base text-gray-900 truncate">{classItem.name}</h3>
                            <p className="text-xs md:text-sm text-gray-600 mt-1">{classItem.time}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-medium whitespace-nowrap flex-shrink-0">
                            <Users className="h-3 w-3" />
                            {classItem.students}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <span className="text-xs font-medium text-indigo-600 bg-indigo-100 px-2 py-1 rounded whitespace-nowrap">
                            {classItem.subject}
                          </span>
                          <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-700 opacity-0 sm:group-hover:opacity-100 transition-opacity text-xs md:text-sm w-full sm:w-auto sm:justify-center">
                            Start Class
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No classes scheduled today</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-1">
            <Card className="border-0 shadow-lg h-full">
              <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-purple-50 p-4 md:p-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Award className="h-5 w-5 text-purple-600 flex-shrink-0" />
                  <span className="truncate">Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-6 space-y-2">
                <Link href="/teacher/assignments" className="block">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all text-xs md:text-sm">
                    <ClipboardList className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">New Assignment</span>
                  </Button>
                </Link>
                <Link href="/teacher/results/entry" className="block">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md hover:shadow-lg transition-all text-xs md:text-sm">
                    <Award className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Record Grades</span>
                  </Button>
                </Link>
                {stats.totalClasses > 0 && (
                  <Link href="/teacher/classes" className="block">
                    <Button className="w-full bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 text-white shadow-md hover:shadow-lg transition-all text-xs md:text-sm">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">Manage Classes</span>
                    </Button>
                  </Link>
                )}

                <Link href="/teacher/students" className="block">
                  <Button variant="outline" className="w-full border-gray-300 hover:bg-gray-50 text-xs md:text-sm">
                    <BookOpen className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">View Students</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>


        {/* Recent Activities */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-emerald-50 p-4 md:p-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <CardTitle className="text-lg md:text-xl truncate">Recent Activities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-3">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div
                    key={activity.id}
                    className={`p-3 md:p-4 rounded-lg ${getActivityColor(activity.type)} transition-all hover:shadow-md`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex-shrink-0">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm md:text-base text-gray-900">{activity.title}</p>
                        <p className="text-xs md:text-sm text-gray-600 mt-1 break-words">{activity.description}</p>
                        <p className="text-xs text-gray-500 mt-2">{activity.timestamp}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No recent activities</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-green-50 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-600 flex-shrink-0" />
                <CardTitle className="text-lg md:text-xl">Upcoming Events</CardTitle>
              </div>
              <Link href="/teacher/calendar">
                <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 text-xs md:text-sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-3">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 rounded-lg bg-gradient-to-r from-green-50 to-green-100 border border-green-100 hover:border-green-300 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm md:text-base text-gray-900 truncate">{event.title}</p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs">
                        <span className="text-gray-500">{event.date}</span>
                        {event.location && (
                          <span className="text-gray-500">{event.location}</span>
                        )}
                      </div>
                    </div>
                    <Badge className={`capitalize flex-shrink-0 ml-0 sm:ml-2 text-xs md:text-sm ${event.type === 'exam' ? 'bg-green-500' :
                      event.type === 'holiday' ? 'bg-green-500' :
                        event.type === 'meeting' ? 'bg-blue-500' :
                          event.type === 'sports' ? 'bg-orange-500' :
                            'bg-purple-500'
                      } text-white`}>
                      {event.type}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Summary - Only show if teacher has classes assigned */}
        {stats.totalClasses > 0 && (
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-cyan-50 p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                <TrendingUp className="h-5 w-5 text-cyan-600 flex-shrink-0" />
                <span className="truncate">Class Attendance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <div className="space-y-6">
                {/* Average Class Attendance */}
                <div className="border-t pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <h3 className="text-sm font-semibold text-gray-800">Average Class Attendance</h3>
                    <span className="text-lg font-bold text-green-600">{stats.averageAttendance || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full" style={{ width: `${stats.averageAttendance || 0}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
