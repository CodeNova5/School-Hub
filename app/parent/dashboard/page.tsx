"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Users,
  Calendar,
  BookOpen,
  TrendingUp,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Eye,
  MapPin,
  ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  class_id: string;
  department: string;
  status: string;
  classes?: {
    name: string;
  };
  average_attendance?: number;
  pending_assignments?: number;
  latest_result?: {
    total: number;
    grade: string;
  };
}

interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  event_type: string;
  is_all_day: boolean;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const [children, setChildren] = useState<Student[]>([]);
  const [parentName, setParentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);

  useEffect(() => {
    loadData();
    fetchUpcomingEvents();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/parent/login");
        return;
      }

      // Get parent info
      const { data: parent, error: parentError } = await supabase
        .from("parents")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (parentError || !parent) {
        toast.error("Parent account not found");
        router.push("/parent/login");
        return;
      }

      setParentName(parent.name);

      // Get all children
      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(`
          *,
          classes(name)
        `)
        .eq("parent_email", parent.email)
        .order("first_name");

      if (studentsError) throw studentsError;

      // Fetch additional data for each child
      const enrichedStudents = await Promise.all(
        (students || []).map(async (student) => {
          // Get attendance
          const { data: attendance } = await supabase
            .from("attendance")
            .select("status")
            .eq("student_id", student.id);

          const totalRecords = attendance?.length || 0;
          const presentRecords = attendance?.filter(
            (a) => a.status === "present" || a.status === "late" || a.status === "excused"
          ).length || 0;

          const average_attendance = totalRecords === 0 ? 0 : Math.round((presentRecords / totalRecords) * 100);

          // Get pending assignments
          const { data: studentSubjects } = await supabase
            .from("student_subjects")
            .select("subject_class_id")
            .eq("student_id", student.id);

          const subjectClassIds = studentSubjects?.map(ss => ss.subject_class_id) || [];

          let pending_assignments = 0;
          if (subjectClassIds.length > 0) {
            const { data: assignments } = await supabase
              .from("assignments")
              .select("id")
              .in("subject_id", subjectClassIds)
              .gte("due_date", new Date().toISOString());

            const assignmentIds = assignments?.map(a => a.id) || [];

            if (assignmentIds.length > 0) {
              const { data: submissions } = await supabase
                .from("assignment_submissions")
                .select("assignment_id")
                .eq("student_id", student.id)
                .in("assignment_id", assignmentIds);

              const submittedIds = submissions?.map(s => s.assignment_id) || [];
              pending_assignments = assignmentIds.filter(id => !submittedIds.includes(id)).length;
            }
          }

          // Get latest result
          const { data: results } = await supabase
            .from("results")
            .select("total, grade")
            .eq("student_id", student.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...student,
            average_attendance,
            pending_assignments,
            latest_result: results?.[0] || null,
          };
        })
      );

      setChildren(enrichedStudents);
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUpcomingEvents() {
    try {
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true })
        .limit(5);

      if (events) {
        setUpcomingEvents(events);
      }
    } catch (error: any) {
      console.error("Failed to fetch events:", error.message);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalAttendance = children.length > 0
    ? Math.round(children.reduce((acc, c) => acc + (c.average_attendance || 0), 0) / children.length)
    : 0;

  const totalPendingAssignments = children.reduce((acc, c) => acc + (c.pending_assignments || 0), 0);

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome, {parentName}</h1>
          <p className="text-gray-600 mt-1">
            Monitor your {children.length === 1 ? "child's" : "children's"} academic progress
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Children</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">{children.length}</p>
                </div>
                <Users className="w-10 h-10 text-blue-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Avg. Attendance</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">{totalAttendance}%</p>
                </div>
                <CheckCircle className="w-10 h-10 text-purple-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Pending Tasks</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">{totalPendingAssignments}</p>
                </div>
                <AlertCircle className="w-10 h-10 text-orange-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Children Cards */}
        <div>
          <h2 className="text-xl font-bold mb-4">Your Children</h2>
          {children.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No children added yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {children.map((child) => (
                <Card key={child.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">
                      {child.first_name} {child.last_name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {child.classes?.name || child.class_id}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Attendance */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">Attendance</span>
                        </div>
                        <span className="text-sm font-semibold text-green-600">
                          {child.average_attendance || 0}%
                        </span>
                      </div>


                      {/* Latest Result */}
                      {child.latest_result && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">Latest Grade</span>
                          </div>
                          <span className="text-sm font-semibold text-blue-600">
                            {child.latest_result.grade}
                          </span>
                        </div>
                      )}

                      {/* View Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => router.push(`/parent/student/${child.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Upcoming Events</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/parent/calendar")}>
              View All <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          {upcomingEvents.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No upcoming events</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingEvents.slice(0, 4).map((event) => (
                <Card key={event.id} className="hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${event.event_type === "exam" ? "bg-red-100" :
                          event.event_type === "holiday" ? "bg-green-100" :
                            event.event_type === "meeting" ? "bg-blue-100" :
                              event.event_type === "sports" ? "bg-orange-100" :
                                "bg-purple-100"
                          }`}>
                          <Calendar className={`w-6 h-6 ${event.event_type === "exam" ? "text-red-600" :
                            event.event_type === "holiday" ? "text-green-600" :
                              event.event_type === "meeting" ? "text-blue-600" :
                                event.event_type === "sports" ? "text-orange-600" :
                                  "text-purple-600"
                            }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className="text-xs capitalize">{event.event_type}</Badge>
                          {event.is_all_day && (
                            <Badge variant="outline" className="text-xs">All Day</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          {event.is_all_day
                            ? new Date(event.start_date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })
                            : new Date(event.start_date).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                            <MapPin className="w-3 h-3" />
                            {event.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
