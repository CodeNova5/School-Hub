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
import { Calendar, FileText, Upload, Edit } from "lucide-react";
import { toast } from "sonner";
import { SubmissionModal } from "@/components/SubmissionModal";
import { AssignmentModal } from "@/components/assignment-modal";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";

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
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  /* ===== Filters ===== */
  const [statusFilter, setStatusFilter] = useState<"all" | "graded" | "ungraded">("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [dateOrder, setDateOrder] = useState<"newest" | "oldest">("newest");
  const [search, setSearch] = useState("");
  const [activeSubmission, setActiveSubmission] = useState<any | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [openEditModal, setOpenEditModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);

    const { data: assignmentData, error } = await supabase
      .from("assignments")
      .select("*, classes(name), subjects(name)")
      .eq("id", assignmentId)
      .eq("school_id", schoolId)
      .single();

    if (error) {
      toast.error("Failed to load assignment");
      setLoading(false);
      return;
    }

    const { data: submissionsData } = await supabase
      .from("assignment_submissions")
      .select("*, students(id, first_name, last_name)")
      .eq("assignment_id", assignmentId)
      .eq("school_id", schoolId);

    setAssignment(assignmentData);
    setSubmissions(submissionsData || []);
    setLoading(false);
  }, [assignmentId, schoolId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    async function initTeacher() {
      const user = await getCurrentUser();
      if (user) {
        const teacher = await getTeacherByUserId(user.id);
        if (teacher) {
          setTeacherId(teacher.id);
        }
      }
    }
    initTeacher();
  }, []);

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
    if (!schoolId) return;
    const entry = grading[submissionId];
    if (!entry?.grade) {
      toast.error("Enter a grade");
      return;
    }

    setSavingId(submissionId);

    const user = await getCurrentUser();

    const { data: updatedSubmission, error } = await supabase
      .from("assignment_submissions")
      .update({
        grade: Number(entry.grade),
        feedback: entry.feedback || "",
        graded_at: new Date().toISOString(),
        graded_by: user?.id,
      })
      .eq("id", submissionId)
      .eq("school_id", schoolId)
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
  
  if (schoolLoading || loading) {
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
      <div className="space-y-4 md:space-y-8">
        {/* Header */}
        <div>
          <div className="flex flex-col gap-3 md:gap-0 md:flex-row md:justify-between md:items-start">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold break-words">{assignment.title}</h1>

              <div className="flex flex-wrap gap-1 md:gap-2 mt-3 md:mt-4">
                <Badge variant="outline" className="text-xs md:text-sm">{assignment.classes?.name}</Badge>
                <Badge variant="secondary" className="text-xs md:text-sm">{assignment.subjects?.name}</Badge>
                <Badge className="bg-blue-100 text-blue-800 text-xs md:text-sm">
                  <Calendar className="w-3 md:w-4 h-3 md:h-4 mr-1" />
                  Due {new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Badge>
              </div>
            </div>

            <Button onClick={() => setOpenEditModal(true)} className="w-full md:w-auto flex-shrink-0 mt-3 md:mt-0">
              <Edit className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Edit Assignment</span>
              <span className="md:hidden">Edit</span>
            </Button>
          </div>
        </div>

        {/* Assignment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Assignment Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
              {assignment.description || "No description"}
            </p>

            {assignment.file_url && (
              <div>
                <p className="font-medium text-sm md:text-base mb-2">Attached File</p>
                <div className="border rounded-lg p-2 md:p-4 overflow-hidden">
                  {assignmentIsImage && (
                    <img
                      src={assignmentFileUrl}
                      className="w-full max-h-72 md:max-h-96 object-contain rounded-lg border"
                    />
                  )}
                  {assignmentIsPdf && (
                    <iframe
                      src={assignmentFileUrl}
                      className="w-full h-[40vh] md:h-[60vh] rounded-md border"
                    />
                  )}
                  {assignmentIsOffice && (
                    <iframe
                      src={assignmentGoogleViewerUrl}
                      className="w-full h-[40vh] md:h-[60vh] rounded-md border"
                    />
                  )}
                  {!assignmentIsImage && !assignmentIsPdf && !assignmentIsOffice && (
                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
                      <FileText className="h-6 md:h-8 w-6 md:w-8 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 text-center md:text-left">
                        <p className="text-xs md:text-sm font-medium truncate">
                          {assignment.file_url.split("/").pop()}
                        </p>
                        <a
                          href={assignmentFileUrl}
                          target="_blank"
                          className="text-xs md:text-sm text-primary hover:underline inline-block"
                        >
                          Download File
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}


            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
              <div className="bg-blue-50 rounded-lg p-3 md:p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 md:h-5 w-4 md:w-5 text-blue-600 flex-shrink-0" />
                  <p className="font-medium text-xs md:text-sm text-blue-900 break-words">{getSubmissionLabel(assignment.submission_type)}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 md:p-4 border border-gray-200">
                <p className="text-xs md:text-sm text-gray-600">Total Marks</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900">{assignment.total_marks}</p>
              </div>

              {!assignment.allow_late_submission && (
                <div className="bg-red-50 rounded-lg p-3 md:p-4 border border-red-200">
                  <p className="text-xs md:text-sm font-medium text-red-900">No Late Submissions</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 md:pt-6 space-y-3 md:space-y-4">
            <div>
              <Input
                placeholder="Search student..."
                className="w-full md:w-48 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                onClick={() => setStatusFilter("all")}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={statusFilter === "ungraded" ? "default" : "outline"}
                onClick={() => setStatusFilter("ungraded")}
                size="sm"
              >
                Ungraded
              </Button>
              <Button
                variant={statusFilter === "graded" ? "default" : "outline"}
                onClick={() => setStatusFilter("graded")}
                size="sm"
              >
                Graded
              </Button>

              <Button
                variant={lateOnly ? "destructive" : "outline"}
                onClick={() => setLateOnly(v => !v)}
                size="sm"
              >
                Late
              </Button>

              <Button
                variant="outline"
                onClick={() =>
                  setDateOrder(o => (o === "newest" ? "oldest" : "newest"))
                }
                size="sm"
              >
                {dateOrder === "newest" ? "Newest" : "Oldest"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4">
          <Card className="bg-white border border-gray-200">
            <CardContent className="pt-4 md:pt-6">
              <div className="text-center">
                <p className="text-2xl md:text-4xl font-bold text-gray-900">{submissions.length}</p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="pt-4 md:pt-6">
              <div className="text-center">
                <p className="text-2xl md:text-4xl font-bold text-green-600">{gradedCount}</p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">Graded</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border border-gray-200">
            <CardContent className="pt-4 md:pt-6">
              <div className="text-center">
                <p className="text-2xl md:text-4xl font-bold text-red-600">{lateCount}</p>
                <p className="text-xs md:text-sm text-gray-500 mt-1">Late</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submissions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Student Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredSubmissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No submissions match this filter.
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {filteredSubmissions.map(sub => (
                  <div
                    key={sub.id}
                    className="border rounded-lg p-3 md:p-4 hover:shadow-md transition cursor-pointer bg-white"
                    onClick={() => setActiveSubmission(sub)}
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-start">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm md:text-base break-words">
                          {sub.students?.first_name} {sub.students?.last_name}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex gap-1 md:gap-2 flex-shrink-0">
                        {!sub.submitted_on_time && (
                          <Badge variant="destructive" className="text-xs">Late</Badge>
                        )}
                        <Badge variant={sub.graded_at ? "success" : "warning"} className="text-xs">
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

      {teacherId && (
        <AssignmentModal
          open={openEditModal}
          teacherId={teacherId}
          assignment={assignment}
          onClose={() => setOpenEditModal(false)}
          onSave={(updatedAssignment) => {
            setAssignment(updatedAssignment);
            setOpenEditModal(false);
            toast.success("Assignment updated successfully");
          }}
        />
      )}
    </DashboardLayout>
  );
}
