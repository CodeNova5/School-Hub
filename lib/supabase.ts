// This client should only be created in browser environment
// Do not initialize at module level to avoid cookie access during build
// Instead, components should create their own client or use the factory function

let supabaseInstance: any = null;

export const createSupabaseClient = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!supabaseInstance) {
    try {
      const { createClientComponentClient } = require('@supabase/auth-helpers-nextjs');
      supabaseInstance = createClientComponentClient();
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      return null;
    }
  }
  return supabaseInstance;
};

// Lazy export for backward compatibility
// This will only be accessed when actually used in browser
export const supabase = new Proxy({}, {
  get: (target, prop) => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const client = createSupabaseClient();
    if (!client) return undefined;
    return (client as any)[prop];
  },
}) as any;
