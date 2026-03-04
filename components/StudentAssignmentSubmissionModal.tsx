"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, Calendar, Clock, Loader2 } from "lucide-react";
import GoogleDocsStyleEditor from "./GoogleDocsStyleEditor";
import { FilePreview } from "./file-preview";
import { useSchoolContext } from "@/hooks/use-school-context";

export default function StudentAssignmentSubmission() {
  const { id } = useParams();
  const router = useRouter();

  const [assignment, setAssignment] = useState<any>(null);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      supabase
        .from("assignments")
        .select("*")
        .eq("id", id)
        .eq("school_id", schoolId)
        .single()
        .then(({ data }) => setAssignment(data));
    }
  }, [id, schoolId, schoolLoading]);

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
      // Get user ID from session - already authenticated by middleware
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("school_id", schoolId)
        .single();

      if (!student) throw new Error("Student record not found");

      let fileUrl: string | null = null;

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "assignment_file");
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
        school_id: schoolId,
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

  if (schoolLoading || !assignment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-6 sm:pb-10">
      {/* ===== Assignment Details ===== */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <h1 className="text-xl sm:text-3xl font-bold">{assignment.title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{assignment.description}</p>
          <div className="flex flex-wrap gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground pt-2">
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
        <Card className="mb-4 sm:mb-6">
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
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs sm:text-sm font-medium mb-2">Attach file</p>
            <label className="flex items-center gap-2 sm:gap-3 cursor-pointer border rounded-md p-3 sm:p-4 hover:bg-muted transition">
              <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm truncate">{file ? file.name : "Upload file"}</span>
              <input
                type="file"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </CardContent>
        </Card>
      )}

      <Separator className="my-4 sm:my-6" />

      {/* ===== Actions ===== */}
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 sm:relative mb-20 md:mb-0">
        <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">Cancel</Button>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Submitting…" : "Submit Assignment"}
        </Button>
      </div>
    </div>
  );
}
