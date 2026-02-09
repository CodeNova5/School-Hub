import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Generate unique application number
async function generateApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `APP${year}${randomNum}`;
}

export async function POST(req: Request) {
  try {
    const applicationData = await req.json();

    // Generate unique application number
    const applicationNumber = await generateApplicationNumber();

    // Insert application into database
    const { data: application, error } = await supabase
      .from("admissions")
      .insert({
        application_number: applicationNumber,
        first_name: applicationData.first_name,
        last_name: applicationData.last_name,
        email: applicationData.email || "",
        phone: applicationData.phone || "",
        date_of_birth: applicationData.date_of_birth,
        gender: applicationData.gender,
        address: applicationData.address,
        parent_name: applicationData.parent_name,
        parent_email: applicationData.parent_email,
        parent_phone: applicationData.parent_phone,
        desired_class: applicationData.desired_class,
        previous_school: applicationData.previous_school || "",
        notes: applicationData.notes || "",
        status: "pending",
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation email to parent
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"School Hub Admissions" <${process.env.EMAIL_USER}>`,
      to: applicationData.parent_email,
      subject: "Application Received - School Hub",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Application Received Successfully</h2>
          
          <p>Dear ${applicationData.parent_name},</p>
          
          <p>Thank you for submitting an admission application for <strong>${applicationData.first_name} ${applicationData.last_name}</strong>.</p>
          
          <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Application Number:</strong></p>
            <p style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 5px 0;">${applicationNumber}</p>
            <p style="margin: 0; font-size: 12px; color: #666;">Please save this number for future reference.</p>
          </div>
          
          <h3>What's Next?</h3>
          <ul style="line-height: 1.8;">
            <li>Your application is under review by our admissions team</li>
            <li>You will receive a decision within 3-5 business days</li>
            <li>If approved, you will receive activation instructions for the parent portal</li>
            <li>You can contact us at any time using your application number</li>
          </ul>
          
          <p>If you have any questions, please feel free to contact us.</p>
          
          <p>Best regards,<br>
          <strong>School Hub Admissions Team</strong></p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      applicationNumber,
      message: "Application submitted successfully",
    });
  } catch (error: any) {
    console.error("Error submitting application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit application" },
      { status: 500 }
    );
  }
}