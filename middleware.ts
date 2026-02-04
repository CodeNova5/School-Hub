import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { pathname, searchParams } = req.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/admin/login";
  const isActivateRoute = pathname === "/admin/activate";

  // If route is not under /admin, let it pass
  if (!isAdminRoute) {
    return res;
  }

  // Allow unauthenticated access to the login and activate pages
  if (isLoginRoute || isActivateRoute) {
    // If already admin, bounce to dashboard
    const {
      data: { session: loginSession },
    } = await supabase.auth.getSession();

    if (loginSession) {
      const { data: canAccess } = await supabase.rpc("can_access_admin");

      if (canAccess) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/admin";
        redirectUrl.searchParams.delete("redirectedFrom");
        return NextResponse.redirect(redirectUrl);
      }
    }

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

  // Session exists: check admin access using new permission system
  const { data: canAccess, error } = await supabase.rpc("can_access_admin");

  if (error || !canAccess) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/admin/login";
    redirectUrl.searchParams.set("error", "unauthorized");
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
