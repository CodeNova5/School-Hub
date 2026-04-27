import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fileToBase64, uploadFile } from "@/lib/github";
import { buildSchoolSenderName, sendEmailSafe } from "@/lib/email";
import { resolveSchoolName } from "@/lib/school-branding";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 5;
const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - 1 };
  }

  if (record.count >= MAX_REQUESTS_PER_HOUR) {
    return { allowed: false, remaining: 0 };
  }

  record.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS_PER_HOUR - record.count };
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-");
}

function extractSubdomain(hostname: string) {
  const hostWithoutPort = hostname.split(":")[0].toLowerCase();
  if (!hostWithoutPort) return null;

  if (hostWithoutPort.includes("localhost")) {
    const parts = hostWithoutPort.split(".");
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      const candidate = parts[0];
      if (candidate && candidate !== "www" && candidate !== "localhost") {
        return candidate;
      }
    }
    return null;
  }

  const parts = hostWithoutPort.split(".");
  if (parts.length >= 3) {
    const candidate = parts[0];
    if (candidate && candidate !== "www") {
      return candidate;
    }
  }

  return null;
}

function extractSubdomainFromRefererPath(req: NextRequest) {
  const referer = req.headers.get("referer") || "";
  if (!referer) return null;

  try {
    const refererUrl = new URL(referer);
    const match = refererUrl.pathname.match(/^\/site\/([^/]+)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

async function resolveSchoolId(req: NextRequest) {
  const schoolIdHeader = req.headers.get("x-school-id");
  if (schoolIdHeader) return schoolIdHeader;

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const subdomainFromHost = extractSubdomain(host);
  const subdomainFromPath = extractSubdomainFromRefererPath(req);
  const subdomain = subdomainFromHost || subdomainFromPath;

  if (!subdomain) return null;

  const { data, error } = await supabaseAdmin.rpc("get_school_by_subdomain", {
    p_subdomain: subdomain,
  });

  if (error) throw error;
  const school = Array.isArray(data) ? data[0] : data;
  return school?.id || null;
}

async function verifyCaptchaToken(token: string, remoteIp: string) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    throw new Error("reCAPTCHA is not configured on the server");
  }

  const verifyForm = new URLSearchParams();
  verifyForm.set("secret", secretKey);
  verifyForm.set("response", token);

  const verifyResponse = await fetch(RECAPTCHA_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyForm,
  });

  if (!verifyResponse.ok) {
    throw new Error("reCAPTCHA verification failed");
  }

  const verifyPayload = await verifyResponse.json();
  if (!verifyPayload?.success) {
    throw new Error(
      "reCAPTCHA verification was not successful. Score: " + (verifyPayload?.score || "N/A")
    );
  }
}

// Generate unique application number
async function generateApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");
  return `APP${year}${randomNum}`;
}

// Get school's admissions contact email from website settings
async function getSchoolAdmissionsEmail(schoolId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("website_site_settings")
    .select("contact_email")
    .eq("school_id", schoolId)
    .maybeSingle();

  return data?.contact_email || null;
}

