import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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

  if (!supabaseUrl || !supabaseAnonKey) {
    return res;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = req.cookies.getAll();
        console.log("🍪 Cookies in request:", cookies.map(c => `${c.name}`));
        return cookies;
      },
      setAll(cookiesToSet) {
        if (cookiesToSet.length === 0) return;
        res = NextResponse.next();
        cookiesToSet.forEach(({ name, value, options }) => {
          res.cookies.set(name, value, options);
        });
      },
    },
  });

  const { pathname } = req.nextUrl;

  // DEBUG: Log session info
  // Use getUser() instead of getSession() - works better in middleware with SSR
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
  
  console.log("🔐 Middleware Auth Check:", {
    url: req.nextUrl.pathname,
    hasUser: !!authUser,
    userId: authUser?.id,
    userRole: authUser?.user_metadata?.role,
    userError: userError?.message,
  });

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
    console.log("✅ Public route, allowing access:", pathname);
    return res;
  }

  // Protect other routes - require user
  if (!authUser) {
    console.log("❌ No user, redirecting to login from:", pathname);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = config.login;
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  console.log("✅ User authenticated, allowing access to:", pathname);
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
