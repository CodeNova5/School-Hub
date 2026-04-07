import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const GITHUB_OWNER = "CodeNova5";

// Repository mapping for different upload types
const REPOSITORY_MAP: Record<string, string> = {
  "student-assets": "School-Deck-Assets",
  "school-assets": "School-Assets",
};

interface UploadFileOptions {
  path: string;
  content: string; // base64 encoded content
  commitMessage: string;
  repository?: keyof typeof REPOSITORY_MAP; // defaults to "student-assets"
}

/**
 * Upload or update a file to GitHub repository
 * @param options - Upload configuration
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(options: UploadFileOptions): Promise<string> {
  const { path, content, commitMessage, repository = "student-assets" } = options;
  
  const repo = REPOSITORY_MAP[repository];
  if (!repo) {
    throw new Error(`Unknown repository: ${repository}`);
  }

  // Check if file already exists (for updates)
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo,
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
    repo,
    path,
    message: commitMessage,
    content,
    sha,
    branch: "main",
  });

  // Return the raw content URL
  const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${repo}/main/${path}`;
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
