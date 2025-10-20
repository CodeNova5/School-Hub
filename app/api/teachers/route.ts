import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Teacher from "@/models/Teacher";
import Student from "@/models/Student";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyTeacher } from "@/lib/verifyTeacher";

// ──────────────────────────────────────────────
// 🔹 Single Unified Teachers Route (by ?type=...)
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // Get query type
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const data = await req.json();

    // ─────────────── LOGIN ───────────────
    if (type === "login") {
      const { emailOrUsername, password } = data;

      const teacher = await Teacher.findOne({
        $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
      });

      if (!teacher)
        return NextResponse.json(
          { success: false, message: "Teacher not found" },
          { status: 404 }
        );

      const isMatch = await bcrypt.compare(password, teacher.password);
      if (!isMatch)
        return NextResponse.json(
          { success: false, message: "Invalid credentials" },
          { status: 401 }
        );

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

    // ─────────────── REGISTER TEACHER ───────────────
    else if (type === "register") {
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

      if (!username || username.length < 6)
        return NextResponse.json(
          { success: false, message: "Username must be at least 6 characters" },
          { status: 400 }
        );

      const existingEmail = await Teacher.findOne({ email });
      if (existingEmail)
        return NextResponse.json(
          { success: false, message: "Email already registered" },
          { status: 400 }
        );

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

    // ─────────────── ADD STUDENT ───────────────
    else if (type === "addStudent") {
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
        return NextResponse.json(
          { success: false, message: "Missing required fields" },
          { status: 400 }
        );

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

      return NextResponse.json({
        success: true,
        message: "Student added successfully",
        student,
      });
    }

    // ─────────────── GET TEACHER PROFILE ───────────────
    else if (type === "getProfile") {
      const teacher = await verifyTeacher(req);
      if (!teacher)
        return NextResponse.json(
          { success: false, message: "Teacher not found" },
          { status: 404 }
        );

      return NextResponse.json({ success: true, teacher });
    }

    // ─────────────── INVALID TYPE ───────────────
    else {
      return NextResponse.json(
        { success: false, message: "Invalid request type" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("❌ Teacher route error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
