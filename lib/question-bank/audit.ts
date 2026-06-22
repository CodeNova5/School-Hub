import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
 * Insert an audit log entry using the service role client to bypass RLS.
 * This is called from within API route handlers after an action completes.
 */
export async function insertAuditLog(
  supabase: any,
  bankId: string,
  schoolId: string,
  action: AuditAction,
  userId: string,
  actorRole: 'teacher' | 'admin',
  details: AuditDetails = {}
) {
  const { error } = await supabase.from('question_bank_audit_logs').insert({
    bank_id: bankId,
    school_id: schoolId,
    action,
    actor_id: userId,
    actor_role: actorRole,
    details,
  });

  if (error) {
    console.error(`[AuditLog] Failed to insert ${action}:`, error.message);
  }
}

/**
 * Create an audit log entry directly from a route handler context.
 */
export function createAuditLogger(supabase: any, schoolId: string) {
  return {
    log: async (
      bankId: string,
      action: AuditAction,
      userId: string,
      actorRole: 'teacher' | 'admin',
      details: AuditDetails = {}
    ) => {
      await insertAuditLog(supabase, bankId, schoolId, action, userId, actorRole, details);
    },
  };
}
