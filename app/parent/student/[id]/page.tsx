"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, 
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  School,
  BookOpen,
  Clock,
  TrendingUp,
  FileText,
  Award,
  UserCheck,
  CalendarDays
} from "lucide-react";
import ParentStudentAttendanceTab from "./components/ParentStudentAttendanceTab";
import ParentStudentResultsTab from "./components/ParentStudentResultsTab";
import ParentStudentAssignmentsTab from "./components/ParentStudentAssignmentsTab";
import ParentStudentTimetableTab from "./components/ParentStudentTimetableTab";

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  department: string;
  status: string;
  admission_date: string;
  class_id: string | null;
  classes?: {
    name: string;
  };
}

export default function ParentStudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState({
    attendance: 0,
    pendingAssignments: 0,
    averageScore: 0,
    totalSubjects: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/parent/login");
        return;
      }

      // Verify parent and get student
      const { data: parent } = await supabase
        .from("parents")
        .select("email")
        .eq("user_id", user.id)
        .single();

      if (!parent) {
        toast.error("Parent account not found");
        router.push("/parent/dashboard");
        return;
      }

      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("id", studentId)
        .eq("parent_email", parent.email)
        .single();

      if (studentError || !studentData) {
        toast.error("Student not found or not authorized");
        router.push("/parent/dashboard");
        return;
      }

      setStudent(studentData);

      // Get attendance stats
      const { data: attendance } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", studentId);

      const totalRecords = attendance?.length || 0;
      const presentRecords = attendance?.filter(
        a => a.status === "present" || a.status === "late" || a.status === "excused"
      ).length || 0;

      const attendanceRate = totalRecords === 0 ? 0 : Math.round((presentRecords / totalRecords) * 100);

      // Get subjects
      const { data: subjects } = await supabase
        .from("student_subjects")
        .select("subject_id")
        .eq("student_id", studentId);

      const subjectIds = subjects?.map(s => s.subject_id) || [];
      const totalSubjects = subjectIds.length;

      // Get pending assignments
      let pendingAssignments = 0;
      if (subjectIds.length > 0) {
        const { data: assignments } = await supabase
          .from("assignments")
          .select("id")
          .in("subject_id", subjectIds)
          .gte("due_date", new Date().toISOString());

        const assignmentIds = assignments?.map(a => a.id) || [];

        if (assignmentIds.length > 0) {
          const { data: submissions } = await supabase
            .from("assignment_submissions")
            .select("assignment_id")
            .eq("student_id", studentId)
            .in("assignment_id", assignmentIds);

          const submittedIds = submissions?.map(s => s.assignment_id) || [];
          pendingAssignments = assignmentIds.filter(id => !submittedIds.includes(id)).length;
        }
      }

      // Get average score
      const { data: results } = await supabase
        .from("results")
        .select("total")
        .eq("student_id", studentId)
        .eq("is_published", true);

      const averageScore = results && results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.total, 0) / results.length)
        : 0;

      setStats({
        attendance: attendanceRate,
        pendingAssignments,
        averageScore,
        totalSubjects,
      });
    } catch (error: any) {
      toast.error("Failed to load data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {student.first_name} {student.last_name}
              </h1>
              <p className="text-gray-600 mt-1">{student.student_id}</p>
            </div>
          </div>

          {/* Student Stats Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Attendance</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.attendance}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Avg Score</p>
                    <p className="text-2xl font-bold text-green-600">{stats.averageScore}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <FileText className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pending Tasks</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.pendingAssignments}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <BookOpen className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Subjects</p>
                    <p className="text-2xl font-bold text-purple-600">{stats.totalSubjects}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <Card>
            <TabsList className="grid w-full grid-cols-5 p-10 bg-muted rounded-none border-b">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Attendance</span>
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Results</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Assignments</span>
              </TabsTrigger>
              <TabsTrigger value="timetable" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Timetable</span>
              </TabsTrigger>
            </TabsList>
          </Card>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-0">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Full Name</p>
                      <p className="font-medium">{student.first_name} {student.last_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{student.email}</p>
                    </div>
                  </div>

                  {student.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="font-medium">{student.phone}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Date of Birth</p>
                      <p className="font-medium">
                        {student.date_of_birth 
                          ? new Date(student.date_of_birth).toLocaleDateString()
                          : "Not set"
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Gender</p>
                      <p className="font-medium capitalize">{student.gender || "Not set"}</p>
                    </div>
                  </div>

                  {student.address && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="font-medium">{student.address}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Academic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <School className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Class</p>
                      <p className="font-medium">{student.classes?.name || "Not assigned"}</p>
                    </div>
                  </div>

                  {student.department && (
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-600">Department</p>
                        <p className="font-medium">{student.department}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Admission Date</p>
                      <p className="font-medium">
                        {new Date(student.admission_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Award className="h-5 w-5 text-gray-500" />
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <Badge className={
                        student.status === "active" 
                          ? "bg-green-100 text-green-700 hover:bg-green-100" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                      }>
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-0">
            <ParentStudentAttendanceTab studentId={studentId} />
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="mt-0">
            <ParentStudentResultsTab studentId={studentId} />
          </TabsContent>

          {/* Assignments Tab */}
          <TabsContent value="assignments" className="mt-0">
            <ParentStudentAssignmentsTab studentId={studentId} />
          </TabsContent>

          {/* Timetable Tab */}
          <TabsContent value="timetable" className="mt-0">
            <ParentStudentTimetableTab studentId={studentId} classId={student.class_id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
