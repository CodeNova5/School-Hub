"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SubmitAssignmentPage() {
  const { id } = useParams();
  const router = useRouter();

  const [assignment, setAssignment] = useState<any>(null);
  const [text, setText] = useState("");
  const [fileUrl, setFileUrl] = useState("");

  useEffect(() => {
    supabase
      .from("assignments")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setAssignment(data));
  }, [id]);

  async function handleSubmit() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user!.id)
      .single();

    await supabase.from("assignment_submissions").insert({
      assignment_id: id,
      student_id: student?.id,
      submission_text: text,
      file_url: fileUrl || null,
    });

    toast.success("Assignment submitted");
    router.push(`/student/assignments/${id}`);
  }

  if (!assignment) return null;

  return (
    <DashboardLayout role="student">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">Submit Assignment</h1>

        {(assignment.submission_type === "text" ||
          assignment.submission_type === "both") && (
          <Textarea
            placeholder="Type your answer here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}

        {(assignment.submission_type === "file" ||
          assignment.submission_type === "both") && (
          <input
            type="text"
            placeholder="File URL (GitHub upload result)"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
          />
        )}

        <Button onClick={handleSubmit}>Submit</Button>
      </div>
    </DashboardLayout>
  );
}
