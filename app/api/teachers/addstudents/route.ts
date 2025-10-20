import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Student from "@/models/Student";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();

    const {
      fullName,
      gender,
      email,
      address,
      phone,
      className,
      parentName,
      parentEmail,
      parentPhone,
    } = data;

    if (!fullName || !gender || !email || !className)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const admissionNumber = `STU-${Math.floor(100000 + Math.random() * 900000)}`;

    const student = await Student.create({
      fullName,
      gender,
      email,
      address,
      phone,
      className,
      parentName,
      parentEmail,
      parentPhone,
      admissionNumber,
    });

    return NextResponse.json({ success: true, student });
  } catch (error: any) {
    console.error("❌ Error adding student:", error);
    return NextResponse.json({ error: "Failed to add student" }, { status: 500 });
  }
}
