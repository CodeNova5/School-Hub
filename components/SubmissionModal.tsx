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

/* ================= SUBMISSION MODAL ================= */

export function SubmissionModal({
  submission,
  assignment,
  grading,
  setGrading,
  savingId,
  saveGrade,
  onClose,
}: any) {
  if (!submission) return null;

  const fileUrl = submission.file_url;
  const fileExt = fileUrl?.split(".").pop()?.toLowerCase();

  const canPreviewInline =
    fileExt &&
    ["png", "jpg", "jpeg", "gif", "webp"].includes(fileExt);

  const canIframe =
    fileExt &&
    ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(fileExt);

  return (
    <Dialog open={!!submission} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <p className="text-xs text-muted-foreground mt-1">
            ← Previous • → Next • Esc to close
          </p>
 
          <DialogTitle className="text-xl font-bold">
            {submission.students?.first_name} {submission.students?.last_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(submission.submitted_at).toLocaleString()}
          </p>
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
                  {/* Image Preview */}
                  {canPreviewInline && (
                    <img
                      src={fileUrl}
                      alt="Submission file"
                      className="w-full rounded-md border"
                    />
                  )}

                  {/* PDF / Docs Preview */}
                  {!canPreviewInline && canIframe && (
                    <iframe
                      src={fileUrl}
                      className="w-full h-[70vh] rounded-md border"
                    />
                  )}

                  {/* Fallback */}
                  {!canPreviewInline && !canIframe && (
                    <div className="flex flex-col items-center justify-center gap-4 border rounded-md p-8">
                      <FileText className="w-10 h-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Preview not supported for this file type.
                      </p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-blue-600"
                      >
                        <Download className="w-4 h-4" />
                        Download File
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

