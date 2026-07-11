/**
 * Audit AI Summarizer
 * Uses the existing Groq AI client to generate natural language explanations
 * of what changed in an audit log entry.
 */

import { fetchGroqChatCompletion } from './ai-assistant/groq-client';
import { getChangedFields, TABLE_LABELS, type AdminAuditLogRecord } from './admin-audit';

const GROQ_MODEL = 'openai/gpt-oss-20b';

export interface AuditAISummaryResult {
  summary: string;
  undo_description?: string;
  error?: string;
  cached?: boolean;
}

/**
 * Build a human-readable prompt describing the audit log entry and send it to Groq.
 * Returns a plain-English explanation of what changed, plus an undo description.
 */
export async function generateAuditAISummary(
  log: AdminAuditLogRecord
): Promise<AuditAISummaryResult> {
  // Check if Groq is configured at all
  if (!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEYS) {
    return {
      summary: '',
      error: 'Groq API key not configured. Set GROQ_API_KEY in your environment.',
    };
  }

  const { summary: fallbackSummary, undoDescription: fallbackUndo, hasData } = buildFallbackSummary(log);

  // If there's no actual change data, return the fallback immediately
  if (!hasData) {
    return { summary: fallbackSummary, undo_description: fallbackUndo };
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(log);

  try {
    const result = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    });

    if (!result.ok) {
      console.error('[AuditAI] Groq API error:', result.error);
      return {
        summary: fallbackSummary,
        undo_description: fallbackUndo,
        error:
          result.status === 429
            ? `Groq is rate limited. Retry in ${result.retryAfterSeconds || 60}s.`
            : 'Failed to generate AI summary',
      };
    }

    const data = result.data;
    const rawContent = (data.choices?.[0]?.message?.content || '')?.trim();

    if (!rawContent) {
      return { summary: fallbackSummary, undo_description: fallbackUndo, error: 'No summary generated' };
    }

    // Try to parse as JSON for structured response
    try {
      const parsed = JSON.parse(rawContent);
      return {
        summary: parsed.summary || fallbackSummary,
        undo_description: parsed.undo_description || fallbackUndo,
      };
    } catch {
      // Plain text response — treat entire output as summary
      return { summary: rawContent, undo_description: fallbackUndo };
    }
  } catch (err) {
    console.error('[AuditAI] Error:', err);
    return {
      summary: fallbackSummary,
      undo_description: fallbackUndo,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Prompt builders ────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an audit log analyst for a school management system. Your job is to explain data changes in clear, plain English.

You MUST respond in valid JSON with exactly these fields:
{
  "summary": "A concise 1-3 sentence description of what changed.",
  "undo_description": "A 1-2 sentence description of what undoing this action will do."
}

**Rules:**
- Be concise — 1–3 short sentences for summary, 1-2 for undo_description.
- Use natural language. Never mention "JSON", "database", "row", "diff", or technical terms.
- Infer the real-world meaning from field names. For example:
  - "class_id" change from one UUID to another → "Moved student to a different class"
  - "first_name" or "last_name" change → "Renamed student from X to Y"
  - "email" change → "Updated email from old@email.com to new@email.com"
  - "status" or "is_active" change → "Activated/Deactivated the account"
  - "phone" change → "Updated phone number"
  - "class_teacher_id" change → "Assigned a new class teacher"
- For DELETE operations, state what was removed and provide identifying info (name, email, student_id).
- For INSERT operations, describe what was created with key details like name, class, etc.
- Use the actual values from the data — if a field has a UUID, say "changed the class" or "changed the teacher" rather than showing the UUID.
- Never invent data that wasn't provided.

**Undo description examples:**
- For moving a student: "This will move the student back to their previous class and restore their old subject assignments."
- For updating a teacher: "This will restore the teacher's previous name, contact details, and status."
- For creating a record: "This will permanently delete the newly created record and all associated data."
- For deleting a record: "This will restore the deleted record with all its previous data."`;
}

function buildUserPrompt(log: AdminAuditLogRecord): string {
  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name.replace(/_/g, ' ');
  const actor = log.changed_by_name || 'an admin';

  let details = '';

  switch (log.operation) {
    case 'INSERT': {
      const newData = log.new_data || {};
      const keys = Object.keys(newData).filter(
        (k) => !['id', 'school_id', 'created_at', 'updated_at', 'user_id'].includes(k)
      );
      const snapshot = keys.slice(0, 10).reduce(
        (acc, k) => {
          (acc as any)[k] = newData[k];
          return acc;
        },
        {} as Record<string, unknown>
      );
      details = JSON.stringify(snapshot, null, 2);
      break;
    }
    case 'UPDATE': {
      const changes = getChangedFields(log.old_data, log.new_data);
      if (changes.length === 0) {
        details = 'No meaningful changes detected.';
      } else {
        const changeSummary = changes.slice(0, 10).map(
          (c) => `Field "${c.field}": "${c.oldValue}" → "${c.newValue}"`
        );
        details = changeSummary.join('\n');
      }
      break;
    }
    case 'DELETE': {
      const oldData = log.old_data || {};
      const keys = Object.keys(oldData).filter(
        (k) => !['id', 'school_id', 'created_at', 'updated_at', 'user_id'].includes(k)
      );
      const snapshot = keys.slice(0, 10).reduce(
        (acc, k) => {
          (acc as any)[k] = oldData[k];
          return acc;
        },
        {} as Record<string, unknown>
      );
      details = JSON.stringify(snapshot, null, 2);
      break;
    }
  }

  return `Generate a JSON explanation for this change:

Table: ${tableLabel}
Operation: ${log.operation}
Changed by: ${actor}

Change data:
${details}

Respond with JSON: { "summary": "...", "undo_description": "..." }`;
}

// ─── Fallback (non-AI) summary ──────────────────────────────────────────

function buildFallbackSummary(log: AdminAuditLogRecord): {
  summary: string;
  undoDescription: string;
  hasData: boolean;
} {
  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name.replace(/_/g, ' ');
  const lowerLabel = tableLabel.toLocaleLowerCase();
  const actor = log.changed_by_name || 'Unknown admin';

  const summaryBase = (s: string) => `${actor} ${s}`;

  switch (log.operation) {
    case 'INSERT': {
      return {
        summary: summaryBase(`added a new ${lowerLabel} record.`),
        undoDescription: `Undoing this will permanently delete the newly created ${lowerLabel} record and all its associated data.`,
        hasData: !!log.new_data && Object.keys(log.new_data).length > 2,
      };
    }
    case 'UPDATE': {
      const changes = getChangedFields(log.old_data, log.new_data);
      if (changes.length === 0) {
        return {
          summary: summaryBase(`updated a ${lowerLabel} record.`),
          undoDescription: `Undoing this will restore the ${lowerLabel} record to its previous values.`,
          hasData: false,
        };
      }
      const fieldNames = changes.slice(0, 3).map((c) => c.field.replace(/_/g, ' '));
      const summary = summaryBase(`changed ${fieldNames.join(', ')}${changes.length > 3 ? ` and ${changes.length - 3} other fields` : ''} on a ${lowerLabel} record.`);
      return {
        summary,
        undoDescription: `Undoing this will restore the ${lowerLabel} record's ${fieldNames.join(', ')}${changes.length > 3 ? ` and ${changes.length - 3} other fields` : ''} to their previous values.`,
        hasData: true,
      };
    }
    case 'DELETE':
      return {
        summary: summaryBase(`deleted a ${lowerLabel} record.`),
        undoDescription: `Undoing this will restore the deleted ${lowerLabel} record with all its previous data.`,
        hasData: !!log.old_data && Object.keys(log.old_data).length > 2,
      };
    default:
      return {
        summary: summaryBase(`performed an action on a ${lowerLabel} record.`),
        undoDescription: `Undoing this will reverse the action on the ${lowerLabel} record.`,
        hasData: false,
      };
  }
}
