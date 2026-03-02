"use server";

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Server action to get the current user session.
 * Safe to call from client components via useTransition or useAction.
 */
export async function getCurrentUser() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: (user.user_metadata?.role as string | undefined) || 
             (user.app_metadata?.role as string | undefined),
      schoolId: (user.user_metadata?.school_id as string | undefined) || 
                (user.app_metadata?.school_id as string | undefined),
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Server action to get the current session.
 * Useful for checking if user is authenticated.
 */
export async function getCurrentSession() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session;
  } catch (error) {
    console.error("Error getting current session:", error);
    return null;
  }
}

/**
 * Server action to check if current user is super admin.
 */
export async function checkIsSuperAdmin() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: canAccess } = await supabase.rpc("can_access_super_admin");
    return !!canAccess;
  } catch (error) {
    console.error("Error checking super admin:", error);
    return false;
  }
}
