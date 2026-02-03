"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { 
  ArrowLeft, 
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle
} from "lucide-react";

interface Assignment {
  id: string;
  title: string;
  description: string;
  due_date: string;
  subject_id: string;
  total_marks: number;
  subjects?: {
    name: string;
  };
  submissions?: Array<{
    id: string;
    submitted_at: string;
    score: number | null;
    feedback: string | null;
  }>;
}

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  classes?: {
    name: string;
  };
}

export default function ParentStudentAssignmentsPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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

      // Get student's subjects
      const { data: studentSubjects } = await supabase
        .from("student_subjects")
        .select("subject_id")
        .eq("student_id", studentId);

      const subjectIds = studentSubjects?.map(ss => ss.subject_id) || [];

      if (subjectIds.length === 0) {
        setAssignments([]);
        setIsLoading(false);
        return;
      }

      // Get assignments for those subjects
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*, subjects(name)")
        .in("subject_id", subjectIds)
        .order("due_date", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Get submissions for each assignment
      const enrichedAssignments = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          const { data: submissions } = await supabase
            .from("assignment_submissions")
            .select("*")
            .eq("assignment_id", assignment.id)
            .eq("student_id", studentId);

          return {
            ...assignment,
            submissions: submissions || [],
          };
        })
      );

      setAssignments(enrichedAssignments);
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

  const now = new Date();
  const pendingAssignments = assignments.filter(
    a => !a.submissions?.length && new Date(a.due_date) > now
  ).length;
  const submittedAssignments = assignments.filter(a => a.submissions?.length).length;
  const overdueAssignments = assignments.filter(
    a => !a.submissions?.length && new Date(a.due_date) < now
  ).length;

  function getAssignmentStatus(assignment: Assignment) {
    if (assignment.submissions && assignment.submissions.length > 0) {
      return { status: "submitted", color: "green", icon: CheckCircle };
    }
    if (new Date(assignment.due_date) < now) {
      return { status: "overdue", color: "red", icon: AlertTriangle };
    }
    return { status: "pending", color: "yellow", icon: Clock };
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
              {student.first_name} {student.last_name} - Assignments
            </h1>
            <p className="text-gray-600 mt-1">
              {student.student_id} • {student.classes?.name || "No Class"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingAssignments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{submittedAssignments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueAssignments}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const { status, color, icon: StatusIcon } = getAssignmentStatus(assignment);
                const submission = assignment.submissions?.[0];

                return (
                  <div key={assignment.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">{assignment.title}</h3>
                          <Badge variant={color === "green" ? "default" : color === "red" ? "destructive" : "secondary"}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{assignment.subjects?.name}</p>
                        <p className="text-sm text-gray-700">{assignment.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          <span>{assignment.total_marks} marks</span>
                        </div>
                      </div>

                      {submission && (
                        <div className="text-sm">
                          {submission.score !== null ? (
                            <span className="font-semibold text-green-600">
                              Score: {submission.score}/{assignment.total_marks}
                            </span>
                          ) : (
                            <span className="text-gray-600">Submitted (Pending Grading)</span>
                          )}
                        </div>
                      )}
                    </div>

                    {submission?.feedback && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <p className="text-xs font-medium text-blue-900 mb-1">Teacher Feedback:</p>
                        <p className="text-sm text-blue-700">{submission.feedback}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {assignments.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No assignments found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
