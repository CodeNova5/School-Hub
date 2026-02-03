"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Award
} from "lucide-react";

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
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-gray-600 mt-1">{student.student_id}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Attendance</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.attendance}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.averageScore}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <FileText className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingAssignments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalSubjects}</div>
            </CardContent>
          </Card>
        </div>

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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    student.status === "active" 
                      ? "bg-green-100 text-green-700" 
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {student.status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/parent/student/${studentId}/attendance`)}
              >
                <Clock className="mr-2 h-4 w-4" />
                View Attendance
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/parent/student/${studentId}/results`)}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                View Results
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/parent/student/${studentId}/assignments`)}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Assignments
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/parent/student/${studentId}/timetable`)}
              >
                <Calendar className="mr-2 h-4 w-4" />
                View Timetable
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
