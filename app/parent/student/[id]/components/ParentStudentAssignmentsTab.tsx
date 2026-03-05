"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { 
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

interface ParentStudentAssignmentsTabProps {
  studentId: string;
}

export default function ParentStudentAssignmentsTab({ studentId }: ParentStudentAssignmentsTabProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, [studentId]);

  async function loadAssignments() {
    setIsLoading(true);
    try {
      // Get student's subject_class_ids
      const { data: studentSubjects } = await supabase
        .from("student_subjects")
        .select("subject_class_id")
        .eq("student_id", studentId);

      const subjectClassIds = studentSubjects?.map((ss: any) => ss.subject_class_id) || [];

      // Get subject IDs from subject_classes
      let subjectIds: string[] = [];
      if (subjectClassIds.length > 0) {
        const { data: subjectClasses } = await supabase
          .from("subject_classes")
          .select("subject_id")
          .in("id", subjectClassIds);
        
        subjectIds = subjectClasses?.map((sc: any) => sc.subject_id) || [];
      }

      if (subjectIds.length === 0) {
        setAssignments([]);
        setIsLoading(false);
        return;
      }

      // Get assignments for those subjects
      const { data: assignmentsData, error } = await supabase
        .from("assignments")
        .select("*, subjects(name)")
        .in("subject_id", subjectIds)
        .order("due_date", { ascending: false });

      if (error) throw error;

      // Get submissions for each assignment
      const enrichedAssignments = await Promise.all(
        (assignmentsData || []).map(async (assignment: { id: any; }) => {
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
      toast.error("Failed to load assignments: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading assignments...</p>
          </div>
        </CardContent>
      </Card>
    );
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
    <div className="space-y-6">
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
  );
}
