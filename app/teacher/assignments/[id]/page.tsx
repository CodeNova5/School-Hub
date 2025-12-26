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
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold">{assignment.title}</h1>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{assignment.classes?.name}</Badge>
              <Badge variant="secondary">{assignment.subjects?.name}</Badge>
              <Badge>
                <Calendar className="h-3 w-3 mr-1" />
                Due {new Date(assignment.due_date).toLocaleDateString()}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Badge variant="outline">{submissions.length} Submitted</Badge>
              <Badge variant="success">{gradedCount} Graded</Badge>
              <Badge variant="destructive">{lateCount} Late</Badge>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "ungraded" ? "default" : "outline"}
                onClick={() => setFilter("ungraded")}
              >
                Ungraded
              </Button>
              <Button
                size="sm"
                variant={filter === "late" ? "default" : "outline"}
                onClick={() => setFilter("late")}
              >
                Late
              </Button>
            </div>
          </div>


          {/* Assignment Info */}
          <div className="lg:col-span-1 sticky top-6 h-fit">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
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

                <Badge variant="outline">
                  <FileText className="h-3 w-3 mr-1" />
                  {getSubmissionLabel(assignment.submission_type)}
                </Badge>

                <Badge variant="outline">{assignment.total_marks} Marks</Badge>

                {!assignment.allow_late_submission && (
                  <Badge variant="destructive">No Late Submissions</Badge>
                )}
              </CardContent>
            </Card>
          </div>


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

              <div className="lg:col-span-2 space-y-4">
                {filteredSubmissions.map((submission) => {
                  const isOpen = openId === submission.id;
                  const gradeEntry = grading[submission.id] || {};

                  return (
                    <div
                      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/40"
                      onClick={() => setOpenId(isOpen ? null : submission.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">
                            {submission.students?.first_name} {submission.students?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Submitted {new Date(submission.submitted_at).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          {!submission.submitted_on_time && (
                            <Badge variant="destructive">Late</Badge>
                          )}
                          <Badge variant={submission.graded_at ? "success" : "warning"}>
                            {submission.graded_at ? "Graded" : "Ungraded"}
                          </Badge>
                        </div>
                      </div>


                      {isOpen && (
                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                          {/* ===== ANSWER SECTION ===== */}
                          <div className="lg:col-span-2 space-y-4">
                            {submission.submission_text && (
                              <div className="prose max-w-none border rounded-md p-4 bg-muted/40">
                                <div dangerouslySetInnerHTML={{ __html: submission.submission_text }} />
                              </div>
                            )}

                            {submission.file_url && (
                              <a
                                href={submission.file_url}
                                target="_blank"
                                className="text-sm text-primary underline"
                              >
                                View uploaded file
                              </a>
                            )}
                          </div>

                          {/* ===== GRADING SECTION ===== */}
                          <div className="bg-muted/40 p-4 rounded-lg space-y-3">
                            <div>
                              <Label>Score</Label>
                              <Input
                                type="number"
                                placeholder={`Out of ${assignment.total_marks}`}
                                defaultValue={submission.grade ?? ""}
                                disabled={!!submission.graded_at}
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

                            <div>
                              <Label>Feedback</Label>
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
                              className="w-full"
                              disabled={!!submission.graded_at}
                              onClick={() => saveGrade(submission.id)}
                            >
                              {submission.graded_at ? "Graded" : "Save Grade"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </CardContent>
          </Card>
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
