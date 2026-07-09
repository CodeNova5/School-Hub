
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { getRoutes, isApiPathExcluded, getApiFeatureForPath, getFeatureForPath } from "@/lib/route-enforcer";
import { getRequiredPermission } from "@/lib/route-permissions";

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

  // ── Load feature routes from DB (cached in-memory with 5-min TTL) ──
  const routes = await getRoutes(supabase);

  // ── API Route Plan Enforcement ──
  if (pathname.startsWith("/api")) {
    // Skip excluded routes (webhooks, public auth endpoints, super admin, etc.)
    if (isApiPathExcluded(pathname, routes)) {
      return res;
    }

    // ── Admin API Permission Check ──
    // For sub-admins, verify they have the required permission for this API endpoint.
    // Super admins bypass this check entirely.
    if (pathname.startsWith("/api/admin")) {
      const requiredPermission = getRequiredPermission(pathname, req.method);
      if (requiredPermission) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          return NextResponse.json(
            { error: "Authentication required" },
            { status: 401 }
          );
        }
        // Super admins bypass admin permission checks
        if (session?.user?.user_metadata?.role !== "super_admin") {
          try {
            const { data: hasPermission } = await supabase.rpc("check_my_admin_permission", {
              p_permission: requiredPermission,
            });
            if (!hasPermission) {
              return NextResponse.json(
                { error: "You don't have permission to access this resource" },
                { status: 403 }
              );
            }
          } catch {
            return NextResponse.json(
              { error: "Permission check failed" },
              { status: 500 }
            );
          }
        }
      }
    }

    // Check if this API path is a gated feature
    const apiFeature = getApiFeatureForPath(pathname, routes);
    if (!apiFeature) {
      // Not a gated feature — allow through
      return res;
    }

    // This API route requires a plan check — verify auth first
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // Unauthenticated request to a gated API — return 401
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Get school_id: try JWT claims (admins), fall back to RPC (others)
    let schoolId = session?.user?.user_metadata?.school_id;

    if (!schoolId) {
      try {
        const { data: sid } = await supabase.rpc("get_my_school_id");
        if (sid) schoolId = sid as string;
      } catch {
        // Ignore RPC errors
      }
    }

    if (!schoolId) {
      // Cannot determine school — allow through (the API handler will
      // handle its own auth/context checks). Avoid false positives.
      return res;
    }

    // Check if the school can access this feature (DB-driven, super admin customizable)
    let hasAccess = false;
    try {
      const { data: accessResult } = await supabase.rpc("check_school_feature_access", {
        p_school_id: schoolId,
        p_feature_key: apiFeature.feature,
      });
      if (accessResult && typeof accessResult === 'object') {
        const result = accessResult as { has_access: boolean; current_plan: string };
        hasAccess = result.has_access;
      }
    } catch {
      // Deny on error (default most restrictive)
    }

    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "This feature requires an upgraded plan",
          feature: apiFeature.feature,
        },
        { status: 403 }
      );
    }

    // Plan allows access — let the request through
    return res;
  }

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

  // ── Admin Permission Check (page routes) ──
  // For sub-admins, verify they have the required permission for this page.
  // Super admins bypass this check entirely.
  if (config.prefix === "/admin" && session?.user?.user_metadata?.role !== "super_admin") {
    const requiredPermission = getRequiredPermission(pathname);
    if (requiredPermission) {
      try {
        const { data: hasPermission } = await supabase.rpc("check_my_admin_permission", {
          p_permission: requiredPermission,
        });
        if (!hasPermission) {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = "/admin/no-access";
          redirectUrl.searchParams.set("permission", requiredPermission);
          return NextResponse.redirect(redirectUrl);
        }
      } catch {
        // Deny on error (most restrictive) — redirect to no-access page
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = "/admin/no-access";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  // ── Plan Enforcement ──
  // Only check plan if the current path matches a gated feature (Pro or Premium).
  // This avoids an extra RPC call on every page navigation.
  const portal = config.prefix.replace("/", "");
  const matchedFeature = getFeatureForPath(pathname, portal, routes);
  
  if (matchedFeature) {
    // This path requires a gated feature — fetch the school's plan.
    // Get school_id: try JWT claims first (admins), fall back to RPC (teachers/students/parents).
    let schoolId = session?.user?.user_metadata?.school_id;
    
    if (!schoolId) {
      try {
        const { data: sid } = await supabase.rpc('get_my_school_id');
        if (sid) schoolId = sid as string;
      } catch {
        // Ignore RPC errors
      }
    }

    if (!schoolId) {
      // Could not determine school_id — default to most restrictive, redirect to dashboard.
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = config.dashboard;
      return NextResponse.redirect(redirectUrl);
    }

    // Check if the school can access this feature (DB-driven, super admin customizable)
    let hasAccess = false;
    let currentPlan = 'basic';
    try {
      const { data: accessResult } = await supabase.rpc("check_school_feature_access", {
        p_school_id: schoolId,
        p_feature_key: matchedFeature.feature,
      });
      if (accessResult && typeof accessResult === 'object') {
        const result = accessResult as { has_access: boolean; current_plan: string };
        hasAccess = result.has_access;
        currentPlan = result.current_plan;
      }
    } catch {
      // Deny on error (default most restrictive)
    }

    if (!hasAccess) {
      // Plan doesn't include this feature — redirect to upgrade page
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/upgrade";
      redirectUrl.searchParams.set("feature", matchedFeature.feature);
      redirectUrl.searchParams.set("plan", currentPlan);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Authorized and plan allows access
  return res;
}

export const config = {
  matcher: [
    // Pages: everything except static files and API (handled separately below)
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    // API routes: apply plan enforcement to all API paths
    "/api/:path*",
  ],
};
