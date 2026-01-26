import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_OWNER = "CodeNova5";
const GITHUB_REPO = "Student-Photos";

interface UploadFileOptions {
  path: string;
  content: string; // base64 encoded content
  commitMessage: string;
}

/**
 * Upload or update a file to GitHub repository
 * @param options - Upload configuration
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(options: UploadFileOptions): Promise<string> {
  const { path, content, commitMessage } = options;

  // Check if file already exists (for updates)
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path,
    });
    // @ts-ignore
    sha = data.sha;
  } catch (err: any) {
    if (err.status !== 404) throw err;
  }

  // Create or update the file
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path,
    message: commitMessage,
    content,
    sha,
  });

  // Return the public URL
  const url = `https://github.com/CodeNova5/${GITHUB_REPO}/${path}`;
  return url;
}

/**
 * Convert a File object to base64 string
 * @param file - The file to convert
 * @returns Base64 encoded string
 */
export async function fileToBase64(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return buffer.toString("base64");
}
