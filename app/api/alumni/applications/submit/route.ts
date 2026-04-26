import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fileToBase64, uploadFile } from "@/lib/github";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;

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

function normalizeOptionalUrl(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`URL must start with http or https: ${raw}`);
  }

  return raw;
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
          error: "Rate limit exceeded. Maximum 5 alumni applications per hour per IP address.",
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
      return NextResponse.json({ error: "School context could not be determined" }, { status: 400 });
    }

    const formData = await req.formData();

    const fullName = String(formData.get("full_name") || "").trim();
    const occupation = String(formData.get("occupation") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const story = String(formData.get("story") || "").trim();

    if (!fullName || !occupation || !email || !story) {
      return NextResponse.json(
        { error: "full_name, occupation, email, and story are required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const image = formData.get("image");
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024;
    if (image.size > maxSize) {
      return NextResponse.json({ error: "Image exceeds 5MB size limit" }, { status: 400 });
    }

    const fileExtension = image.name.split(".").pop() || "jpg";
    const safeName = sanitizeFileName(image.name);
    const assetPath = `websites/${schoolId}/alumni-applications/${Date.now()}-${safeName || `alumni.${fileExtension}`}`;
    const imageBase64 = await fileToBase64(image);
    const imageUrl = await uploadFile({
      path: assetPath,
      content: imageBase64,
      commitMessage: `Upload alumni application image for school ${schoolId}`,
    });

    const linkedinUrl = normalizeOptionalUrl(formData.get("linkedin_url"));
    const xUrl = normalizeOptionalUrl(formData.get("x_url"));
    const tiktokUrl = normalizeOptionalUrl(formData.get("tiktok_url"));
    const instagramUrl = normalizeOptionalUrl(formData.get("instagram_url"));
    const facebookUrl = normalizeOptionalUrl(formData.get("facebook_url"));
    const websiteUrl = normalizeOptionalUrl(formData.get("website_url"));

    const { error } = await supabaseAdmin.from("website_alumni_applications").insert({
      school_id: schoolId,
      full_name: fullName,
      occupation,
      email,
      phone,
      story,
      image_url: imageUrl,
      linkedin_url: linkedinUrl,
      x_url: xUrl,
      tiktok_url: tiktokUrl,
      instagram_url: instagramUrl,
      facebook_url: facebookUrl,
      website_url: websiteUrl,
      status: "pending",
      ip_address: clientIP,
      submitted_at: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json(
      { success: true, message: "Application submitted successfully" },
      {
        headers: {
          "X-RateLimit-Remaining": String(rateLimitCheck.remaining),
          "X-RateLimit-Limit": String(MAX_REQUESTS_PER_HOUR),
          "X-RateLimit-Reset": String(Date.now() + RATE_LIMIT_WINDOW),
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to submit alumni application" },
      { status: 500 }
    );
  }
}
