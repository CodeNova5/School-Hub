import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/lib/models/Admission";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();

    const newAdmission = await Admission.create(data);

    // --- Send confirmation email ---
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Your School" <${process.env.SMTP_USER}>`,
      to: data.parentEmail,
      subject: "Admission Application Received",
      html: `
        <h2>Dear ${data.parentFirstName} ${data.parentLastName},</h2>
        <p>Your child's admission application has been successfully received.</p>
        <p><strong>Student Name:</strong> ${data.firstName} ${data.lastName}</p>
        <p><strong>Class Applying For:</strong> ${data.classApplyingFor}</p>
        <p>We’ll review the application and get back to you shortly.</p>
        <br/>
        <p>Thank you,<br/>The School Admissions Office</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, admission: newAdmission },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admission error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to submit application" },
      { status: 500 }
    );
  }
}

export async function GET() {
  await dbConnect();
  const admissions = await Admission.find().sort({ createdAt: -1 });
  return NextResponse.json(admissions);
}
