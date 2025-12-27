"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import GoogleDocsStyleEditor from "./GoogleDocsStyleEditor";
import { Upload } from "lucide-react";

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


    /* ---------------- SUBMIT HANDLER ---------------- */
    async function handleSubmit() {
        if (
            assignment.submission_type !== "file" &&
            !content.trim()
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
               
                const formData = new FormData();
                formData.append("file", file);
                formData.append("type", "assignment_file");
                formData.append("assignment_id", assignment.id);
                formData.append("student_id", student.id);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
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
            setContent("");
            setFile(null);
            router.push(`/student/assignments/${id}`);
        } catch (err: any) {
            toast.error(err.message || "Submission failed");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!assignment) return null;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold">Submit Assignment</h1>
            <div className="space-y-6 mt-6">
                {(assignment.submission_type === "text" ||
                    assignment.submission_type === "both") && (
                        <GoogleDocsStyleEditor content={content} onChange={setContent} />
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
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.bmp,.txt,.rtf,.odt,.ppt,.pptx ."
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />
                            </label>
                        </div>
                    )}
            </div>

            {/* ---------------- ACTIONS ---------------- */}
            <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                <Button variant="outline" onClick={() => router.back()}>
                    Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
            </div>
        </div>
    );
}
