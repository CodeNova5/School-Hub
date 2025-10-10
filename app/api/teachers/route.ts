import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Teacher from "@/models/Teacher";
import nodemailer from "nodemailer";
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

    // Generate verification code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail", // or your SMTP
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"SchoolHub" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify your email - Teacher Registration",
      html: `
        <h3>Email Verification</h3>
        <p>Hello ${fullName},</p>
        <p>Your verification code is:</p>
        <h2>${verificationCode}</h2>
        <p>Use this code to complete your registration.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

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
      verificationCode,
    });

    await newTeacher.save();

    return NextResponse.json({
      success: true,
      message: "Verification code sent to email.",
    });
  } catch (error) {
    console.error("Error registering teacher:", error);
    return NextResponse.json(
      { success: false, message: "Error registering teacher" },
      { status: 500 }
    );
  }
}
