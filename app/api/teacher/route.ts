import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Teacher from "@/models/Teacher";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    await dbConnect();

    const { type, ...data } = await req.json();

    // 🧩 Teacher Registration
    if (type === "register") {
      const {
        fullName,
        gender,
        email,
        username,
        address,
        phoneNumber,
        assignedClass,
        password,
      } = data;

      // Validation
      if (!username || username.length < 6) {
        return NextResponse.json(
          { success: false, message: "Username must be at least 6 characters" },
          { status: 400 }
        );
      }

      const existingEmail = await Teacher.findOne({ email });
      if (existingEmail) {
        return NextResponse.json(
          { success: false, message: "Email already registered" },
          { status: 400 }
        );
      }

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
    }

    // 🧩 Teacher Login
    else if (type === "login") {
      const { emailOrUsername, password } = data;

      const teacher = await Teacher.findOne({
        $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
      });

      if (!teacher) {
        return NextResponse.json(
          { success: false, message: "Teacher not found" },
          { status: 404 }
        );
      }

      const isMatch = await bcrypt.compare(password, teacher.password);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, message: "Invalid credentials" },
          { status: 401 }
        );
      }

      // Generate JWT
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
    }

    // 🧩 Handle unknown type
    else {
      return NextResponse.json(
        { success: false, message: "Invalid request type" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error in teacher route:", error);
    return NextResponse.json(
      { success: false, message: "Server error", error: error.message },
      { status: 500 }
    );
  }
}
