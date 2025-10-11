import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Teacher from "@/models/Teacher";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const {
      fullName,
      gender,
      email,
      username,
      address,
      phoneNumber,
      assignedClass,
      password,
    } = await req.json();

    // Validation
    if (username.length < 6)
      return NextResponse.json({ success: false, message: "Username must be at least 6 characters" }, { status: 400 });

    const existingEmail = await Teacher.findOne({ email });
    if (existingEmail)
      return NextResponse.json({ success: false, message: "Email already registered" }, { status: 400 });


    // Temporarily store teacher info (verification phase)
    const hashedPassword = await bcrypt.hash(password, 10);
    const newTeacher = new Teacher({
      fullName,
      gender,
      email,
      username,
      address,
      phoneNumber,
      assignedClass,
      password: hashedPassword,
    });

    await newTeacher.save();

    return NextResponse.json({
      success: true,
      message: "Teacher registered successfully",
    });
  } catch (error) {
    console.error("Error registering teacher:", error);
    return NextResponse.json(
      { success: false, message: "Error registering teacher" },
      { status: 500 }
    );
  }
}
