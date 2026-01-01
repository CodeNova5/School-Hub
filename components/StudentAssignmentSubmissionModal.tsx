"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, Calendar, Clock } from "lucide-react";
import GoogleDocsStyleEditor from "./GoogleDocsStyleEditor";
import { FilePreview } from "./file-preview";

export default function StudentAssignmentSubmission() {
  const { id } = useParams();
  const router = useRouter();

  const [assignment, setAssignment] = useState<any>(null);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("assignments")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setAssignment(data));
  }, [id]);

  async function handleSubmit() {
    if (assignment.submission_type !== "file" && !content.trim()) {
      toast.error("Please write your answer before submitting");
      return;
    }

    if (assignment.submission_type !== "text" && !file) {
      toast.error("Please upload a file");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!student) throw new Error("Student record not found");

      let fileUrl: string | null = null;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "submission_file");
        formData.append("assignment_id", assignment.id);
        formData.append("student_id", student.id);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("File upload failed");
        const data = await res.json();
        fileUrl = data.fileUrl;
      }

      await supabase.from("assignment_submissions").upsert({
        assignment_id: assignment.id,
        student_id: student.id,
        submission_text: assignment.submission_type !== "file" ? content : null,
        file_url: fileUrl,
      });

      toast.success("Assignment submitted successfully");
      router.push(`/student/assignments/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!assignment) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10">
      {/* ===== Assignment Details ===== */}
      <Card className="mb-6">
        <CardHeader className="space-y-2">
          <h1 className="text-3xl font-bold">{assignment.title}</h1>
          <p className="text-muted-foreground">{assignment.description}</p>
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground pt-2">
            <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Due: {assignment.due_date || "Not set"}</span>
            <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Marks: {assignment.total_marks}</span>
            <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Type: {assignment.submission_type}</span>
          </div>
        </CardHeader>
        {assignment.file_url && (
          <CardContent>
            <FilePreview fileUrl={assignment.file_url} />
          </CardContent>
        )}
      </Card>

      {/* ===== Editor Section ===== */}
      {(assignment.submission_type === "text" || assignment.submission_type === "both") && (
        <Card className="mb-6">
          <CardContent className="p-0">
            <GoogleDocsStyleEditor
              content={content}
              onChange={setContent}
            />
          </CardContent>
        </Card>
      )}

      {/* ===== File Upload ===== */}
      {(assignment.submission_type === "file" || assignment.submission_type === "both") && (
        <Card className="mb-6">
          <CardContent>
            <p className="text-sm font-medium mb-2">Attach file</p>
            <label className="flex items-center gap-3 cursor-pointer border rounded-md p-4 hover:bg-muted transition">
              <Upload className="h-5 w-5" />
              <span className="text-sm">{file ? file.name : "Upload PDF, DOC, Image, etc."}</span>
              <input
                type="file"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </CardContent>
        </Card>
      )}

      <Separator className="my-6" />

      {/* ===== Actions ===== */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit Assignment"}
        </Button>
      </div>
    </div>
  );
}
