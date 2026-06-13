import { createSupabaseClient } from '@/lib/supabase';

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
  const supabase = createSupabaseClient();

  // 1. Check user session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: 'Unauthorized access', status: 401 };
  }

  // 2. Resolve school context from meta or user profile
  // Adjust this query based on how school_id is linked to your authenticated users
  const { data: profile, error: profileError } = await supabase
    .from('profiles') 
    .select('school_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.school_id) {
    return { ok: false, error: 'School context not found', status: 404 };
  }

  const schoolId = profile.school_id;

  // 3. Verify path role aligns with user profile role permissions
  // If your routing path is '/api/admin/...' but they are a teacher, reject it
  if (rolePath !== 'admin' && rolePath !== 'teacher') {
    return { ok: false, error: 'Invalid workspace path segment', status: 400 };
  }

  if (profile.role !== rolePath) {
    return { ok: false, error: 'Forbidden: Role mismatch', status: 403 };
  }

  return {
    ok: true,
    context: {
      supabase,
      userId: user.id,
      schoolId,
      role: profile.role as 'admin' | 'teacher',
    },
  };
}