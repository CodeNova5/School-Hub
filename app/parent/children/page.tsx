"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Users, Eye, TrendingUp, Clock, FileText } from "lucide-react";

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

export default function ParentChildrenPage() {
  const router = useRouter();
  const [children, setChildren] = useState<Student[]>([]);
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

      const { data: parent } = await supabase
        .from("parents")
        .select("email")
        .eq("user_id", user.id)
        .single();

      if (!parent) {
        toast.error("Parent account not found");
        router.push("/parent/login");
        return;
      }

      const { data: students, error: studentsError } = await supabase
        .from("students")
        .select(`
          *,
          classes(name)
        `)
        .eq("parent_email", parent.email)
        .order("first_name");

      if (studentsError) throw studentsError;

      const enrichedStudents = await Promise.all(
        (students || []).map(async (student) => {
          const { data: attendance } = await supabase
            .from("attendance")
            .select("status")
            .eq("student_id", student.id);

          const totalRecords = attendance?.length || 0;
          const presentRecords = attendance?.filter(
            (a) => a.status === "present" || a.status === "late" || a.status === "excused"
          ).length || 0;

          const average_attendance = totalRecords === 0 ? 0 : Math.round((presentRecords / totalRecords) * 100);

          const { data: studentSubjects } = await supabase
            .from("student_subjects")
            .select("subject_id")
            .eq("student_id", student.id);

          const subjectIds = studentSubjects?.map(ss => ss.subject_id) || [];

          let pending_assignments = 0;
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

          const { data: results } = await supabase
            .from("results")
            .select("total, grade")
            .eq("student_id", student.id)
            .eq("is_published", true)
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
          <h1 className="text-3xl font-bold">My Children</h1>
          <p className="text-gray-600 mt-1">
            View and manage all your children's academic information
          </p>
        </div>

        {children.length > 0 ? (
          <div className="grid gap-6">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                    {child.latest_result && (
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-600">Latest Result</p>
                          <p className="font-semibold">
                            {child.latest_result.total}% ({child.latest_result.grade})
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="text-xs text-gray-600">Email</p>
                        <p className="font-semibold text-xs">{child.email}</p>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => router.push(`/parent/student/${child.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Full Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
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
    </DashboardLayout>
  );
}
