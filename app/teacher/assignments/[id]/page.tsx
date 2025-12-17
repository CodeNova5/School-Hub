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
  const params = useParams();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignment();
  }, []);

  async function loadAssignment() {
    setLoading(true);
    const { data, error } = await supabase
      .from("assignments")
      .select(`
        *,
        classes(name),
        subjects(name)
      `)
      .eq("id", assignmentId)
      .single();

    if (error) {
      toast.error("Failed to load assignment");
    } else {
      setAssignment(data);
    }
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

        {/* Student Submission CTA */}
        <Card>
          <CardHeader>
            <CardTitle>Your Submission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You have not submitted this assignment yet.
            </p>

            <Button className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Submit Assignment
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
