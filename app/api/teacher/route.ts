import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Teacher from "@/models/Teacher";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { schoolDetails } from "@/data";
import Student from "@/models/Student";

export const runtime = "nodejs"; // ✅ Fixes secret mismatch issue


export async function POST(req: Request) {
  try {
    await dbConnect();
    const { type, ...data } = await req.json();

    // ===============================
    // 1️⃣ REGISTER TEACHER
    // ===============================
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

      if (!username || username.length < 6)
        return NextResponse.json({ success: false, message: "Username must be at least 6 characters" }, { status: 400 });

      const existingEmail = await Teacher.findOne({ email });
      if (existingEmail)
        return NextResponse.json({ success: false, message: "Email already registered" }, { status: 400 });

      const hashedPassword = await bcrypt.hash(password, 10);
      const activationToken = jwt.sign(
        { email },
        process.env.JWT_SECRET!,
        { expiresIn: "1d" }
      );

      const newTeacher = new Teacher({
        fullName,
        gender,
        email,
        username,
        address,
        phoneNumber,
        assignedClass,
        password: hashedPassword,
        status: "pending",
        activationToken,
      });

      await newTeacher.save();

      // Send activation email
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const activationLink = `${schoolDetails.website}/teacher/activate?token=${activationToken}`;

      await transporter.sendMail({
        from: `"Tecrust School Hub" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Activate your Teacher Portal",
        html: `
          <h2>Welcome, ${fullName}!</h2>
          <p>Click the button below to activate your teacher portal:</p>
          <a href="${activationLink}" style="background:#4CAF50;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Activate Portal</a>
          <p>This link will expire in 24 hours.</p>
        `,
      });

      return NextResponse.json({
        success: true,
        message: "✅ Registration successful! Please check your email to activate your portal.",
      });
    }

    // ===============================
    // 2️⃣ ACTIVATE TEACHER ACCOUNT
    // ===============================
    else if (type === "activate") {
      const { token } = data;

      if (!token)
        return NextResponse.json({ success: false, message: "Missing token" }, { status: 400 });

      // token is a JWT stored in activationToken field — find by that field
      const teacher = await Teacher.findOne({ activationToken: token });
      if (!teacher)
        return NextResponse.json({ success: false, message: "Invalid activation link" }, { status: 404 });

      if (teacher.status === "active") {
        return NextResponse.json({ success: true, message: "Account already activated" });
      }

      teacher.status = "active"; // match schema enum
      teacher.activationToken = undefined; // clear token after activation
      await teacher.save();

      return NextResponse.json({ success: true, message: "Account activated successfully" });
    }


    // ===============================
    // 3️⃣ LOGIN TEACHER
    // ===============================
    else if (type === "login") {
      const { emailOrUsername, password } = data;

      const teacher = await Teacher.findOne({
        $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
      });

      if (!teacher)
        return NextResponse.json({ success: false, message: "Teacher not found" }, { status: 404 });

      if (teacher.status !== "active")
        return NextResponse.json({
          success: false,
          message: "Please check your email to activate your account.",
        }, { status: 403 });

      const isMatch = await bcrypt.compare(password, teacher.password);
      if (!isMatch)
        return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });

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

    // ===============================
    // 4️⃣ GET TEACHER PROFILE
    // ===============================
    else if (type === "getProfile") {
      const token = req.headers.get("cookie")?.split("teacherToken=")[1]?.split(";")[0];

      if (!token) {
        return NextResponse.json(
          { success: false, message: "Not authenticated" },
          { status: 401 }
        );
      }

      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const teacher = await Teacher.findById(decoded.id).select("-password");

        if (!teacher) {
          return NextResponse.json(
            { success: false, message: "Teacher not found" },
            { status: 404 }
          );
        }

        const students = await Student.find({ className: teacher.assignedClass });

        return NextResponse.json({
          success: true,
          teacher,
          students,
        });
      } catch (err) {
        console.error("JWT verification failed:", err);
        return NextResponse.json(
          { success: false, message: "Invalid or expired token" },
          { status: 403 }
        );
      }
    }


    // ===============================
    // 5️⃣ ADD STUDENT
    // ===============================
    else if (type === "addStudent") {
      const {
        fullName,
        gender,
        email,
        address,
        phone,
        className,
        department,
        parentName,
        parentPhone,
        parentEmail,
        teacherId,
      } = data;

      if (!fullName) {
        return NextResponse.json(
          { success: false, message: "Missing FullName" },
          { status: 400 }
        );
      }

      if (!gender) {
        return NextResponse.json(
          { success: false, message: "Missing Gender" },
          { status: 400 }
        );
      }
      if (!className) {
        return NextResponse.json(
          { success: false, message: "Missing Class Name" },
          { status: 400 }
        );
      }
      await dbConnect();

      // prevent duplicates
      const existing = await Student.findOne({ email });
      if (existing)
        return NextResponse.json(
          { success: false, message: "Student already exists" },
          { status: 400 }
        );

      // generate admission number automatically
      const admissionNumber = `STU-${Math.floor(1000 + Math.random() * 9000)}`;

      const newStudent = await Student.create({
        fullName,
        gender,
        email,
        address,
        phone,
        className,
        department,
        parentName,
        parentPhone,
        parentEmail,
        addedByTeacher: teacherId,
        admissionNumber,
        status: "active",
      });

      return NextResponse.json({
        success: true,
        message: "✅ Student added successfully",
        student: newStudent,
      });
    }
    // ===============================
    // 6️⃣ ATTENDANCE
    // ===============================

    else if (type === "attendance") {
      try {
        const token = req.headers.get("cookie")?.split("teacherToken=")[1]?.split(";")[0];
        if (!token)
          return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded.id)
          return NextResponse.json({ success: false, message: "Invalid token" }, { status: 403 });

        const { records, date } = data;
        if (!records || !Array.isArray(records) || records.length === 0)
          return NextResponse.json({ success: false, message: "No attendance records provided" }, { status: 400 });

        const targetDate = date ? new Date(date) : new Date();
        const targetDateString = targetDate.toISOString().split("T")[0];

        let updatedCount = 0;

        for (const record of records) {
          const { studentId, status } = record;
          if (!studentId || !status) continue;

          const student = await Student.findById(studentId);
          if (!student) continue;

          // Check if attendance for this date already exists
          const existingRecordIndex = student.attendance.findIndex(
            (a: any) => a.date.toISOString().split("T")[0] === targetDateString
          );

          if (existingRecordIndex !== -1) {
            // Update existing record
            student.attendance[existingRecordIndex].status = status;
          } else {
            // Add new record
            student.attendance.push({ date: targetDate, status });
          }

          // Recalculate attendance %
          const total = student.attendance.length;
          const presentCount = student.attendance.filter((a: any) => a.status === "Present").length;
          student.averageAttendance = Math.round((presentCount / total) * 100);

          await student.save();
          updatedCount++;
        }

        return NextResponse.json({
          success: true,
          message: `✅ Attendance saved for ${updatedCount} students (${targetDateString})`,
        });
      } catch (error: any) {
        console.error("Attendance error:", error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }
    }

    // ===============================
    // 7️⃣ ADD STUDENT RESULT
    // ===============================
    else if (type === "addResult") {
      try {
        const { studentId, results } = data;
        const student = await Student.findById(studentId);
        if (!student)
          return NextResponse.json({ success: false, message: "Student not found" });

        student.results = results;
        await student.save();

        return NextResponse.json({
          success: true,
          message: "Results saved successfully",
        });
      } catch (err: any) {
        console.error("Result save error:", err);
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
      }
    }



    // ===============================
    //  INVALID TYPE
    // ===============================
    else {
      return NextResponse.json({ success: false, message: "Invalid request type" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Teacher route error:", error);
    return NextResponse.json({ success: false, message: "Server error", error: error.message }, { status: 500 });
  }

}

