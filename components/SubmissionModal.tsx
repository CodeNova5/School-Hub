// components/SubmissionModal.tsx
"use client";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { ChevronLeft, ChevronRight, X, Clock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"


/* ================= SUBMISSION MODAL ================= */

export function SubmissionModal({
  submission,
  submissions,
  activeIndex,
  setActiveSubmission,
  assignment,
  grading,
  setGrading,
  savingId,
  saveGrade,
  onClose,
}: any) {
  function goNext() {
    if (activeIndex < submissions.length - 1) {
      setActiveSubmission(submissions[activeIndex + 1]);
    }
  }

  function goPrev() {
    if (activeIndex > 0) {
      setActiveSubmission(submissions[activeIndex - 1]);
    }
  }

  useEffect(() => {
    if (!submission) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (activeIndex < submissions.length - 1) {
          setActiveSubmission(submissions[activeIndex + 1]);
          goNext();
        }
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (activeIndex > 0) {
          setActiveSubmission(submissions[activeIndex - 1]);
          goPrev();
        }
      }

      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submission, submissions, activeIndex, setActiveSubmission, onClose]);

  if (!submission) return null;
  const fileUrl = submission.file_url;

  const ext = fileUrl?.split(".").pop()?.toLowerCase();
  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);
  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
    fileUrl
  )}&embedded=true`;

  return (
    <Dialog open={!!submission} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col" hideClose>

        {/* ================= HEADER ================= */}
        <DialogHeader className="px-8 py-6 border-b bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Left: Student identity */}
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="font-bold text-lg bg-blue-100 text-blue-900">
                  {submission.students?.first_name?.[0]}
                  {submission.students?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="leading-tight">
                <DialogTitle className="text-xl font-bold text-gray-900">
                  {submission.students?.first_name}{" "}
                  {submission.students?.last_name}
                </DialogTitle>

                <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                  <Clock className="h-4 w-4" />
                  <span>
                    Submitted{" "}
                    {new Date(submission.submitted_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Navigation + Close */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 font-medium">
                {activeIndex + 1} of {submissions.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={activeIndex === 0}
                onClick={goPrev}
                className="h-9 w-9 p-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={activeIndex === submissions.length - 1}
                onClick={goNext}
                className="h-9 w-9 p-0"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 w-9 p-0 hover:bg-red-100 hover:text-red-600"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* ================= SCROLLABLE CONTENT ================= */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">

            {/* ================= STUDENT ANSWER ================= */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Student Answer</h3>

              {submission.submission_text ? (
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html: submission.submission_text,
                  }}
                />
              ) : (
                <p className="text-gray-400 italic py-8 text-center">
                  No written answer submitted.
                </p>
              )}
            </div>

            {/* ================= FILE PREVIEW ================= */}
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Submitted File</h3>

              {!fileUrl && (
                <p className="text-gray-400 italic py-8 text-center">
                  No file uploaded.
                </p>
              )}

              {fileUrl && (
                <>
                  {/* Image */}
                  {isImage && (
                    <img
                      src={fileUrl}
                      className="w-full max-h-96 object-contain rounded-lg border border-gray-300"
                    />
                  )}

                  {/* PDF */}
                  {isPdf && (
                    <iframe
                      src={fileUrl}
                      className="w-full h-[75vh] rounded-md border"
                      allowFullScreen
                    />
                  )}

                  {/* Word / Excel / PowerPoint */}
                  {isOffice && (
                    <iframe
                      src={googleViewerUrl}
                      className="w-full h-[75vh] rounded-md border"
                      allowFullScreen
                    />
                  )}

                  {/* Fallback */}
                  {!isImage && !isPdf && !isOffice && (
                    <div className="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-gray-300 rounded-lg p-12 bg-gray-50">
                      <FileText className="w-12 h-12 text-gray-300" />
                      <p className="text-sm text-gray-500 text-center">
                        Preview not supported for this file type.
                      </p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Download File
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ================= GRADING SECTION ================= */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-8">Grade & Feedback</h3>

              <div className="space-y-8">
                {/* Score Input */}
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <Label className="text-base font-semibold text-gray-900 block mb-4">
                    Score (out of {assignment.total_marks})
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    className="text-2xl font-bold py-4 h-14"
                    defaultValue={submission.grade ?? ""}
                    disabled={!!submission.graded_at}
                    onChange={(e) =>
                      setGrading((prev: any) => ({
                        ...prev,
                        [submission.id]: {
                          ...prev[submission.id],
                          grade: e.target.value,
                        },
                      }))
                    }
                  />
                  {submission.graded_at && (
                    <p className="text-sm text-green-600 font-medium mt-3">
                      Already graded
                    </p>
                  )}
                </div>

                {/* Feedback Editor */}
                <div className="bg-white rounded-lg p-6 border border-gray-200">
                  <Label className="text-base font-semibold text-gray-900 block mb-4">
                    Feedback
                  </Label>
                  <FeedbackEditor
                    value={submission.feedback || ""}
                    onChange={(val: string) =>
                      setGrading((prev: any) => ({
                        ...prev,
                        [submission.id]: {
                          ...prev[submission.id],
                          feedback: val,
                        },
                      }))
                    }
                  />
                </div>

                {/* Save Button */}
                <Button
                  className="w-full py-6 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!!submission.graded_at || savingId === submission.id}
                  onClick={() => saveGrade(submission.id)}
                >
                  {savingId === submission.id ? "Saving..." : submission.graded_at ? "Already Graded" : "Save Grade"}
                </Button>
              </div>
            </div>

          </div>
        </ScrollArea>

      </DialogContent>
    </Dialog>
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
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="flex gap-2 border-b border-gray-300 p-3 bg-gray-50">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="px-3 py-1 font-bold text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          B
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="px-3 py-1 italic text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          I
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className="px-3 py-1 underline text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          U
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

