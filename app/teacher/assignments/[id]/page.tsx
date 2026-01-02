// app/teacher/assignments/[id]/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { SubmissionModal } from "@/components/SubmissionModal";

/* ============================= PAGE ============================= */

export default function AssignmentDetailsPage() {
  const { id } = useParams();
  const assignmentId = id as string;

  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [grading, setGrading] = useState<Record<string, any>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* ===== Filters ===== */
  const [statusFilter, setStatusFilter] = useState<"all" | "graded" | "ungraded">("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [dateOrder, setDateOrder] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [activeSubmission, setActiveSubmission] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: assignmentData, error } = await supabase
      .from("assignments")
      .select("*, classes(name), subjects(name)")
      .eq("id", assignmentId)
      .single();

    if (error) {
      toast.error("Failed to load assignment");
      setLoading(false);
      return;
    }

    const { data: submissionsData } = await supabase
      .from("assignment_submissions")
      .select("*, students(id, first_name, last_name)")
      .eq("assignment_id", assignmentId);

    setAssignment(assignmentData);
    setSubmissions(submissionsData || []);
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ===== Derived Data ===== */
  const gradedCount = submissions.filter(s => s.graded_at).length;
  const lateCount = submissions.filter(s => !s.submitted_on_time).length;

  const filteredSubmissions = submissions
    .filter(s => {
      if (statusFilter === "graded") return s.graded_at;
      if (statusFilter === "ungraded") return !s.graded_at;
      return true;
    })
    .filter(s => (lateOnly ? !s.submitted_on_time : true))
    .filter(s =>
      `${s.students?.first_name} ${s.students?.last_name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aTime = new Date(a.submitted_at).getTime();
      const bTime = new Date(b.submitted_at).getTime();
      return dateOrder === "newest" ? bTime - aTime : aTime - bTime;
    });

  const activeIndex = activeSubmission
    ? filteredSubmissions.findIndex(s => s.id === activeSubmission.id)
    : -1;


  function getSubmissionLabel(type: string) {
    if (type === "text") return "Text Answer";
    if (type === "file") return "File Upload";
    return "Text + File";
  }


  async function saveGrade(submissionId: string) {
    const entry = grading[submissionId];
    if (!entry?.grade) {
      toast.error("Enter a grade");
      return;
    }

    setSavingId(submissionId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: updatedSubmission, error } = await supabase
      .from("assignment_submissions")
      .update({
        grade: Number(entry.grade),
        feedback: entry.feedback || "",
        graded_at: new Date().toISOString(),
        graded_by: user?.id,
      })
      .eq("id", submissionId)
      .select("*, students(id, first_name, last_name)")
      .single();

    if (error || !updatedSubmission) {
      toast.error("Failed to save grade");
      setSavingId(null);
      return;
    }

    setSubmissions((prevSubmissions) =>
      prevSubmissions.map((s) =>
        s.id === submissionId ? updatedSubmission : s
      )
    );
    setActiveSubmission(updatedSubmission);

    toast.success("Grade saved");
    setSavingId(null);
  }


  const assignmentFileUrl = assignment?.file_url ?? null;
  const assignmentExt = assignmentFileUrl?.split(".").pop()?.toLowerCase();
  const assignmentIsImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(assignmentExt);
  const assignmentIsPdf = assignmentExt === "pdf";
  const assignmentIsOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(assignmentExt);
  const assignmentGoogleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    assignmentFileUrl
  )}&embedded=true`;
  
  if (loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Loading assignment...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">{assignment.title}</h1>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Badge variant="outline">{assignment.classes?.name}</Badge>
            <Badge variant="secondary">{assignment.subjects?.name}</Badge>
            <Badge className="bg-blue-100 text-blue-800">
              <Calendar className="w-4 h-4 mr-1" />
              Due {new Date(assignment.due_date).toLocaleDateString()}
            </Badge>
          </div>
        </div>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Assignment Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {assignment.description || "No description"}
            </p>

            {assignment.file_url && (
              <div>
                <p className="font-medium mb-2">Attached File</p>
                <div className="border rounded-lg p-4">
                  {assignmentIsImage && (
                    <img
                      src={assignmentFileUrl}
                      className="w-full max-h-96 object-contain rounded-lg border"
                    />
                  )}
                  {assignmentIsPdf && (
                    <iframe
                      src={assignmentFileUrl}
                      className="w-full h-[60vh] rounded-md border"
                    />
                  )}
                  {assignmentIsOffice && (
                    <iframe
                      src={assignmentGoogleViewerUrl}
                      className="w-full h-[60vh] rounded-md border"
                    />
                  )}
                  {!assignmentIsImage && !assignmentIsPdf && !assignmentIsOffice && (
                    <div className="flex items-center gap-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          {assignment.file_url.split("/").pop()}
                        </p>
                        <a
                          href={assignmentFileUrl}
                          target="_blank"
                          className="text-sm text-primary hover:underline"
                        >
                          Download File
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}


            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <p className="font-medium text-blue-900">{getSubmissionLabel(assignment.submission_type)}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600">Total Marks</p>
                <p className="text-2xl font-bold text-gray-900">{assignment.total_marks}</p>
              </div>

              {!assignment.allow_late_submission && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-sm font-medium text-red-900">No Late Submissions Allowed</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <Input
                placeholder="Search student..."
                className="w-48"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "ungraded" ? "default" : "outline"}
                onClick={() => setStatusFilter("ungraded")}
              >
                Ungraded
              </Button>
              <Button
                variant={statusFilter === "graded" ? "default" : "outline"}
                onClick={() => setStatusFilter("graded")}
              >
                Graded
              </Button>

              <Button
                variant={lateOnly ? "destructive" : "outline"}
                onClick={() => setLateOnly(v => !v)}
              >
                Late
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setDateOrder(o => (o === "newest" ? "oldest" : "newest"))
                }
              >
                {dateOrder === "newest" ? "Newest" : "Oldest"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-white border border-gray-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">{submissions.length}</p>
                <p className="text-sm text-gray-500 mt-1">Total Submissions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-green-600">{gradedCount}</p>
                <p className="text-sm text-gray-500 mt-1">Graded</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold text-red-600">{lateCount}</p>
                <p className="text-sm text-gray-500 mt-1">Late Submissions</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submissions List */}
        <Card>
          <CardHeader>
            <CardTitle>Student Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No submissions match this filter.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSubmissions.map(sub => (
                  <div
                    key={sub.id}
                    className="border rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                    onClick={() => setActiveSubmission(sub)}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-semibold">
                          {sub.students?.first_name} {sub.students?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {!sub.submitted_on_time && (
                          <Badge variant="destructive">Late</Badge>
                        )}
                        <Badge variant={sub.graded_at ? "success" : "warning"}>
                          {sub.graded_at ? "Graded" : "Ungraded"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SubmissionModal
        submission={activeSubmission}
        submissions={filteredSubmissions}
        activeIndex={activeIndex}
        setActiveSubmission={setActiveSubmission}
        assignment={assignment}
        grading={grading}
        setGrading={setGrading}
        savingId={savingId}
        saveGrade={saveGrade}
        onClose={() => setActiveSubmission(null)}
      />
    </DashboardLayout>
  );
}
