import { NextResponse } from "next/server";
import { verifyTeacher } from "@/lib/verifyTeacher";

export async function GET(req: Request) {
  try {
    const teacher = await verifyTeacher(req);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, teacher });
  } catch (err) {
    console.error("Error fetching teacher details:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
