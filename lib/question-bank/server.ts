import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export type AuthRoleContext = {
  ok: true;
  context: {
    supabase: any;
    userId: string;
    schoolId: string;
    role: 'admin' | 'teacher';
  };
};

type AuthRoleError = {
  ok: false;
  error: string;
  status: number;
};

export async function getQuestionBankAuthContext(rolePath: string): Promise<AuthRoleContext | AuthRoleError> {
  if (rolePath !== 'admin' && rolePath !== 'teacher') {
    return { ok: false, error: 'Invalid workspace path segment', status: 400 };
  }

  const supabase = createRouteHandlerClient({ cookies });

  // 1. Check user session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: 'Unauthorized access', status: 401 };
  }

  // 2. Resolve school context from role-specific table
  const table = rolePath === 'admin' ? 'admins' : 'teachers';
  const { data: profile, error: profileError } = await supabase
    .from(table)
    .select('school_id, is_active')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile?.school_id) {
    return { ok: false, error: `${rolePath === 'admin' ? 'Admin' : 'Teacher'} profile not found`, status: 404 };
  }

  if (!profile.is_active) {
    return { ok: false, error: 'Account is inactive', status: 403 };
  }

  return {
    ok: true,
    context: {
      supabase,
      userId: user.id,
      schoolId: profile.school_id,
      role: rolePath as 'admin' | 'teacher',
    },
  };
}
