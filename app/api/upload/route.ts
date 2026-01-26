import { NextResponse } from "next/server";
import { uploadFile, fileToBase64 } from "@/lib/github";

type UploadType = "student_photo" | "assignment_file" | "teacher_assignment_file";

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

    const base64 = await fileToBase64(file);

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

      case "teacher_assignment_file": {
        const assignmentId = form.get("assignment_id") as string;

        if (!assignmentId) {
          throw new Error("assignment_id is required");
        }

        path = `assignments/${assignmentId}/${file.name}`;
        commitMessage = `Upload teacher assignment ${assignmentId}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported upload type" },
          { status: 400 }
        );
    }

    const url = await uploadFile({
      path,
      content: base64,
      commitMessage,
    });

    return NextResponse.json({ fileUrl: url });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
