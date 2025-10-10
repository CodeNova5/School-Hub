import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/dbConnect";
import Admission from "@/models/Admission";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    await dbConnect();
    const admissions = await Admission.find().lean();
    return NextResponse.json(admissions);
  } catch (error) {
    console.error("Error fetching admissions:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const admission = await Admission.create(body);
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
      to: admission.parentEmail,
      subject: "Admission Application Received",
      html: `
        <h2>Dear ${admission.parentFirstName} ${admission.parentLastName},</h2>
        <p>Your child's admission application has been successfully received.</p>
        <p><strong>Student Name:</strong> ${admission.studentFirstName} ${admission.studentLastName}</p>
        <p><strong>Date of Birth:</strong> ${admission.dateOfBirth} </p>
        <p><strong>Address:</strong> ${admission.address} </p>
        <p><strong>Class Applying For:</strong> ${admission.classApplyingFor}</p>
        <p>We’ll review the application and get back to you shortly.</p>
        <br/>
        <p>Thank you,<br/>The School Admissions Office</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(admission); // returns full doc including _id
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
