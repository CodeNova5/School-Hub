import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export async function POST(req: Request) {
    const { assignmentId, studentId, fileName, fileContentBase64 } = await req.json();
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const repo = "assignment-submissions";
    const owner = "CodeNova5";

    const path = `assignments/${assignmentId}/${studentId}/${Date.now()}-${fileName}`;

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

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Upload assignment ${assignmentId} by ${studentId}`,
      content: fileContentBase64,
    });

    const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    return NextResponse.json({ fileUrl });
}
