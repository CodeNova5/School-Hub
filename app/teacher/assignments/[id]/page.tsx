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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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
  }

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

    const { data: { user } } = await supabase.auth.getUser();

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
    loadData();
  }

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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ================= ASSIGNMENT HEADER ================= */}
        <div>
          <h1 className="text-4xl font-bold">{assignment.title}</h1>

          <div className="flex gap-2 mt-4 flex-wrap">
            <Badge variant="outline">{assignment.classes?.name}</Badge>
            <Badge variant="secondary">{assignment.subjects?.name}</Badge>
            <Badge className="bg-blue-100 text-blue-800">
              <Calendar className="w-4 h-4 mr-1" />
              Due {new Date(assignment.due_date).toLocaleDateString()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">

          {/* ================= SIDEBAR ================= */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {assignment.description || "No description"}
              </p>

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

          {/* ================= STUDENT SUBMISSIONS ================= */}
          <div>

            {/* ===== Section Header ===== */}
            <Card>
              <CardContent className="py-6 space-y-4">
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Student Submissions</h2>
                    <p className="text-sm text-muted-foreground">
                      {submissions.length} total • {gradedCount} graded • {lateCount} late
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
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
                </div>
              </CardContent>
            </Card>

            {/* ===== Submissions List ===== */}
            {filteredSubmissions.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No submissions match this filter.
                </CardContent>
              </Card>
            )}

            {filteredSubmissions.map(sub => {
              const isOpen = openId === sub.id;

              return (
                <div key={sub.id} className="space-y-3">
                  <Card
                    className="cursor-pointer"
                    onClick={() => setOpenId(isOpen ? null : sub.id)}
                  >
                    <CardContent className="py-4 flex justify-between items-center">
                      <div>
                        <p className="font-semibold">
                          {sub.students?.first_name} {sub.students?.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        {!sub.submitted_on_time && <Badge variant="destructive">Late</Badge>}
                        <Badge variant={sub.graded_at ? "success" : "warning"}>
                          {sub.graded_at ? "Graded" : "Ungraded"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {isOpen && (
                    <Card className="border-blue-300">
                      <CardContent className="py-6 grid lg:grid-cols-3 gap-6">

                        {/* ANSWER */}
                        <div className="lg:col-span-2 space-y-4">
                          {sub.submission_text && (
                            <div
                              className="prose max-w-none"
                              dangerouslySetInnerHTML={{ __html: sub.submission_text }}
                            />
                          )}

                          {sub.file_url && (
                            <a
                              href={sub.file_url}
                              target="_blank"
                              className="inline-flex items-center gap-2 text-blue-600"
                            >
                              <Upload className="w-4 h-4" />
                              View file
                            </a>
                          )}
                        </div>

                        {/* GRADING */}
                        <div className="space-y-4">
                          <Label>Score</Label>
                          <Input
                            type="number"
                            defaultValue={sub.grade ?? ""}
                            disabled={!!sub.graded_at}
                            onChange={e =>
                              setGrading(p => ({
                                ...p,
                                [sub.id]: { ...p[sub.id], grade: e.target.value },
                              }))
                            }
                          />

                          <FeedbackEditor
                            value={sub.feedback || ""}
                            onChange={val =>
                              setGrading(p => ({
                                ...p,
                                [sub.id]: { ...p[sub.id], feedback: val },
                              }))
                            }
                          />

                          <Button
                            className="w-full"
                            disabled={!!sub.graded_at || savingId === sub.id}
                            onClick={() => saveGrade(sub.id)}
                          >
                            {savingId === sub.id ? "Saving..." : "Save Grade"}
                          </Button>
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
    </DashboardLayout>
  );
}

/* ================= FEEDBACK EDITOR ================= */

function FeedbackEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border rounded-md">
      <div className="flex gap-1 border-b p-1">
        <button onClick={() => editor.chain().focus().toggleBold().run()}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>I</button>
        <button onClick={() => editor.chain().focus().toggleUnderline().run()}>U</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
