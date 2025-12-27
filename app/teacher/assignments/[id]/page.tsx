"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";

import { Calendar, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

export default function AssignmentDetailsPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const params = useParams();
  const assignmentId = params.id as string;
  const [grading, setGrading] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "ungraded" | "late">("all");

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const gradedCount = submissions.filter(s => s.graded_at).length;
  const lateCount = submissions.filter(s => !s.submitted_on_time).length;

  const filteredSubmissions = submissions.filter((s) => {
    if (filter === "ungraded") return !s.graded_at;
    if (filter === "late") return !s.submitted_on_time;
    return true;
  });

  const [openId, setOpenId] = useState<string | null>(null);



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

  async function saveGrade(submissionId: string) {
    const entry = grading[submissionId];
    if (!entry?.grade) {
      toast.error("Enter a grade first");
      return;
    }

    setSavingId(submissionId);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("assignment_submissions")
      .update({
        grade: Number(entry.grade),
        feedback: entry.feedback || "",
        graded_at: new Date().toISOString(),
        graded_by: user?.id,
      })
      .eq("id", submissionId);

    toast.success("Grade saved");
    setSavingId(null);
    loadAssignment(); // refresh
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">{assignment.title}</h1>

            <div className="flex flex-wrap gap-3 mb-6">
              <Badge variant="outline" className="text-base py-2 px-4">{assignment.classes?.name}</Badge>
              <Badge variant="secondary" className="text-base py-2 px-4">{assignment.subjects?.name}</Badge>
              <Badge className="text-base py-2 px-4 bg-blue-100 text-blue-900 hover:bg-blue-100">
                <Calendar className="h-4 w-4 mr-2" />
                Due {new Date(assignment.due_date).toLocaleDateString()}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
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

            <div className="flex gap-3 flex-wrap">
              <Button
                size="lg"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                className={filter === "all" ? "bg-blue-600 text-white" : ""}
              >
                All Submissions
              </Button>
              <Button
                size="lg"
                variant={filter === "ungraded" ? "default" : "outline"}
                onClick={() => setFilter("ungraded")}
                className={filter === "ungraded" ? "bg-yellow-600 text-white" : ""}
              >
                Ungraded
              </Button>
              <Button
                size="lg"
                variant={filter === "late" ? "default" : "outline"}
                onClick={() => setFilter("late")}
                className={filter === "late" ? "bg-red-600 text-white" : ""}
              >
                Late Submissions
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            {/* Assignment Info - Sidebar */}
            <div className="xl:col-span-1">
              <Card className="sticky top-8 h-fit bg-white shadow-md border-gray-200">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="text-xl text-gray-900">Assignment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div>
                    <p className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Description</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{assignment.description || "—"}</p>
                  </div>

                  <div className="border-t border-gray-100 pt-6">
                    <p className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Instructions</p>
                    <p className="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed">
                      {assignment.instructions || "—"}
                    </p>
                  </div>

                  <div className="border-t border-gray-100 pt-6 space-y-3">
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
            </div>

            {/* Submissions - Main Content */}
            <div className="xl:col-span-4">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Student Submissions</h2>

                {submissions.length === 0 && (
                  <Card className="bg-white shadow-md border-gray-200">
                    <CardContent className="pt-12 pb-12">
                      <p className="text-center text-gray-500 text-lg">
                        No submissions yet.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {filteredSubmissions.map((submission) => {
                  const isOpen = openId === submission.id;
                  const gradeEntry = grading[submission.id] || {};

                  return (
                    <div key={submission.id} className="space-y-3">
                      <Card
                        className={`bg-white border-2 cursor-pointer transition-all shadow-md hover:shadow-lg ${
                          isOpen ? "border-blue-400" : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setOpenId(isOpen ? null : submission.id)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-lg text-gray-900">
                                {submission.students?.first_name} {submission.students?.last_name}
                              </p>
                              <p className="text-sm text-gray-500 mt-1">
                                Submitted {new Date(submission.submitted_at).toLocaleString()}
                              </p>
                            </div>

                            <div className="flex gap-3 flex-shrink-0">
                              {!submission.submitted_on_time && (
                                <Badge variant="destructive" className="text-xs py-1">Late</Badge>
                              )}
                              <Badge
                                variant={submission.graded_at ? "success" : "warning"}
                                className="text-xs py-1"
                              >
                                {submission.graded_at ? "Graded" : "Ungraded"}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {isOpen && (
                        <Card className="bg-white shadow-lg border-2 border-blue-200">
                          <CardContent className="pt-8 space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                              {/* ===== ANSWER SECTION ===== */}
                              <div className="lg:col-span-2 space-y-6">
                                <div>
                                  <h4 className="font-bold text-lg text-gray-900 mb-4">Student Answer</h4>
                                  {submission.submission_text && (
                                    <div className="prose prose-sm max-w-none border-2 border-gray-200 rounded-lg p-6 bg-gray-50">
                                      <div dangerouslySetInnerHTML={{ __html: submission.submission_text }} />
                                    </div>
                                  )}

                                  {submission.file_url && (
                                    <div className="pt-4">
                                      <a
                                        href={submission.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                                      >
                                        <Upload className="h-5 w-5" />
                                        View Uploaded File
                                      </a>
                                    </div>
                                  )}

                                  {!submission.submission_text && !submission.file_url && (
                                    <p className="text-base text-gray-500 italic bg-gray-100 rounded-lg p-6">
                                      No submission content
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* ===== GRADING SECTION ===== */}
                              <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-lg border-2 border-gray-200 space-y-6">
                                <div>
                                  <h4 className="font-bold text-lg text-gray-900 mb-4">Grade</h4>
                                  <Label htmlFor={`score-${submission.id}`} className="text-sm font-semibold text-gray-700">Score (out of {assignment.total_marks})</Label>
                                  <Input
                                    id={`score-${submission.id}`}
                                    type="number"
                                    placeholder="0"
                                    defaultValue={submission.grade ?? ""}
                                    disabled={!!submission.graded_at}
                                    className="mt-3 text-lg py-3 font-bold"
                                    onChange={(e) =>
                                      setGrading((prev) => ({
                                        ...prev,
                                        [submission.id]: {
                                          ...prev[submission.id],
                                          grade: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>

                                <div className="border-t border-gray-300 pt-6">
                                  <Label htmlFor={`feedback-${submission.id}`} className="text-sm font-semibold text-gray-700 block mb-3">Feedback</Label>
                                  <FeedbackEditor
                                    value={submission.feedback || ""}
                                    onChange={(val) =>
                                      setGrading((prev) => ({
                                        ...prev,
                                        [submission.id]: {
                                          ...prev[submission.id],
                                          feedback: val,
                                        },
                                      }))
                                    }
                                  />
                                </div>

                                <Button
                                  className="w-full text-base py-6 font-semibold"
                                  disabled={!!submission.graded_at || savingId === submission.id}
                                  onClick={() => saveGrade(submission.id)}
                                >
                                  {savingId === submission.id ? "Saving..." : submission.graded_at ? "Graded" : "Save Grade"}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
    );
}


function FeedbackEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] p-3 focus:outline-none prose max-w-none",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border rounded-md">
      <div className="flex gap-1 border-b p-1 bg-muted">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className="px-2 text-sm font-bold">
          B
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className="px-2 text-sm italic">
          I
        </button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="px-2 text-sm underline">
          U
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
