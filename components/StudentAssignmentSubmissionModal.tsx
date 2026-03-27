"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Upload, FileText, Calendar, Clock, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
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

  // Validation checks
  const isTextComplete = assignment?.submission_type !== "file" ? content.trim().length > 0 : true;
  const isFileComplete = assignment?.submission_type !== "text" ? file !== null : true;
  const canSubmit = isTextComplete && isFileComplete && !isSubmitting;

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      supabase
        .from("assignments")
        .select("*")
        .eq("id", id)
        .eq("school_id", schoolId)
        .single()
        .then(({ data }: { data: any }) => setAssignment(data));
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading assignment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* ===== Header with Back Button ===== */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()}
            className="hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </Button>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">{assignment.title}</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-10 pb-24 sm:pb-12">
        {/* ===== Assignment Details Card ===== */}
        <Card className="mb-6 sm:mb-8 shadow-lg border-0 bg-white hover:shadow-xl transition-shadow">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-4 sm:p-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Assignment Details</p>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">{assignment.description}</p>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* ===== Info Grid ===== */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <span className="text-xs font-semibold uppercase text-gray-500">Due Date</span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-gray-900">{assignment.due_date || "Not set"}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="text-xs font-semibold uppercase text-gray-500">Total Marks</span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-gray-900">{assignment.total_marks}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="text-xs font-semibold uppercase text-gray-500">Type</span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-gray-900 capitalize">{assignment.submission_type}</p>
              </div>
            </div>

            {/* ===== Assignment File Preview ===== */}
            {assignment.file_url && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs font-semibold uppercase text-gray-500 mb-3">Assignment File</p>
                <FilePreview fileUrl={assignment.file_url} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== Submission Requirements Status ===== */}
        <Card className="mb-6 sm:mb-8 shadow-md border-0 bg-white">
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs font-semibold uppercase text-gray-500 mb-4">Submission Checklist</p>
            <div className="space-y-3">
              {(assignment.submission_type === "text" || assignment.submission_type === "both") && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  {isTextComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${isTextComplete ? "text-green-700" : "text-amber-700"}`}>
                    {isTextComplete ? "Text content written" : "Write your answer"}
                  </span>
                </div>
              )}
              {(assignment.submission_type === "file" || assignment.submission_type === "both") && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  {isFileComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  )}
                  <span className={`text-sm font-medium ${isFileComplete ? "text-green-700" : "text-amber-700"}`}>
                    {file ? `File selected: ${file.name}` : "Upload a file"}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== Text Editor Section ===== */}
        {(assignment.submission_type === "text" || assignment.submission_type === "both") && (
          <Card className="mb-6 sm:mb-8 shadow-lg border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-4 sm:p-6">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                ✏️ Write Your Answer
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <GoogleDocsStyleEditor
                content={content}
                onChange={setContent}
              />
            </CardContent>
          </Card>
        )}

        {/* ===== File Upload Section ===== */}
        {(assignment.submission_type === "file" || assignment.submission_type === "both") && (
          <Card className="mb-6 sm:mb-8 shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200 p-4 sm:p-6">
              <p className="text-sm font-semibold text-green-600 uppercase tracking-wide">
                📎 Attach File
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="relative group">
                <label className="flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group-hover:shadow-md">
                  <div className="rounded-full bg-blue-100 p-3 sm:p-4 group-hover:bg-blue-200 transition-colors">
                    <Upload className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                      {file ? "✓ File Ready" : "Choose file to upload"}
                    </p>
                    {file && <p className="text-xs sm:text-sm text-blue-600 font-medium mt-1">{file.name}</p>}
                    {!file && <p className="text-xs sm:text-sm text-gray-500 mt-1">or drag and drop</p>}
                  </div>
                  <input
                    type="file"
                    hidden
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {file && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setFile(null)}
                  className="mt-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Clear file
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ===== Submit Actions ===== */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8">
          <Button 
            variant="outline" 
            onClick={() => router.back()} 
            className="w-full sm:w-auto border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!canSubmit}
            className={`w-full sm:w-auto font-semibold transition-all duration-200 ${
              canSubmit 
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl" 
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </span>
            ) : (
              "Submit Assignment"
            )}
          </Button>
        </div>

        {/* ===== Helpful Hint ===== */}
        {!canSubmit && (
          <div className="mt-4 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs sm:text-sm text-amber-800">
              ⚠️ <span className="font-semibold">Note:</span> Please complete all required fields before submitting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
