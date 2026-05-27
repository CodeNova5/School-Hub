import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export type TeacherQuestionBankContext = {
  supabase: ReturnType<typeof createRouteHandlerClient>;
  userId: string;
  teacherId: string;
  schoolId: string;
};

export type TeacherQuestionBankContextResult =
  | { ok: true; context: TeacherQuestionBankContext }
  | { ok: false; status: number; error: string };

export async function getTeacherQuestionBankContext(): Promise<TeacherQuestionBankContextResult> {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      error: 'Unauthorized',
    };
  }

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('id, school_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (teacherError || !teacher?.id || !teacher.school_id) {
    return {
      ok: false,
      status: 403,
      error: 'Teacher profile not found',
    };
  }

  return {
    ok: true,
    context: {
      supabase,
      userId: user.id,
      teacherId: teacher.id,
      schoolId: teacher.school_id,
    },
  };
}

export function parseGroqJsonPayload(rawContent: unknown): Record<string, unknown> | null {
  if (typeof rawContent !== 'string') {
    return null;
  }

  const trimmed = rawContent.trim();
  if (!trimmed) {
    return null;
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFence);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

export function toTopicList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}
