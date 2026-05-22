export type AIAssistantRole = 'student' | 'teacher' | 'parent' | 'admin';

export interface AIAssistantUsageSummary {
  usageDate: string;
  tokensUsed: number;
  quotaLimit: number;
  remainingTokens: number;
  resetAt: string;
  role: AIAssistantRole;
  schoolId?: string;
  userId?: string;
}

export const AI_ASSISTANT_DAILY_TOKEN_LIMITS: Record<AIAssistantRole, number> = {
  student: 5000,
  teacher: 20000,
  parent: 5000,
  admin: 50000,
};

export function getAIAssistantDailyTokenLimit(role: AIAssistantRole): number {
  return AI_ASSISTANT_DAILY_TOKEN_LIMITS[role] ?? AI_ASSISTANT_DAILY_TOKEN_LIMITS.student;
}

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getUtcMidnightResetAt(date = new Date()): string {
  const nextMidnight = new Date(date);
  nextMidnight.setUTCHours(24, 0, 0, 0);
  return nextMidnight.toISOString();
}

export function getSecondsUntilUtcMidnight(date = new Date()): number {
  const resetAt = new Date(getUtcMidnightResetAt(date)).getTime();
  return Math.max(1, Math.ceil((resetAt - date.getTime()) / 1000));
}

export function estimateTokensFromText(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 4));
}

export function estimateChatContextTokens(
  question: string,
  context: Array<{ content?: string }> = []
): number {
  const contextTokens = context.reduce((total, message) => {
    return total + estimateTokensFromText(message.content || '');
  }, 0);

  const questionTokens = estimateTokensFromText(question);

  // Reserve a conservative buffer because the route fans out into several Groq calls.
  return Math.max(600, questionTokens + contextTokens + 900);
}

export function formatAIAssistantUsageSummary(summary: {
  usageDate: string;
  tokensUsed: number;
  quotaLimit: number;
  role: AIAssistantRole;
  schoolId?: string;
  userId?: string;
}): AIAssistantUsageSummary {
  return {
    ...summary,
    remainingTokens: Math.max(summary.quotaLimit - summary.tokensUsed, 0),
    resetAt: getUtcMidnightResetAt(new Date(`${summary.usageDate}T00:00:00.000Z`)),
  };
}
