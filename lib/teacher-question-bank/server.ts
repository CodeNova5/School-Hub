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

  // 1. Try parsing the raw string directly first (fastest path).
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not plain JSON — fall through
  }

  // 2. Strip a single markdown code fence if present (handles ```json ... ``` wrappers).
  const withoutFence = trimmed
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFence);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to extraction
  }

  // 3. Extract the first {...} block from anywhere in the string.
  // Handles responses where the AI adds preamble text before the JSON.
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    try {
      const extracted = trimmed.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(extracted);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // could not extract valid JSON
    }
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
