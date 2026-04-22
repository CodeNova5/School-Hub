
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

function rootHostFromSubdomainHost(hostname: string) {
  const [host, port] = hostname.split(":");
  const parts = host.split(".");

  let rootHost = host;
  if (host.includes("localhost")) {
    if (parts.length >= 2 && parts[parts.length - 1] === "localhost") {
      rootHost = "localhost";
    }
  } else if (parts.length >= 3) {
    rootHost = parts.slice(1).join(".");
  }

  return port ? `${rootHost}:${port}` : rootHost;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { pathname } = req.nextUrl;

  const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const subdomain = extractSubdomain(hostHeader);

  if (
    subdomain &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/site")
  ) {
    const isPortalPath = ["/admin", "/teacher", "/student", "/parent"].some((prefix) =>
      pathname.startsWith(prefix)
    );

    if (isPortalPath) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.host = rootHostFromSubdomainHost(hostHeader);
      return NextResponse.redirect(redirectUrl);
    }

    const { data: school, error: schoolError } = await supabase
      .rpc("get_school_by_subdomain", { p_subdomain: subdomain })
      .single<{ id: string; name: string; is_active: boolean }>();

    if (schoolError || !school?.id) {
      const notFoundUrl = req.nextUrl.clone();
      notFoundUrl.pathname = "/school-not-found";
      notFoundUrl.search = "";
      return NextResponse.rewrite(notFoundUrl);
    }

    if (!school.is_active) {
      const suspendedUrl = req.nextUrl.clone();
      suspendedUrl.pathname = "/school-suspended";
      suspendedUrl.search = "";
      return NextResponse.rewrite(suspendedUrl);
    }

    const rewriteUrl = req.nextUrl.clone();
    rewriteUrl.pathname = `/site/${subdomain}${pathname === "/" ? "" : pathname}`;

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-school-id", school.id);

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

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
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
