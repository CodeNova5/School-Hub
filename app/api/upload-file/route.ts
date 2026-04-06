import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_OWNER = "CodeNova5";
const GITHUB_REPO = "School-Assets";

interface UploadRequest {
  base64Content: string;
  fileName: string;
  commitMessage: string;
  fileType: 'logo' | 'signature'; // 'logo' for school logos, 'signature' for admin signatures
}

export async function POST(req: Request) {
  try {
    // Verify user is authenticated
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { user } } = await routeClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { base64Content, fileName, commitMessage, fileType } = await req.json() as UploadRequest;

    if (!base64Content || !fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing base64Content, fileName, or fileType" },
        { status: 400 }
      );
    }

    // Validate fileType
    if (fileType !== 'logo' && fileType !== 'signature') {
      return NextResponse.json(
        { error: "Invalid fileType. Must be 'logo' or 'signature'" },
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

    // Determine folder based on fileType
    const folder = fileType === 'logo' ? 'logos' : 'signatures';

    // Check if file already exists
    let sha: string | undefined;
    try {
      const { data } = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: `${folder}/${fileName}`,
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
        path: `${folder}/${fileName}`,
        message: commitMessage,
        content: base64Content,
        sha,
        branch: "main",
      });

      // Return the raw content URL
      const fileUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/${folder}/${fileName}`;

      return NextResponse.json({ 
        success: true, 
        fileUrl,
        message: `${fileType === 'logo' ? 'Logo' : 'Signature'} uploaded successfully`
      });
    } catch (uploadError: any) {
      console.error("GitHub upload error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload ${fileType} to GitHub: ` + uploadError.message },
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
