import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting store: IP -> { count: number; resetTime: number }
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Constants for rate limiting
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_REQUESTS_PER_HOUR = 5; // Max 5 applications per IP per hour

// Get client IP address
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// Check and update rate limit
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // Create new rate limit record
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - 1 };
  }

  if (record.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - record.count };
}

// Clean up expired rate limit records periodically
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((record, ip) => {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  });
}, 5 * 60 * 1000); // Clean up every 5 minutes

// Generate unique application number
async function generateApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `APP${year}${randomNum}`;
}

export async function POST(req: NextRequest) {
  try {
    // Get client IP and check rate limit
    const clientIP = getClientIP(req);
    const rateLimitCheck = checkRateLimit(clientIP);

    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Maximum 5 applications per hour per IP address.",
          retryAfter: 3600,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "3600",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // Validate request content type
    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Invalid content type. Expected application/json" },
        { status: 400 }
      );
    }

    const applicationData = await req.json();

    // Validate required fields
    const requiredFields = [
      "first_name",
      "last_name",
      "date_of_birth",
      "gender",
      "address",
      "parent_name",
      "parent_email",
      "parent_phone",
      "desired_class",
    ];

    for (const field of requiredFields) {
      if (!applicationData[field] || !applicationData[field].toString().trim()) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicationData.parent_email)) {
      return NextResponse.json(
        { error: "Invalid parent email format" },
        { status: 400 }
      );
    }

    // Generate unique application number
    const applicationNumber = await generateApplicationNumber();

    // Insert application into database using service role
    const { data: application, error } = await supabase
      .from("admissions")
      .insert({
        application_number: applicationNumber,
        first_name: applicationData.first_name.trim(),
        last_name: applicationData.last_name.trim(),
        email: (applicationData.email || "").trim(),
        phone: (applicationData.phone || "").trim(),
        date_of_birth: applicationData.date_of_birth,
        gender: applicationData.gender.toLowerCase(),
        address: applicationData.address.trim(),
        parent_name: applicationData.parent_name.trim(),
        parent_email: applicationData.parent_email.trim().toLowerCase(),
        parent_phone: applicationData.parent_phone.trim(),
        desired_class: applicationData.desired_class.trim(),
        previous_school: (applicationData.previous_school || "").trim(),
        notes: (applicationData.notes || "").trim(),
        status: "pending",
        submitted_at: new Date().toISOString(),
        ip_address: clientIP, // Store IP for fraud detection
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

    return NextResponse.json(
      {
        success: true,
        applicationNumber,
        message: "Application submitted successfully",
      },
      {
        headers: {
          "X-RateLimit-Remaining": rateLimitCheck.remaining.toString(),
          "X-RateLimit-Limit": MAX_REQUESTS_PER_HOUR.toString(),
          "X-RateLimit-Reset": (Date.now() + RATE_LIMIT_WINDOW).toString(),
        },
      }
    );
  } catch (error: any) {
    console.error("Error submitting application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit application" },
      { status: 500 }
    );
  }
}