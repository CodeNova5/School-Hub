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

  /**
   * Multi-stage JSON repair pipeline.
   * Chemistry content is notorious for breaking JSON because of:
   *  - Unescaped backslashes in chemical formulas (\text, \rightarrow, etc.)
   *  - Literal control characters (tabs, newlines) inside string values
   *  - Trailing commas before ] or }
   *  - Truncated JSON (missing closing brackets)
   */
  function repairJsonString(str: string): string {
    let s = str;

    // 1. Remove literal control characters inside JSON string values (except \n and \t which we convert)
    s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');

    // 2. Fix trailing commas before ] or } (common AI mistake)
    s = s.replace(/,\s*([\]\}])/g, '$1');

    // 3. Escape lone backslashes that aren't valid JSON escapes.
    //    Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
    //    Everything else (e.g. \text, \frac, \rightarrow, \delta) needs double-escaping.
    s = s.replace(/\\(?!["\\\//bfnrtu])/g, '\\\\');

    return s;
  }

  function tryParse(str: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }

  function tryParsingWithRepair(str: string): Record<string, unknown> | null {
    // Fast path: try as-is first
    const direct = tryParse(str);
    if (direct) return direct;

    // Repair pass
    const repaired = repairJsonString(str);
    const afterRepair = tryParse(repaired);
    if (afterRepair) return afterRepair;

    // Truncation recovery: if JSON ends abruptly (no closing }]),
    // try closing any open arrays and the root object.
    const truncationFixed = tryFixTruncatedJson(repaired);
    if (truncationFixed) {
      const afterTruncFix = tryParse(truncationFixed);
      if (afterTruncFix) return afterTruncFix;
    }

    return null;
  }

  /**
   * Attempts to close truncated JSON by balancing brackets.
   * This handles the case where max_tokens cuts the response mid-JSON.
   */
  function tryFixTruncatedJson(str: string): string | null {
    // Only attempt if it looks like it starts with { but doesn't end with }
    const t = str.trim();
    if (!t.startsWith('{')) return null;
    if (t.endsWith('}')) return null; // Already closed

    // Count unmatched brackets (outside of strings)
    let inString = false;
    let escaped = false;
    let openBraces = 0;
    let openBrackets = 0;
    let lastValidIndex = 0;

    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; lastValidIndex = i; continue; }
      if (inString) continue;
      if (ch === '{') { openBraces++; lastValidIndex = i; }
      else if (ch === '}') { openBraces--; lastValidIndex = i; }
      else if (ch === '[') { openBrackets++; lastValidIndex = i; }
      else if (ch === ']') { openBrackets--; lastValidIndex = i; }
    }

    if (openBraces <= 0 && openBrackets <= 0) return null;

    // If we're inside an unterminated string, close it
    let result = t;
    if (inString) {
      result += '"';
    }

    // Remove any trailing comma
    result = result.replace(/,\s*$/, '');

    // Close open brackets then braces
    for (let i = 0; i < openBrackets; i++) result += ']';
    for (let i = 0; i < openBraces; i++) result += '}';

    return result;
  }

  // 1. Try parsing the raw string directly first (fastest path).
  const firstPass = tryParsingWithRepair(trimmed);
  if (firstPass) return firstPass;

  // 2. Strip a single markdown code fence if present (handles ```json ... ``` wrappers).
  const withoutFence = trimmed
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const secondPass = tryParsingWithRepair(withoutFence);
  if (secondPass) return secondPass;

  // 3. Extract the first {...} block from anywhere in the string.
  const jsonStart = trimmed.indexOf('{');
  const jsonEnd = trimmed.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    const extracted = trimmed.slice(jsonStart, jsonEnd + 1);
    const thirdPass = tryParsingWithRepair(extracted);
    if (thirdPass) return thirdPass;
  }

  // 4. Last resort: try to find ANYTHING between the first { and the end, then repair + close
  if (jsonStart !== -1) {
    const fromStart = trimmed.slice(jsonStart);
    const lastResort = tryParsingWithRepair(fromStart);
    if (lastResort) return lastResort;
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
