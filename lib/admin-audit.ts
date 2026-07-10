// ─── Types ────────────────────────────────────────────────────────────────

export type AuditOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface AdminAuditLogRecord {
  id: string;
  school_id: string;
  table_name: string;
  record_id: string;
  operation: AuditOperation;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_by_name: string | null;
  created_at: string;
  undone_at: string | null;
}

export interface AuditLogsResponse {
  logs: AdminAuditLogRecord[];
  total: number;
}

// ─── Table display labels ─────────────────────────────────────────────────

export const TABLE_LABELS: Record<string, string> = {
  students: 'Students',
  teachers: 'Teachers',
  classes: 'Classes',
  subjects: 'Subjects',
  subject_classes: 'Subject-Class Assignments',
  sessions: 'Sessions',
  terms: 'Terms',
  period_slots: 'Period Slots',
  timetable_entries: 'Timetable Entries',
  parents: 'Parents & Guardians',
  admins: 'Admin Accounts',
  school_education_levels: 'Education Levels',
  school_class_levels: 'Class Levels',
  school_streams: 'Streams',
  school_departments: 'Departments',
  school_religions: 'Religions',
  school_level_subject_presets: 'Subject Presets',
  student_guardian_links: 'Student-Guardian Links',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Human-readable label for the change type */
export function operationLabel(op: AuditOperation): string {
  switch (op) {
    case 'INSERT':
      return 'Created';
    case 'UPDATE':
      return 'Updated';
    case 'DELETE':
      return 'Deleted';
  }
}

/** Colour class for the operation badge */
export function operationColor(op: AuditOperation): string {
  switch (op) {
    case 'INSERT':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'UPDATE':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'DELETE':
      return 'bg-red-100 text-red-700 border-red-200';
  }
}

/**
 * Build a human-readable summary of what changed in an UPDATE.
 * Returns an array of { field, oldValue, newValue } tuples.
 */
export function getChangedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  excludeFields: string[] = ['updated_at', 'created_at', 'id', 'school_id']
): { field: string; oldValue: unknown; newValue: unknown }[] {
  if (!oldData || !newData) return [];

  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue;

    const oldVal = oldData[key];
    const newVal = newData[key];

    // Compare values (JSON.stringify for object comparison)
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

/**
 * Config tables — set-once school setup items with low audit value.
 * Can be excluded from views to reduce noise.
 */
export const CONFIG_TABLES = new Set([
  "school_education_levels",
  "school_class_levels",
  "school_streams",
  "school_departments",
  "school_religions",
  "school_level_subject_presets",
  "period_slots",
]);

/**
 * Format a timestamp to a human-readable date-time string.
 */
export function formatAuditTimestamp(value: string): string {
  const d = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
