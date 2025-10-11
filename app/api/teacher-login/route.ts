import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Teacher from "@/models/Teacher";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { emailOrUsername, password } = await req.json();

    const teacher = await Teacher.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!teacher)
      return NextResponse.json({ success: false, message: "Teacher not found" }, { status: 404 });

    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch)
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });

    // Generate token
    const token = jwt.sign(
      { id: teacher._id, role: "teacher" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const res = NextResponse.json({
      success: true,
      message: "Login successful",
      teacher: {
        id: teacher._id,
        fullName: teacher.fullName,
        username: teacher.username,
        email: teacher.email,
      },
    });

    res.cookies.set("teacherToken", token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return res;
  } catch (error) {
    console.error("Error logging in teacher:", error);
    return NextResponse.json({ success: false, message: "Login failed" }, { status: 500 });
  }
}
