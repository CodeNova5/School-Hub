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
  error?: string;
  cached?: boolean;
}

/**
 * Build a human-readable prompt describing the audit log entry and send it to Groq.
 * Returns a plain-English explanation of what changed and why it matters.
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

  const { summary: fallbackSummary, hasData } = buildFallbackSummary(log);

  // If there's no actual change data, return the fallback immediately
  if (!hasData) {
    return { summary: fallbackSummary };
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
      temperature: 0.3,
      max_tokens: 300,
    });

    if (!result.ok) {
      console.error('[AuditAI] Groq API error:', result.error);
      return {
        summary: fallbackSummary,
        error:
          result.status === 429
            ? `Groq is rate limited. Retry in ${result.retryAfterSeconds || 60}s.`
            : 'Failed to generate AI summary',
      };
    }

    const data = result.data;
    const aiSummary = (data.choices?.[0]?.message?.content || '')?.trim();

    if (!aiSummary) {
      return { summary: fallbackSummary, error: 'No summary generated' };
    }

    return { summary: aiSummary };
  } catch (err) {
    console.error('[AuditAI] Error:', err);
    return {
      summary: fallbackSummary,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── Prompt builders ────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are an audit log analyst for a school management system. Your job is to explain data changes in clear, plain English.

**Rules:**
- Be concise — 1–3 short sentences max.
- Use natural language. Never mention "JSON", "database", "row", "diff", or technical terms.
- Highlight what actually changed and why it matters.
- If a student/teacher name changed, say "renamed from X to Y".
- If a contact detail changed (email, phone), mention the old and new values.
- If a status or boolean flag was toggled (active/inactive), explain the impact.
- For DELETE operations, state what was removed and key identifiers.
- For INSERT operations, describe what was created with key details.
- Never invent data that wasn't provided.`;
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
      const snapshot = keys.slice(0, 8).reduce(
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
      const snapshot = keys.slice(0, 8).reduce(
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

  return `Explain this change in plain English:

Table: ${tableLabel}
Operation: ${log.operation}
Changed by: ${actor}

Change data:
${details}`;
}

// ─── Fallback (non-AI) summary ──────────────────────────────────────────

function buildFallbackSummary(log: AdminAuditLogRecord): {
  summary: string;
  hasData: boolean;
} {
  const tableLabel = TABLE_LABELS[log.table_name] || log.table_name.replace(/_/g, ' ');
  const actor = log.changed_by_name || 'Unknown admin';

  switch (log.operation) {
    case 'INSERT':
      return {
        summary: `${actor} added a new ${tableLabel.toLocaleLowerCase()} record.`,
        hasData: !!log.new_data && Object.keys(log.new_data).length > 2,
      };
    case 'UPDATE': {
      const changes = getChangedFields(log.old_data, log.new_data);
      if (changes.length === 0) {
        return {
          summary: `${actor} updated a ${tableLabel.toLocaleLowerCase()} record.`,
          hasData: false,
        };
      }
      const fieldNames = changes.slice(0, 3).map((c) => c.field.replace(/_/g, ' '));
      const summary = `${actor} changed ${fieldNames.join(', ')}${changes.length > 3 ? ` and ${changes.length - 3} other fields` : ''} on a ${tableLabel.toLocaleLowerCase()} record.`;
      return { summary, hasData: true };
    }
    case 'DELETE':
      return {
        summary: `${actor} deleted a ${tableLabel.toLocaleLowerCase()} record.`,
        hasData: !!log.old_data && Object.keys(log.old_data).length > 2,
      };
    default:
      return {
        summary: `${actor} performed an action on a ${tableLabel.toLocaleLowerCase()} record.`,
        hasData: false,
      };
  }
}
