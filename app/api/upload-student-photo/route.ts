import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const student_id = form.get("student_id") as string;

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const repo = "Student-Photos";
  const owner = "CodeNova5";
  const path = `students/${student_id}.jpg`;

  try {
    // Check if file exists
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      // @ts-ignore
      sha = data.sha; // file exists, we need sha to update
    } catch (err: any) {
      if (err.status !== 404) throw err; // if not found, it's fine, else throw
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Upload student photo for ${student_id}`,
      content: base64,
      sha, // only include sha if updating
    });

    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    return NextResponse.json({ url });

  } catch (err) {
    console.error("GitHub upload error:", err);
    return NextResponse.json({ error: "GitHub upload failed", details: err }, { status: 500 });
  }
}