// Clean up expired rate limit records
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((record, ip) => {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  });
}, 5 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
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

    const schoolId = await resolveSchoolId(req);
    if (!schoolId) {
      return NextResponse.json(
        { error: "School context could not be determined" },
        { status: 400 }
      );
    }

    const formData = await req.formData();

    // Extract form fields
    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const dateOfBirth = String(formData.get("date_of_birth") || "").trim();
    const gender = String(formData.get("gender") || "").trim().toLowerCase();
    const address = String(formData.get("address") || "").trim();
    const parentName = String(formData.get("parent_name") || "").trim();
    const parentEmail = String(formData.get("parent_email") || "").trim().toLowerCase();
    const parentPhone = String(formData.get("parent_phone") || "").trim();
    const desiredClass = String(formData.get("desired_class") || "").trim();
    const previousSchool = String(formData.get("previous_school") || "").trim();
    const religion = String(formData.get("religion") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const captchaToken = String(formData.get("captcha_token") || "").trim();

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !gender || !address) {
      return NextResponse.json(
        {
          error: "Missing required fields: first_name, last_name, date_of_birth, gender, address",
        },
        { status: 400 }
      );
    }

    if (!parentName || !parentEmail || !parentPhone) {
      return NextResponse.json(
        {
          error: "Missing required parent fields: parent_name, parent_email, parent_phone",
        },
        { status: 400 }
      );
    }

    if (!desiredClass) {
      return NextResponse.json(
        { error: "desired_class is required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return NextResponse.json(
        { error: "Invalid parent email format" },
        { status: 400 }
      );
    }

    if (!captchaToken) {
      return NextResponse.json(
        { error: "Please complete CAPTCHA verification" },
        { status: 400 }
      );
    }

    // Verify CAPTCHA
    await verifyCaptchaToken(captchaToken, clientIP);

    // Handle optional file upload
    let fileUrl = "";
    const document = formData.get("document");
    if (document instanceof File && document.size > 0) {
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ];
      if (!allowedTypes.includes(document.type)) {
        return NextResponse.json(
          { error: "Unsupported document type. Allowed: PDF, JPG, PNG, WebP, GIF" },
          { status: 400 }
        );
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (document.size > maxSize) {
        return NextResponse.json(
          { error: "Document exceeds 10MB size limit" },
          { status: 400 }
        );
      }

      const fileExtension = document.name.split(".").pop() || "pdf";
      const safeName = sanitizeFileName(document.name);
      const assetPath = `admissions/${schoolId}/documents/${Date.now()}-${safeName || `document.${fileExtension}`}`;
      const documentBase64 = await fileToBase64(document);
      fileUrl = await uploadFile({
        path: assetPath,
        content: documentBase64,
        commitMessage: `Upload admission document for school ${schoolId} - ${firstName} ${lastName}`,
      });
    }

    // Generate application number
    const applicationNumber = await generateApplicationNumber();

    // Insert into admissions table
    const { data: application, error: insertError } = await supabaseAdmin
      .from("admissions")
      .insert({
        school_id: schoolId,
        application_number: applicationNumber,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        date_of_birth: dateOfBirth,
        gender: gender,
        address: address,
        parent_name: parentName,
        parent_email: parentEmail,
        parent_phone: parentPhone,
        desired_class: desiredClass,
        previous_school: previousSchool,
        religion: religion,
        notes: notes,
        file_url: fileUrl,
        status: "pending",
        submitted_at: new Date().toISOString(),
        ip_address: clientIP,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Get school name for emails
    const schoolName = await resolveSchoolName(supabaseAdmin, schoolId);

    // Send email to parent
    await sendEmailSafe({
      to: parentEmail,
      fromName: buildSchoolSenderName(schoolName, "Admissions"),
      subject: `Application Received - ${schoolName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Application Received Successfully</h2>
          
          <p>Dear ${parentName},</p>
          
          <p>Thank you for submitting an admission application for <strong>${firstName} ${lastName}</strong> to ${schoolName}.</p>
          
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
            <li>For inquiries, please reference your application number</li>
          </ul>
          
          <p>If you have any questions, please feel free to contact us.</p>
          
          <p>Best regards,<br>
          <strong>${schoolName} Admissions Team</strong></p>
          <p style="color: #666; font-size: 12px;">Powered by School Deck.</p>
        </div>
      `,
    });

    // Send notification email to school admissions
    const schoolAdmissionsEmail = await getSchoolAdmissionsEmail(schoolId);
    if (schoolAdmissionsEmail) {
      await sendEmailSafe({
        to: schoolAdmissionsEmail,
        fromName: buildSchoolSenderName(schoolName, "Admissions Notifications"),
        subject: `New Admission Application - ${firstName} ${lastName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Admission Application Received</h2>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Applicant Name:</strong> ${firstName} ${lastName}</p>
              <p style="margin: 0 0 10px 0;"><strong>Application Number:</strong> ${applicationNumber}</p>
              <p style="margin: 0 0 10px 0;"><strong>Desired Class Level:</strong> ${desiredClass}</p>
              <p style="margin: 0 0 10px 0;"><strong>Parent Email:</strong> ${parentEmail}</p>
              <p style="margin: 0 0 10px 0;"><strong>Parent Phone:</strong> ${parentPhone}</p>
              <p style="margin: 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>
            
            <p>Please log in to your admin dashboard to review and process this application.</p>
            
            <p>Best regards,<br>
            <strong>School Deck Admissions System</strong></p>
          </div>
        `,
      });
    }

    return NextResponse.json(
      {
        success: true,
        applicationNumber,
        message: "Application submitted successfully",
      },
      {
        headers: {
          "X-RateLimit-Remaining": String(rateLimitCheck.remaining),
          "X-RateLimit-Limit": String(MAX_REQUESTS_PER_HOUR),
          "X-RateLimit-Reset": String(Date.now() + RATE_LIMIT_WINDOW),
        },
      }
    );
  } catch (error: any) {
    console.error("Error submitting admission application:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit admission application" },
      { status: 500 }
    );
  }
}
