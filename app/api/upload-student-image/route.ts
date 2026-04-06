import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_OWNER = "CodeNova5";
const GITHUB_REPO = "Student-Photos";

interface UploadRequest {
  base64Content: string;
  fileName: string;
  commitMessage: string;
}

export async function POST(req: Request) {
  try {
    // Verify user is authenticated
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { user } } = await routeClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { base64Content, fileName, commitMessage } = await req.json() as UploadRequest;

    if (!base64Content || !fileName) {
      return NextResponse.json(
        { error: "Missing base64Content or fileName" },
        { status: 400 }
      );
    }

    // Ensure GITHUB_TOKEN is set
    if (!process.env.GITHUB_TOKEN) {
      console.error("GITHUB_TOKEN not configured");
      return NextResponse.json(
        { error: "GitHub upload not configured" },
        { status: 500 }
      );
    }

    // Check if file already exists
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: `students/${fileName}`,
      });
      // @ts-ignore
      sha = data.sha;
    } catch (err: any) {
      if (err.status !== 404) {
        console.error("Error checking file existence:", err);
        throw err;
      }
      // File doesn't exist, which is fine for new uploads
    }

    // Create or update the file
    try {
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: `students/${fileName}`,
        message: commitMessage,
        content: base64Content,
        sha,
        branch: "main",
      });

      // Return the raw content URL
      const imageUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/students/${fileName}`;

      return NextResponse.json({ 
        success: true, 
        imageUrl,
        message: "Image uploaded successfully"
      });
    } catch (uploadError: any) {
      console.error("GitHub upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image to GitHub: " + uploadError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Upload endpoint error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process upload" },
      { status: 500 }
    );
  }
}
