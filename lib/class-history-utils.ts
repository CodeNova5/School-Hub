import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve the class a student belonged to during a specific session.
 *
 * Uses the `class_history` table to look up which class the student was
 * enrolled in for the given session.  Returns `null` when no record exists
 * (e.g. promotions have not been run yet for that session).
 *
 * Used by: ResultEntry (per-student class resolution on the report card view).
 */
export async function resolveStudentClassForSession(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    studentId: string;
    sessionId: string;
  },
): Promise<string | null> {
  const { schoolId, studentId, sessionId } = params;

  const { data } = await supabase
    .from("class_history")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("session_id", sessionId)
    .maybeSingle();

  return data?.class_id ?? null;
}

/**
 * Resolve the student IDs that were enrolled in a class during a specific session.
 *
 * Uses the `class_history` table.  Returns an empty array when no records
 * exist for the given class + session combination.
 *
 * The caller is responsible for deciding the fallback behaviour:
 * - Current session + no records → fall back to `students.class_id`
 * - Past session + no records    → return empty (no students to show)
 *
 * Used by: admin/reports (bulk student listing for a class in a given session).
 */
export async function resolveClassStudentsForSession(
  supabase: SupabaseClient,
  params: {
    schoolId: string;
    classId: string;
    sessionId: string;
  },
): Promise<string[]> {
  const { schoolId, classId, sessionId } = params;

  const { data: rows } = await supabase
    .from("class_history")
    .select("student_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .eq("session_id", sessionId);

  if (!rows || rows.length === 0) return [];

  return rows.map((r: { student_id: string }) => r.student_id);
}
