import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ---------------------------------------------------------------------------
// Utility: extract subdomain from the incoming request host
// e.g. school1.myapp.com → "school1"
// Returns null when running on localhost or the naked domain
// ---------------------------------------------------------------------------
function getSubdomain(req: NextRequest): string | null {
  const host = req.headers.get("host") ?? "";
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || !hostname.includes(".")) return null;
  const parts = hostname.split(".");
  if (parts.length >= 3 && parts[0] !== "www") return parts[0];
  return null;
}

// ---------------------------------------------------------------------------
// Route configs for each portal role
// ---------------------------------------------------------------------------
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

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fail open if env vars are unavailable so public routes can still load.
  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        const existingHeaders = new Headers(res.headers);
        res = NextResponse.next();

        existingHeaders.forEach((value, key) => {
          res.headers.set(key, value);
        });

        for (const { name, value, options } of cookiesToSet) {
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        }
      },
    },
  });

  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);

    for (const cookie of res.cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    }

    return redirectResponse;
  };

  const { pathname } = req.nextUrl;

  // ------------------------------------------------------------------
  // Subdomain detection: resolve school and attach school_id header
  // NOTE: Commenting out subdomain detection for now. To enable:
  // 1. Add DNS CNAME records for each school subdomain
  // 2. Uncomment this block
  // ------------------------------------------------------------------
  // const subdomain = getSubdomain(req);
  // if (subdomain) {
  //   const { data: school } = await supabase.rpc("get_school_by_subdomain", {
  //     p_subdomain: subdomain,
  //   });
  //   if (school && school.length > 0) {
  //     if (!school[0].is_active) {
  //       return redirectWithCookies(new URL("/school-suspended", req.url));
  //     }
  //     res.headers.set("x-school-id", school[0].id);
  //     res.headers.set("x-school-name", school[0].name);
  //   } else {
  //     return redirectWithCookies(new URL("/school-not-found", req.url));
  //   }
  // }

  // ------------------------------------------------------------------
  // Super Admin routes: /super-admin/*
  // ------------------------------------------------------------------
  if (pathname.startsWith("/super-admin")) {
    const isSuperAdminLogin = pathname === "/super-admin/login";
    const { data: { session } } = await supabase.auth.getSession();

    if (isSuperAdminLogin) {
      if (session) {
        const { data: canAccess } = await supabase.rpc("can_access_super_admin");
        if (canAccess) return redirectWithCookies(new URL("/super-admin", req.url));
      }
      return res;
    }

    if (!session) return redirectWithCookies(new URL("/super-admin/login", req.url));

    const { data: canAccess } = await supabase.rpc("can_access_super_admin");
    if (!canAccess)
      return redirectWithCookies(new URL("/super-admin/login?error=unauthorized", req.url));

    return res;
  }

  // ------------------------------------------------------------------
  // Root path: redirect authenticated users to their dashboard
  // ------------------------------------------------------------------
  if (pathname === "/") {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      const userRole = session.user?.user_metadata?.role as string | undefined;

      if (userRole === "super_admin") {
        return redirectWithCookies(new URL("/super-admin", req.url));
      }

      const roleConfigMap: Record<string, (typeof routeConfigs)[0]> = {};
      routeConfigs.forEach((cfg) => {
        const role = cfg.prefix.slice(1);
        roleConfigMap[role] = cfg;
      });

      const config = roleConfigMap[userRole ?? ""];
      if (config) {
        const { data: canAccess } = await supabase.rpc(config.rpc);
        if (canAccess) {
          return redirectWithCookies(new URL(config.dashboard, req.url));
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
  // Don't check session here to avoid cookie access in middleware for these public routes
  // Client-side will handle redirects if user is already authenticated
  if (isLoginRoute || isActivateRoute || isResetPasswordRoute) {
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
    return redirectWithCookies(redirectUrl);
  }

  const { data: canAccess, error } = await supabase.rpc(config.rpc);
  if (error || !canAccess) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = config.login;
    redirectUrl.searchParams.set("error", "unauthorized");
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return redirectWithCookies(redirectUrl);
  }

  // For admin routes, verify school_id matches subdomain (skip for login/activate/reset-password)
  if (config.prefix === "/admin" && !pathname.startsWith("/admin/login") && !pathname.startsWith("/admin/activate") && !pathname.startsWith("/admin/reset-password")) {
    const currentSchoolId = req.headers.get("x-school-id");
    const { data: adminSchoolId } = await supabase.rpc("get_my_school_id");

    if (currentSchoolId && adminSchoolId && currentSchoolId !== adminSchoolId) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/admin/login";
      redirectUrl.searchParams.set("error", "school_mismatch");
      return redirectWithCookies(redirectUrl);
    }
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
    "/super-admin/:path*",
  ],
};
