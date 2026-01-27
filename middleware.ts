import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { pathname, searchParams } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/admin/login";

  if (!isAdminRoute) {
    return res;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // No session -> redirect to login
  if (!session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/admin/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Session exists: check admin role
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);

interface UserRole {
    role: string;
}

const isAdmin: boolean = (roles as UserRole[] | null | undefined)?.some((r: UserRole) => r.role === "admin") ?? false;

  if (error || !isAdmin) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/admin/login";
    redirectUrl.searchParams.set("error", "unauthorized");
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Prevent logged-in admins from visiting login page again
  if (isLoginRoute && isAdmin) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/admin";
    redirectUrl.searchParams.delete("redirectedFrom");
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
