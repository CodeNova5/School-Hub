import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/github";

export async function POST(req: Request) {
    const { assignmentId, studentId, fileName, fileContentBase64 } = await req.json();

    const path = `assignments/${assignmentId}/${studentId}/${Date.now()}-${fileName}`;

    const fileUrl = await uploadFile({
      path,
      content: fileContentBase64,
      commitMessage: `Upload assignment ${assignmentId} by ${studentId}`,
    });

    return NextResponse.json({ fileUrl });
}
