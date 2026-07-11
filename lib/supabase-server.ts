/**
 * Server-side Supabase client utilities using @supabase/ssr.
 *
 * Replaces createServerComponentClient and createRouteHandlerClient
 * from @supabase/auth-helpers-nextjs (now fully migrated to @supabase/ssr).
 *
 * Usage (Server Component / Route Handler):
 *   import { createServerSupabaseClient } from "@/lib/supabase-server";
 *   const supabase = await createServerSupabaseClient();
 *
 * Usage (Middleware):
 *   import { createMiddlewareSupabaseClient } from "@/lib/supabase-server";
 *   const supabase = createMiddlewareSupabaseClient(req, res);
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Create a Supabase client for Server Components and Route Handlers.
 * Uses `@supabase/ssr` with proper cookie handling via the `cookies()` API.
 *
 * In Server Components, the `setAll` catch is safe to ignore —
 * cookie writes are handled by middleware session refresh instead.
 */
export async function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore when
            // middleware handles session refresh.
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client for use in Middleware.
 * Reads/writes cookies from the request/response objects directly.
 *
 * After creating the client, call `await supabase.auth.getUser()` to
 * trigger automatic session refresh (new cookies are written to the
 * response via the `setAll` handler).
 */
export function createMiddlewareSupabaseClient(
  req: NextRequest,
  res: NextResponse
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );
}
