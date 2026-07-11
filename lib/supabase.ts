// This client should only be created in browser environment
// Do not initialize at module level to avoid cookie access during build
// Instead, components should create their own client or use the factory function

import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const createSupabaseClient = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!supabaseInstance) {
    try {
      supabaseInstance = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    } catch (error) {
      console.error("Failed to create Supabase client:", error);
      return null;
    }
  }
  return supabaseInstance;
};

// Lazy export for backward compatibility
// This will only be accessed when actually used in browser
export const supabase = new Proxy(
  {},
  {
    get: (target, prop) => {
      if (typeof window === "undefined") {
        return undefined;
      }
      const client = createSupabaseClient();
      if (!client) return undefined;
      return (client as any)[prop];
    },
  }
) as any;
