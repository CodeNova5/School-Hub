// lib/verifyTeacher.js
import jwt from "jsonwebtoken";
import Teacher from "@/models/Teacher";
import { dbConnect } from "@/lib/dbConnect";

export async function verifyTeacher(req: Request) {
  await dbConnect();

  // Read the raw Cookie header and extract the teacher_token value
  const cookieHeader = typeof (req as any).headers?.get === "function"
    ? (req as any).headers.get("cookie") || ""
    : "";
  let token: string | null = null;
  if (cookieHeader) {
    const match = cookieHeader.match(/(^|;\s*)teacher_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[2]);
  }

  if (!token) throw new Error("Unauthorized");

  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
  const teacher = await Teacher.findById(decoded.id).lean();

  if (!teacher) throw new Error("Teacher not found");
  return teacher;
}
