"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

export default function AssignmentDetailsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const params = useParams();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignment();
  }, []);

  async function loadAssignment() {
    setLoading(true);

    const { data: assignmentData, error: assignmentError } = await supabase
      .from("assignments")
      .select(`
      *,
      classes(name),
      subjects(name)
    `)
      .eq("id", assignmentId)
      .single();

    if (assignmentError) {
      toast.error("Failed to load assignment");
      setLoading(false);
      return;
    }

    const { data: submissionsData } = await supabase
      .from("assignment_submissions")
      .select(`
      *,
      students(
        id,
        first_name,
        last_name
      )
    `)
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: true });

    setAssignment(assignmentData);
    setSubmissions(submissionsData || []);
    setLoading(false);
  }

  function getSubmissionLabel(type: string) {
    if (type === "text") return "Text Answer";
    if (type === "file") return "File Upload";
    return "Text + File";
  }

  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96 text-muted-foreground">
          Loading assignment...
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96 text-red-500">
          Assignment not found
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">{assignment.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline">{assignment.classes?.name}</Badge>
            <Badge variant="secondary">{assignment.subjects?.name}</Badge>
            <Badge>
              <Calendar className="h-3 w-3 mr-1 inline" />
              Due {new Date(assignment.due_date).toLocaleDateString()}
            </Badge>
          </div>
        </div>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">Description</p>
              <p className="text-muted-foreground">{assignment.description || "—"}</p>
            </div>

            <div>
              <p className="font-medium">Instructions</p>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {assignment.instructions || "—"}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Badge variant="outline">
                <FileText className="h-3 w-3 mr-1 inline" />
                {getSubmissionLabel(assignment.submission_type)}
              </Badge>
              <Badge variant="outline">{assignment.total_marks} Marks</Badge>
              {!assignment.allow_late_submission && (
                <Badge variant="destructive">Late submissions not allowed</Badge>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Submissions */}
        <Card>
          <CardHeader>
            <CardTitle>
              Student Submissions ({submissions.length})
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {submissions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No submissions yet.
              </p>
            )}

            {submissions.map((submission) => (
              <div
                key={submission.id}
                className="border rounded-lg p-4 space-y-3"
              >
                {/* Student Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {submission.students?.first_name}{" "}
                      {submission.students?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted on{" "}
                      {new Date(submission.submitted_at).toLocaleString()}
                    </p>
                  </div>

                  {!submission.submitted_on_time && (
                    <Badge variant="destructive">Late</Badge>
                  )}
                </div>

                {/* Rich Text Answer */}
                {submission.submission_text && (
                  <div className="prose max-w-none border rounded-md p-4 bg-muted/40">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: submission.submission_text,
                      }}
                    />
                  </div>
                )}

                {/* File Upload */}
                {submission.file_url && (
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary underline"
                  >
                    <Upload className="h-4 w-4" />
                    View uploaded file
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
