 /**
 * school-context.ts
 * -----------------
 * Utilities for working with the current school context throughout the app.
 *
 * school_id is determined in this order:
 *   1. JWT app_metadata.school_id  (set by the custom_access_token_hook)
 *   2. user_role_links.school_id   (direct DB query)
 *   3. null (super_admin – can query all schools)
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

/**
 * Get the school_id for the currently authenticated user.
 * Returns null for super_admin (no school restriction).
 */
export async function getMySchoolId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // First try JWT claims (fast, no extra DB query)
  const fromJwt =
    (user.app_metadata?.school_id as string | undefined) ??
    (user.user_metadata?.school_id as string | undefined);

  if (fromJwt) return fromJwt;

  // Fallback: query user_role_links directly
  const { data } = await supabase.rpc('get_my_school_id');
  return data ?? null;
}

/**
 * Get the current user's role.
 * Priority: JWT app_metadata > user_metadata
 */
export async function getMyRole(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    (user.app_metadata?.role as string | undefined) ??
    (user.user_metadata?.role as string | undefined) ??
    null
  );
}

/**
 * Returns true when the current user is a super_admin.
 */
export async function isSuperAdmin(): Promise<boolean> {
  const role = await getMyRole();
  if (role === 'super_admin') return true;
  const { data } = await supabase.rpc('can_access_super_admin');
  return !!data;
}

/**
 * Returns { schoolId, role } for use inside server components / API routes.
 * In server contexts prefer reading from request headers (x-school-id) set
 * by the middleware instead of calling this function.
 */
export async function getSchoolContext(): Promise<{
  schoolId: string | null;
  role: string | null;
}> {
  const [schoolId, role] = await Promise.all([getMySchoolId(), getMyRole()]);
  return { schoolId, role };
}

/**
 * Build a Supabase query fragment that filters by school.
 * Usage:
 *   const schoolId = await getMySchoolId();
 *   const { data } = await supabase.from('students')
 *     .select('*')
 *     .eq('school_id', schoolId!);
 *
 * RLS on the DB handles security – this client-side filter is an extra
 * performance optimisation so the DB doesn't have to scan extra rows.
 */
export function schoolFilter(schoolId: string): Record<string, string> {
  return { school_id: schoolId };
}
