"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// TipTap
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { useEditor, EditorContent } from "@tiptap/react";

// Icons
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Upload,
  Quote,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Eraser,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  assignment: {
    id: string;
    submission_type: "text" | "file" | "both";
  };
}

export default function StudentAssignmentSubmissionModal({
  open,
  onClose,
  assignment,
}: Props) {
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ---------------- RICH TEXT EDITOR ---------------- */

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Highlight,
      Blockquote,
      CodeBlock,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    autofocus: "end",
    editable: true,
    content: "",
    onUpdate({ editor }) {
      setContent(editor.getHTML());
    },
  });

  useEffect(() => {
    if (open && editor) {
      editor.commands.focus("end");
    }
  }, [open, editor]);


  /* ---------------- HELPERS ---------------- */
  function ToolbarButton({
    onClick,
    icon,
    active,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    active: boolean;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`p-2 rounded hover:bg-accent ${active ? "bg-accent text-primary" : ""
          }`}
      >
        {icon}
      </button>
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


  /* ---------------- SUBMIT HANDLER ---------------- */
  async function handleSubmit() {
    if (
      assignment.submission_type !== "file" &&
      !editor?.getText().trim()
    ) {
      toast.error("Please write your answer before submitting");
      return;
    }

    if (
      assignment.submission_type !== "text" &&
      !file
    ) {
      toast.error("Please upload a file");
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!student) throw new Error("Student record not found");

      let fileUrl: string | null = null;

      /* ---------- FILE UPLOAD (GitHub API) ---------- */
      if (file) {
        const base64 = await fileToBase64(file);

        const res = await fetch("/api/upload-assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: assignment.id,
            studentId: student.id,
            fileName: file.name,
            fileContentBase64: base64,
          }),
        });

        if (!res.ok) throw new Error("File upload failed");

        const data = await res.json();
        fileUrl = data.fileUrl;
      }

      /* ---------- SAVE SUBMISSION ---------- */
      await supabase.from("assignment_submissions").upsert({
        assignment_id: assignment.id,
        student_id: student.id,
        submission_text:
          assignment.submission_type !== "file"
            ? content
            : null,
        file_url: fileUrl,
      });

      toast.success("Assignment submitted successfully");
      editor?.commands.clearContent();
      setFile(null);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!editor) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ---------------- TOOLBAR + EDITOR ---------------- */}
          {(assignment.submission_type === "text" ||
            assignment.submission_type === "both") && (
              <div>
                <p className="text-sm font-medium mb-2">Your Answer</p>

                {/* Toolbar */}
                <div className="flex flex-wrap gap-1 p-2 border rounded-t-md bg-muted">
                  <ToolbarButton
                    icon={<Bold size={16} />}
                    active={editor.isActive("bold")}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                  />
                  <ToolbarButton
                    icon={<Italic size={16} />}
                    active={editor.isActive("italic")}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                  />
                  <ToolbarButton
                    icon={<UnderlineIcon size={16} />}
                    active={editor.isActive("underline")}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                  />
                  <ToolbarButton
                    icon={<Highlighter size={16} />}
                    active={editor.isActive("highlight")}
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                  />
                  <ToolbarButton
                    icon={<List size={16} />}
                    active={editor.isActive("bulletList")}
                    onClick={() => {
                      editor.commands.focus();
                      editor.commands.toggleBulletList();
                    }}
                  />

                  <ToolbarButton
                    icon={<ListOrdered size={16} />}
                    active={editor.isActive("orderedList")}
                    onClick={() => {
                      editor.commands.focus();
                      editor.commands.toggleOrderedList();
                    }}
                  />

                  <ToolbarButton
                    icon={<Heading1 size={16} />}
                    active={editor.isActive("heading", { level: 1 })}
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 1 }).run()
                    }
                  />
                  <ToolbarButton
                    icon={<Heading2 size={16} />}
                    active={editor.isActive("heading", { level: 2 })}
                    onClick={() =>
                      editor.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                  />
                  <ToolbarButton
                    icon={<Quote size={16} />}
                    active={editor.isActive("blockquote")}
                    onClick={() =>
                      editor.chain().focus().toggleBlockquote().run()
                    }
                  />
                  <ToolbarButton
                    icon={<AlignLeft size={16} />}
                    active={editor.isActive({ textAlign: "left" })}
                    onClick={() =>
                      editor.chain().focus().setTextAlign("left").run()
                    }
                  />
                  <ToolbarButton
                    icon={<AlignCenter size={16} />}
                    active={editor.isActive({ textAlign: "center" })}
                    onClick={() =>
                      editor.chain().focus().setTextAlign("center").run()
                    }
                  />
                  <ToolbarButton
                    icon={<AlignRight size={16} />}
                    active={editor.isActive({ textAlign: "right" })}
                    onClick={() =>
                      editor.chain().focus().setTextAlign("right").run()
                    }
                  />
                  <ToolbarButton
                    icon={<Eraser size={16} />}
                    active={false}
                    onClick={() =>
                      editor.chain().focus().clearNodes().unsetAllMarks().run()
                    }
                  />
                </div>

                {/* Editor */}

                <div
                  onClick={() => editor?.chain().focus().run()}
                  className="border border-t-0 rounded-b-md"
                >
                  <EditorContent editor={editor} />
                </div>

              </div>
            )}

          {/* ---------------- FILE UPLOAD ---------------- */}
          {(assignment.submission_type === "file" ||
            assignment.submission_type === "both") && (
              <div>
                <p className="text-sm font-medium mb-1">Upload File</p>
                <label className="flex items-center gap-2 cursor-pointer border rounded-md p-3 hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">
                    {file ? file.name : "Choose file (PDF, DOC, Image)"}
                  </span>
                  <input
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}
        </div>

        {/* ---------------- ACTIONS ---------------- */}
        <div className="flex justify-end gap-3 pt-4 border-t">
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
