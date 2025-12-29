// components/SubmissionModal.tsx
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
import { PdfPreview } from "@/components/PdfPreview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.js",
  import.meta.url
).toString();



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

  const fileUrl = submission.file_url || "";
  const ext = fileUrl?.split(".").pop()?.toLowerCase();

  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdf = ext === "pdf";
  const isOffice = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext);

  return (
    <Dialog open={!!submission} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 overflow-hidden" hideClose>

        <DialogHeader className="px-6 py-4 border-b bg-muted/40">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Student identity */}
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="font-semibold">
                  {submission.students?.first_name?.[0]}
                  {submission.students?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="leading-tight">
                <DialogTitle className="text-lg font-semibold">
                  {submission.students?.first_name}{" "}
                  {submission.students?.last_name}
                </DialogTitle>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Submitted{" "}
                    {new Date(submission.submitted_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Navigation + Close */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                disabled={activeIndex === 0}
                onClick={goPrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="icon"
                disabled={activeIndex === submissions.length - 1}
                onClick={goNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                size="icon"
                onClick={onClose}
                className="hover:bg-red-400"
              >
                <X className="h-4 w-4" />
              </Button>

            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-12 h-full">

          {/* ================= STUDENT ANSWER ================= */}
          <div className="col-span-4 border-r">
            <ScrollArea className="h-full p-6">
              <h3 className="font-semibold mb-4">Student Answer</h3>

              {submission.submission_text ? (
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: submission.submission_text,
                  }}
                />
              ) : (
                <p className="text-muted-foreground italic">
                  No written answer submitted.
                </p>
              )}
            </ScrollArea>
          </div>

          {/* ================= GRADING ================= */}
          <div className="col-span-4 border-r bg-muted/40">
            <ScrollArea className="h-full p-6 space-y-6">
              <h3 className="font-semibold">Grading</h3>

              <div>
                <Label>Score (out of {assignment.total_marks})</Label>
                <Input
                  type="number"
                  className="mt-2"
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
              </div>

              <Separator />

              <div>
                <Label className="mb-2 block">Feedback</Label>
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

              <Button
                className="w-full"
                disabled={!!submission.graded_at || savingId === submission.id}
                onClick={() => saveGrade(submission.id)}
              >
                {savingId === submission.id ? "Saving..." : "Save Grade"}
              </Button>
            </ScrollArea>
          </div>

          {/* ================= FILE PREVIEW ================= */}
          <div className="col-span-4">
            <ScrollArea className="h-full p-6">
              <h3 className="font-semibold mb-4">Submitted File</h3>

              {!fileUrl && (
                <p className="text-muted-foreground italic">
                  No file uploaded.
                </p>
              )}

              {fileUrl && (
                <>
                  {/* Image */}
                  {isImage && (
                    <img
                      src={fileUrl}
                      className="w-full rounded-md border"
                    />
                  )}

                  {/* PDF (pdf.js) */}
                  {isPdf && <PdfPreview url={fileUrl} />}

                  {/* Office files */}
                  {isOffice && (
                    <iframe
                      src={`https://docs.google.com/gview?url=${encodeURIComponent(
                        fileUrl
                      )}&embedded=true`}
                      className="w-full h-[75vh] rounded-md border"
                    />
                  )}

                  {/* Fallback */}
                  {!isImage && !isPdf && !isOffice && (
                    <div className="flex flex-col items-center justify-center gap-4 border rounded-md p-8">
                      <p className="text-sm text-muted-foreground">
                        Preview not supported for this file type.
                      </p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        className="text-blue-600 underline"
                      >
                        Download file
                      </a>
                    </div>
                  )}
                </>
              )}
            </ScrollArea>
          </div>



        </div>
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

