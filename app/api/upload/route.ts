import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

type UploadType = "student_photo" | "assignment_file";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const file = form.get("file") as File;
    const type = form.get("type") as UploadType;

    if (!file || !type) {
      return NextResponse.json(
        { error: "file and type are required" },
        { status: 400 }
      );
    }

    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const owner = "CodeNova5";
    const repo = "Student-Photos";

    let path = "";
    let commitMessage = "";

    /**
     * Decide how to handle upload based on type
     */
    switch (type) {
      case "student_photo": {
        const studentId = form.get("student_id") as string;
        if (!studentId) throw new Error("student_id is required");

        path = `students/${studentId}.jpg`;
        commitMessage = `Upload student photo for ${studentId}`;
        break;
      }

      case "assignment_file": {
        const assignmentId = form.get("assignment_id") as string;
        const studentId = form.get("student_id") as string;

        if (!assignmentId || !studentId) {
          throw new Error("assignment_id and student_id are required");
        }

        path = `assignments/${assignmentId}/${studentId}-${file.name}`;
        commitMessage = `Upload assignment ${assignmentId} by ${studentId}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported upload type" },
          { status: 400 }
        );
    }

    // Check if file already exists (for updates)
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
}
