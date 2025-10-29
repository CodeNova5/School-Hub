import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs"; // ✅ Fixes secret mismatch issue

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("❌ JWT_SECRET missing in middleware");
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  // 🔹 Handle Admin routes
  if (pathname.startsWith("/admin")) {
    if (pathname.startsWith("/admin/login")) return NextResponse.next();

    const adminToken = req.cookies.get("admin_token")?.value;

    if (!adminToken) {
      console.log("❌ No admin token found, redirecting to admin login");
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    try {
      jwt.verify(adminToken, jwtSecret);
      console.log("✅ Admin token verified");
      return NextResponse.next();
    } catch (err) {
      console.error("❌ Invalid admin token:", err);
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // 🔹 Handle Teacher routes
  if (pathname.startsWith("/teacher")) {
    if (pathname.startsWith("/teacher/login")) return NextResponse.next();
     if (pathname.startsWith("/teacher/activate")) return NextResponse.next();

    const teacherToken = req.cookies.get("teacherToken")?.value;

    if (!teacherToken) {
      console.log("❌ No teacher token found, redirecting to teacher login");
      return NextResponse.redirect(new URL("/teacher/login", req.url));
    }

    try {
      jwt.verify(teacherToken, jwtSecret);
      console.log("✅ Teacher token verified");
      return NextResponse.next();
    } catch (err) {
      console.error("❌ Invalid teacher token:", err);
      return NextResponse.redirect(new URL("/teacher/login", req.url));
    }
  }

  // Default — allow all other routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
  ],
};
