import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { Octokit } from "@octokit/rest";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const type = formData.get("type") as string;

  if (!file || !type) {
    return NextResponse.json({ error: "Missing file or type" }, { status: 400 });
  }

  if (type === "student_photo") {
    try {
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = buffer.toString("base64");

      const owner = "CodeNova5";
      const repo = "Student-Photos";

      const studentId = formData.get("student_id") as string;
      if (!studentId) throw new Error("student_id is required");

      const path = `students/${studentId}.jpg`;
      const commitMessage = `Upload student photo for ${studentId}`;

      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({
          owner,
          repo,
          path,
        });
        // @ts-ignore
        sha = data.sha;
      } catch (err: any) {
        if (err.status !== 404) throw err;
      }

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: commitMessage,
        content: base64,
        sha,
      });

      const url = `https://codenova5.github.io/${repo}/${path}`;
      return NextResponse.json({ fileUrl: url });
    } catch (err: any) {
      console.error("Upload error:", err);
      return NextResponse.json(
        { error: "Upload failed", details: err.message },
        { status: 500 }
      );
    }
  } else {
    try {
      let filePath = "";
      const assignmentId = formData.get("assignment_id") as string;
      const studentId = formData.get("student_id") as string;

      if (type === "assignment_file") {
        if (!assignmentId) throw new Error("assignment_id is required");
        filePath = `assignments/${assignmentId}/${file.name}`;
      } else if (type === "submission_file") {
        if (!assignmentId || !studentId) {
          throw new Error("assignment_id and student_id are required");
        }
        filePath = `submissions/${assignmentId}/${studentId}/${file.name}`;
      } else {
        return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
      }

      const { error: uploadError } = await supabase.storage
        .from("files")
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("files")
        .getPublicUrl(filePath);

      return NextResponse.json({ fileUrl: data.publicUrl });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
