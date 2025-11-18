import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const student_id = form.get("student_id") as string;

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const repo = "Student-Photos";
  const owner = "CodeNova5";
  const path = `students/${student_id}.jpg`; // unique name

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: `Upload student photo for ${student_id}`,
    content: base64,
  });

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;

  return NextResponse.json({ url });
}
