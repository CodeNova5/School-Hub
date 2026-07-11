/**
 * Audit UUID Resolver
 *
 * Maps foreign-key UUIDs found in audit log old_data / new_data to
 * human-readable names (e.g. class_id -> "JSS 1A", teacher_id -> "Mr. John Doe")
 * so that AI prompts and displayed descriptions are rich and meaningful.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Field-to-table mapping ──────────────────────────────────────────────

export interface TableRef {
  table: string;
  nameColumns: string[];
}

/** Maps _id field suffixes to their lookup tables and name columns. */
export const UUID_REFERENCE_MAP: Record<string, TableRef> = {
  class_teacher_id: { table: 'teachers', nameColumns: ['first_name', 'last_name'] },
  teacher_id:       { table: 'teachers', nameColumns: ['first_name', 'last_name'] },
  student_id:       { table: 'students', nameColumns: ['first_name', 'last_name'] },
  guardian_id:      { table: 'parents',  nameColumns: ['name'] },
  parent_id:        { table: 'parents',  nameColumns: ['name'] },
  marked_by:        { table: 'teachers', nameColumns: ['first_name', 'last_name'] },
  entered_by:       { table: 'teachers', nameColumns: ['first_name', 'last_name'] },
  graded_by:        { table: 'teachers', nameColumns: ['first_name', 'last_name'] },
  created_by:       { table: 'teachers', nameColumns: ['first_name', 'last_name'] },

  class_id:              { table: 'classes',                   nameColumns: ['name'] },
  subject_id:            { table: 'subjects',                  nameColumns: ['name'] },
  session_id:            { table: 'sessions',                  nameColumns: ['name'] },
  term_id:               { table: 'terms',                     nameColumns: ['name'] },
  class_level_id:        { table: 'school_class_levels',       nameColumns: ['name'] },
  education_level_id:    { table: 'school_education_levels',   nameColumns: ['name'] },
  stream_id:             { table: 'school_streams',            nameColumns: ['name'] },
  department_id:         { table: 'school_departments',        nameColumns: ['name'] },
  religion_id:           { table: 'school_religions',          nameColumns: ['name'] },
  subject_class_id:      { table: 'subject_classes',           nameColumns: ['id'] },
  prerequisite_subject_id: { table: 'subjects',                nameColumns: ['name'] },
  assignment_id:         { table: 'assignments',               nameColumns: ['title'] },
  bank_id:               { table: 'teacher_question_banks',    nameColumns: ['title'] },
  topic_set_id:          { table: 'teacher_question_topic_sets', nameColumns: ['name'] },
  source_question_id:    { table: 'teacher_questions',         nameColumns: ['id'] },

  school_id:             { table: 'schools',                   nameColumns: ['name'] },
};

// ─── Resolver ────────────────────────────────────────────────────────────

export interface ResolvedNameMap {
  [uuid: string]: string;
}

/**
 * Scan audit log old_data and new_data for UUID values, look them up in
 * their corresponding tables, and return a UUID -> name map.
 */
export async function resolveAuditLogUUIDs(
  supabase: SupabaseClient,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  schoolId?: string | null
): Promise<ResolvedNameMap> {
  // 1. Collect all UUID values along with their field name
  const uuidFields: { field: string; value: string }[] = [];

  const scan = (data: Record<string, unknown> | null) => {
    if (!data) return;
    for (const [key, value] of Object.entries(data)) {
      if (
        typeof value === 'string' &&
        value.length > 20 &&
        /^[0-9a-f-]{36}$/i.test(value)
      ) {
        uuidFields.push({ field: key, value });
      }
    }
  };

  scan(oldData);
  scan(newData);

  if (uuidFields.length === 0) return {};

  // 2. Group UUIDs by lookup table
  const tableGroups = new Map<string, { ref: TableRef; ids: string[] }>();

  for (const { field, value } of uuidFields) {
    const ref = UUID_REFERENCE_MAP[field] ?? findRefBySuffix(field);
    if (!ref) continue;

    const key = ref.table;
    if (!tableGroups.has(key)) {
      tableGroups.set(key, { ref, ids: [] });
    }
    const group = tableGroups.get(key)!;
    if (!group.ids.includes(value)) {
      group.ids.push(value);
    }
  }

  if (tableGroups.size === 0) return {};

  // 3. Batch query each table
  const result: ResolvedNameMap = {};

  for (const [, group] of tableGroups) {
    const { table, nameColumns } = group.ref;
    const ids = group.ids;

    // Skip tables that use 'id' as the name
    if (nameColumns.length === 1 && nameColumns[0] === 'id') continue;

    try {
      const selectFields = ['id', ...nameColumns].join(', ');

      let query = supabase
        .from(table)
        .select(selectFields)
        .in('id', ids);

      if (schoolId && table !== 'schools') {
        query = query.eq('school_id', schoolId);
      }

      const { data: rows, error } = await query;

      if (error) {
        console.warn(`[UUIDResolver] Failed to query ${table}: ${error.message}`);
        continue;
      }

      for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
        const name = formatName(row, nameColumns);
        const rowId = String(row.id ?? '');
        if (name && rowId) {
          result[rowId] = name;
        }
      }
    } catch (err) {
      console.warn(`[UUIDResolver] Error querying ${table}:`, err);
    }
  }

  return result;
}

/**
 * Replace UUIDs in a data record with their resolved names.
 * Returns a NEW object (does not mutate the original).
 */
export function applyResolvedNames(
  data: Record<string, unknown> | null,
  nameMap: ResolvedNameMap
): Record<string, unknown> | null {
  if (!data) return null;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && nameMap[value]) {
      result[key] = nameMap[value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Convenience: given audit log old_data + new_data, resolve UUIDs and
 * return copies with names substituted in place of UUIDs.
 */
export async function enrichAuditData(
  supabase: SupabaseClient,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  schoolId?: string | null
): Promise<{
  resolvedOldData: Record<string, unknown> | null;
  resolvedNewData: Record<string, unknown> | null;
  nameMap: ResolvedNameMap;
}> {
  const nameMap = await resolveAuditLogUUIDs(supabase, oldData, newData, schoolId);
  return {
    resolvedOldData: applyResolvedNames(oldData, nameMap),
    resolvedNewData: applyResolvedNames(newData, nameMap),
    nameMap,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatName(row: Record<string, unknown>, nameColumns: string[]): string {
  if (nameColumns.length === 1) {
    return String(row[nameColumns[0]] ?? '');
  }
  return nameColumns
    .map((col) => String(row[col] ?? ''))
    .filter(Boolean)
    .join(' ');
}

function findRefBySuffix(field: string): TableRef | undefined {
  for (const [suffix, ref] of Object.entries(UUID_REFERENCE_MAP)) {
    if (field.endsWith(suffix)) {
      return ref;
    }
  }
  return undefined;
}
