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

  // Helper utility to attempt aggressive string repair for bad LaTeX escapes
  function tryParsingWithSanitization(str: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Look for single backslashes that aren't already escaped, and double-escape them.
      // This targets backslashes followed by common alphabetic LaTeX commands or structural tokens
      try {
        const sanitized = str.replace(/(?<!\\)\\(?=[a-zA-Z{}])/g, '\\\\');
        const parsedSanitized = JSON.parse(sanitized);
        if (parsedSanitized && typeof parsedSanitized === 'object' && !Array.isArray(parsedSanitized)) {
          return parsedSanitized as Record<string, unknown>;
        }
      } catch {
        // structural validation failed completely
      }
    }
    return null;
  }

  // 1. Try parsing the raw string directly first (fastest path).
  const firstPass = tryParsingWithSanitization(trimmed);
  if (firstPass) return firstPass;

  // 2. Strip a single markdown code fence if present (handles ```json ... ``` wrappers).
  const withoutFence = trimmed
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const secondPass = tryParsingWithSanitization(withoutFence);
  if (secondPass) return secondPass;

  // 3. Extract the first {...} block from anywhere in the string.
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    const extracted = trimmed.slice(jsonStart, jsonEnd + 1);
    const thirdPass = tryParsingWithSanitization(extracted);
    if (thirdPass) return thirdPass;
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
