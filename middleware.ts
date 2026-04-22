
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

// Portal configuration
const PORTAL_CONFIG = {
  admin: {
    prefix: "/admin",
    login: "/admin/login",
    activate: "/admin/activate",
    rpc: "can_access_admin",
    dashboard: "/admin",
  },
  teacher: {
    prefix: "/teacher",
    login: "/teacher/login",
    activate: "/teacher/activate",
    rpc: "can_access_teacher",
    dashboard: "/teacher",
  },
  student: {
    prefix: "/student",
    login: "/student/login",
    activate: "/student/activate",
    rpc: "can_access_student",
    dashboard: "/student",
  },
  parent: {
    prefix: "/parent",
    login: "/parent/login",
    activate: "/parent/activate",
    rpc: "can_access_parent",
    dashboard: "/parent",
  },
} as const;

const PUBLIC_ROUTES = [
  (pathname: string, config: (typeof PORTAL_CONFIG)[keyof typeof PORTAL_CONFIG]) => 
    pathname === config.login,
  (pathname: string, config: (typeof PORTAL_CONFIG)[keyof typeof PORTAL_CONFIG]) => 
    pathname === config.activate,
  (pathname: string, config: (typeof PORTAL_CONFIG)[keyof typeof PORTAL_CONFIG]) => 
    pathname === `${config.prefix}/reset-password`,
];

function getPortalConfig(pathname: string) {
  for (const [, config] of Object.entries(PORTAL_CONFIG)) {
    if (pathname.startsWith(config.prefix)) {
      return config;
    }
  }
  return null;
}

function isPublicRoute(pathname: string, config: (typeof PORTAL_CONFIG)[keyof typeof PORTAL_CONFIG]) {
  return PUBLIC_ROUTES.some((checker) => checker(pathname, config));
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { pathname } = req.nextUrl;

  // Handle root path
  if (pathname === "/") {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const userRole = session.user?.user_metadata?.role;
      if (userRole && userRole in PORTAL_CONFIG) {
        const config = PORTAL_CONFIG[userRole as keyof typeof PORTAL_CONFIG];
        const { data: canAccess } = await supabase.rpc(config.rpc);
        if (canAccess) {
          return NextResponse.redirect(new URL(config.dashboard, req.url));
        }
      }
    }
    return res;
  }

  // Get portal configuration from pathname
  const config = getPortalConfig(pathname);
  if (!config) {
    return res;
  }

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Handle public routes (login, activate, reset-password)
  if (isPublicRoute(pathname, config)) {
    // If already authenticated and authorized, redirect to dashboard
    if (session) {
      const { data: canAccess } = await supabase.rpc(config.rpc);
      if (canAccess) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = config.dashboard;
        redirectUrl.searchParams.delete("redirectedFrom");
        return NextResponse.redirect(redirectUrl);
      }
    }
    return res;
  }

  // Protected routes - require authentication and authorization

  // No session - redirect to THIS portal's login
  if (!session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = config.login;
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Has session - verify authorization
  const { data: canAccess, error } = await supabase.rpc(config.rpc);

  if (error || !canAccess) {
    // Unauthorized - redirect to THIS portal's login with error
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = config.login;
    redirectUrl.searchParams.set("error", "unauthorized");
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Authorized - allow access
  return res;
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/parent/:path*",
  ],
};
