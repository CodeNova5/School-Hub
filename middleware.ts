import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs"; // ✅ Fixes secret mismatch issue

export function middleware(req: NextRequest) {
  const token = req.cookies.get("admin_token")?.value;

  if (!token) {
    console.log("❌ No token found, redirecting to login");
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const jwtSecret = process.env.JWT_SECRET;
  console.log("JWT_SECRET (length):", jwtSecret?.length);

  if (!jwtSecret) {
    console.error("❌ JWT_SECRET missing in middleware");
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  try {
    jwt.verify(token, jwtSecret);
    console.log("✅ Token verified");
    return NextResponse.next();
  } catch (err) {
    console.error("❌ Invalid token:", err);
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
}

export const config = {
  // Apply middleware to all /admin routes except /admin/login
  matcher: ["/admin/:path*", "!/admin/login"],
};
