import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";


export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { pathname } = req.nextUrl;

  // Route configs
  const routeConfigs = [
    {
      prefix: "/admin",
      login: "/admin/login",
      activate: "/admin/activate",
      rpc: "can_access_admin",
      dashboard: "/admin",
    },
    {
      prefix: "/teacher",
      login: "/teacher/login",
      activate: "/teacher/activate",
      rpc: "can_access_teacher",
      dashboard: "/teacher",
    },
    {
      prefix: "/student",
      login: "/student/login",
      activate: "/student/activate",
      rpc: "can_access_student",
      dashboard: "/student",
    },
    {
      prefix: "/parent",
      login: "/parent/login",
      activate: "/parent/activate",
      rpc: "can_access_parent",
      dashboard: "/parent",
    },
  ];

  // Handle root path - redirect authenticated users to their dashboard
  if (pathname === "/") {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      // Get user metadata to determine their role
      const userRole = session.user?.user_metadata?.role;
      
      // Map role to config
      const roleConfigMap: Record<string, (typeof routeConfigs)[0]> = {};
      routeConfigs.forEach((cfg) => {
        const role = cfg.prefix.slice(1); // Remove leading slash to get role name
        roleConfigMap[role] = cfg;
      });
      
      const config = roleConfigMap[userRole];
      
      if (config) {
        // Verify they still have access
        const { data: canAccess } = await supabase.rpc(config.rpc);
        if (canAccess) {
          return NextResponse.redirect(new URL(config.dashboard, req.url));
        }
      }
    }
    
    return res;
  }

  // Find which config matches
  const config = routeConfigs.find((cfg) => pathname.startsWith(cfg.prefix));
  if (!config) {
    return res;
  }

  const isLoginRoute = pathname === config.login;
  const isActivateRoute = pathname === config.activate;
  const isResetPasswordRoute = pathname === `${config.prefix}/reset-password`;

  // Allow unauthenticated access to login, activate, and reset-password
  if (isLoginRoute || isActivateRoute || isResetPasswordRoute) {
    const {
      data: { session: loginSession },
    } = await supabase.auth.getSession();

    if (loginSession) {
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

  // All other protected routes
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = config.login;
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: canAccess, error } = await supabase.rpc(config.rpc);
  if (error || !canAccess) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = config.login;
    redirectUrl.searchParams.set("error", "unauthorized");
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

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
