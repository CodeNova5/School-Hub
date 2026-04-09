import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { uploadFile, fileToBase64 } from "@/lib/github";

type UploadType = 
  | "student_photo" 
  | "assignment_file" 
  | "teacher_assignment_file"
  | "school_logo"
  | "admin_signature";

export async function POST(req: Request) {
  try {
    // Verify user is authenticated
    const routeClient = createRouteHandlerClient({ cookies });
    const { data: { user } } = await routeClient.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Updated the file extension logic to dynamically use the uploaded file's extension
    const fileExtension = file.name.split('.').pop();

    /**
     * Decide how to handle upload based on type
     */
    switch (type) {
      case "student_photo": {
        const studentId = form.get("student_id") as string;
        if (!studentId) throw new Error("student_id is required");

        path = `students/${studentId}.${fileExtension}`;
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

      case "school_logo": {
        const schoolId = form.get("school_id") as string;
        if (!schoolId) throw new Error("school_id is required");

        path = `logos/${schoolId}.${fileExtension}`;
        commitMessage = `Upload school logo for ${schoolId}`;
        break;
      }

      case "admin_signature": {
        const adminId = form.get("admin_id") as string;
        if (!adminId) throw new Error("admin_id is required");

        path = `signatures/${adminId}.${fileExtension}`;
        commitMessage = `Upload admin signature for ${adminId}`;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Unsupported upload type" },
          { status: 400 }
        );
    }

    const fileUrl = await uploadFile({
      path,
      content: base64,
      commitMessage,
    });

    return NextResponse.json({ 
      success: true,
      fileUrl,
      message: `${type.replace('_', ' ')} uploaded successfully`
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err.message },
      { status: 500 }
    );
  }
}
