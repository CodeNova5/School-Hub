"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  assignment: any;
}

export function StudentAssignmentSubmissionModal({ open, onClose, assignment }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[200px] border rounded-md p-3 focus:outline-none",
      },
    },
  });

  async function handleSubmit() {
    if (
      assignment.submission_type !== "file" &&
      !editor?.getText().trim()
    ) {
      toast.error("Please write your answer");
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      let fileUrl: string | null = null;

      if (file) {
        const base64 = await fileToBase64(file);

        const res = await fetch("/api/upload-assignment", {
          method: "POST",
          body: JSON.stringify({
            assignmentId: assignment.id,
            studentId: student?.id,
            fileName: file.name,
            fileContentBase64: base64,
          }),
        });

        const data = await res.json();
        fileUrl = data.fileUrl;
      }

      await supabase.from("assignment_submissions").upsert({
        assignment_id: assignment.id,
        student_id: student?.id,
        submission_text:
          assignment.submission_type !== "file"
            ? editor?.getHTML()
            : null,
        file_url: fileUrl,
      });

      toast.success("Assignment submitted successfully");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Rich Text Editor */}
          {(assignment.submission_type === "text" ||
            assignment.submission_type === "both") && (
            <div>
              <p className="text-sm font-medium mb-1">Your Answer</p>
              <EditorContent editor={editor} />
            </div>
          )}

          {/* File Upload */}
          {(assignment.submission_type === "file" ||
            assignment.submission_type === "both") && (
            <div>
              <p className="text-sm font-medium mb-1">Upload File</p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
