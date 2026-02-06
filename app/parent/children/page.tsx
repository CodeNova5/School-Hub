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
  Eye
} from "lucide-react";
import { useRouter } from "next/navigation";

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

export default function ParentChildPage() {
  const router = useRouter();
  const [children, setChildren] = useState<Student[]>([]);
  const [parentName, setParentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
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
            // Get subject IDs from subject_classes
            const { data: subjectClasses } = await supabase
              .from("subject_classes")
              .select("subject_id")
              .in("id", subjectClassIds);

            const subjectIds = subjectClasses?.map(sc => sc.subject_id) || [];

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
                  .eq("student_id", student.id)
                  .in("assignment_id", assignmentIds);

                const submittedIds = submissions?.map(s => s.assignment_id) || [];
                pending_assignments = assignmentIds.filter(id => !submittedIds.includes(id)).length;
              }
            }
          }

          return {
            ...student,
            average_attendance,
            pending_assignments,
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

  if (isLoading) {
    return (
      <DashboardLayout role="parent">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="parent">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {parentName}</h1>
          <p className="text-gray-600 mt-1">
            Monitor your {children.length === 1 ? "child's" : "children's"} academic progress
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Children</CardTitle>
              <Users className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{children.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {children.filter(c => c.status === "active").length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Attendance</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {children.length === 0 
                  ? "N/A" 
                  : Math.round(children.reduce((sum, c) => sum + (c.average_attendance || 0), 0) / children.length) + "%"
                }
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {children.reduce((sum, c) => sum + (c.pending_assignments || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Your Children</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {children.map((child) => (
              <Card key={child.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {child.first_name} {child.last_name}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        {child.student_id} • {child.classes?.name || "No Class"}
                      </p>
                      {child.department && (
                        <p className="text-xs text-gray-500">{child.department}</p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      child.status === "active" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {child.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-600">Attendance</p>
                        <p className="font-semibold">{child.average_attendance || 0}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-600" />
                      <div>
                        <p className="text-xs text-gray-600">Pending</p>
                        <p className="font-semibold">{child.pending_assignments || 0} tasks</p>
                      </div>
                    </div>
                    
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/parent/student/${child.id}?tab=attendance`)}
                    >
                      <Calendar className="mr-1 h-3 w-3" />
                      Attendance
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/parent/student/${child.id}?tab=results`)}
                    >
                      <TrendingUp className="mr-1 h-3 w-3" />
                      Results
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/parent/student/${child.id}?tab=assignments`)}
                    >
                      <FileText className="mr-1 h-3 w-3" />
                      Assignments
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/parent/student/${child.id}?tab=timetable`)}
                    >
                      <BookOpen className="mr-1 h-3 w-3" />
                      Timetable
                    </Button>
                  </div>

                  <Button
                    className="w-full mt-3"
                    onClick={() => router.push(`/parent/student/${child.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Full Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {children.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No children registered yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Contact the school administration to add students
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
