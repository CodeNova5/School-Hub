export type AuditAction =
  | 'bank_created'
  | 'bank_updated'
  | 'question_created'
  | 'question_updated'
  | 'question_deleted'
  | 'question_generated'
  | 'question_duplicated'
  | 'exam_printed'
  | 'exam_config_saved'
  | 'exam_config_loaded'
  | 'exam_config_deleted'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted';

type AuditDetails = Record<string, unknown>;

/**
 * Insert an audit log entry. This runs fire-and-forget (non-critical) so errors
 * are logged to console but not propagated to the caller.
 */
export async function insertAuditLog(
  supabase: any,
  bankId: string,
  schoolId: string,
  action: AuditAction,
  userId: string,
  actorRole: 'teacher' | 'admin',
  details: AuditDetails = {},
  actorName?: string | null
) {
  const { error } = await supabase.from('question_bank_audit_logs').insert({
    bank_id: bankId,
    school_id: schoolId,
    action,
    actor_id: userId,
    actor_role: actorRole,
    actor_name: actorName || null,
    details,
  });

  if (error) {
    console.error(`[AuditLog] Failed to insert ${action}:`, error.message);
  }
}
