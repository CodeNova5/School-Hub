const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const DEFAULT_GROQ_RETRY_AFTER_SECONDS = 60;

const groqKeyCooldowns = new Map<string, number>();
let groqKeyCursor = 0;

export interface GroqChatCompletionResult {
  ok: true;
  data: any;
  usage?: Record<string, { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }>;
}

export interface GroqChatCompletionError {
  ok: false;
  error: string;
  status?: number;
  retryAfterSeconds?: number;
}

function getGroqApiKeys(): string[] {
  const fromSingleKey = process.env.GROQ_API_KEY?.trim();
  const fromList = (process.env.GROQ_API_KEYS || '')
    .split(/[\n,]/)
    .map((key) => key.trim())
    .filter((key): key is string => Boolean(key));

  const fromIndexedKeys = Object.entries(process.env)
    .filter(([name, value]) => /^GROQ_API_KEY_\d+$/.test(name) && value?.trim())
    .sort(([a], [b]) => {
      const aIndex = Number.parseInt(a.split('_').pop() || '0', 10);
      const bIndex = Number.parseInt(b.split('_').pop() || '0', 10);
      return aIndex - bIndex;
    })
    .map(([, value]) => value!.trim());

  return Array.from(new Set([fromSingleKey, ...fromList, ...fromIndexedKeys].filter((key): key is string => Boolean(key))));
}

function getRetryAfterSeconds(response: Response): number {
  const headerValue = response.headers.get('retry-after');
  if (!headerValue) {
    return DEFAULT_GROQ_RETRY_AFTER_SECONDS;
  }

  const parsedSeconds = Number.parseInt(headerValue, 10);
  if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0) {
    return parsedSeconds;
  }

  const parsedDate = Date.parse(headerValue);
  if (!Number.isNaN(parsedDate)) {
    const remainingSeconds = Math.ceil((parsedDate - Date.now()) / 1000);
    if (remainingSeconds > 0) {
      return remainingSeconds;
    }
  }

  return DEFAULT_GROQ_RETRY_AFTER_SECONDS;
}

function markGroqKeyCooldown(apiKey: string, retryAfterSeconds: number): void {
  groqKeyCooldowns.set(apiKey, Date.now() + retryAfterSeconds * 1000);
}

function getNextAvailableGroqKeyIndex(apiKeys: string[]): number {
  const now = Date.now();

  for (let offset = 0; offset < apiKeys.length; offset++) {
    const index = (groqKeyCursor + offset) % apiKeys.length;
    const cooldownUntil = groqKeyCooldowns.get(apiKeys[index]) || 0;

    if (cooldownUntil <= now) {
      groqKeyCursor = (index + 1) % apiKeys.length;
      return index;
    }
  }

  return -1;
}

function getSoonestGroqRetryAfterSeconds(apiKeys: string[]): number {
  const now = Date.now();
  let soonestRemainingMs = Number.POSITIVE_INFINITY;

  for (const apiKey of apiKeys) {
    const cooldownUntil = groqKeyCooldowns.get(apiKey);
    if (!cooldownUntil) {
      return 0;
    }

    const remainingMs = cooldownUntil - now;
    if (remainingMs <= 0) {
      return 0;
    }

    soonestRemainingMs = Math.min(soonestRemainingMs, remainingMs);
  }

  if (!Number.isFinite(soonestRemainingMs)) {
    return 0;
  }

  return Math.max(1, Math.ceil(soonestRemainingMs / 1000));
}

async function readGroqErrorMessage(response: Response): Promise<string> {
  try {
    const errorBody = await response.json();
    return errorBody?.error?.message || errorBody?.message || 'Failed to process request';
  } catch {
    try {
      const text = await response.text();
      return text || 'Failed to process request';
    } catch {
      return 'Failed to process request';
    }
  }
}

export async function fetchGroqChatCompletion(
  body: Record<string, unknown>
): Promise<GroqChatCompletionResult | GroqChatCompletionError> {
  const apiKeys = getGroqApiKeys();

  if (apiKeys.length === 0) {
    return {
      ok: false,
      error: 'GROQ_API_KEY is not configured',
      status: 500,
    };
  }

  const triedKeys = new Set<string>();

  while (triedKeys.size < apiKeys.length) {
    const keyIndex = getNextAvailableGroqKeyIndex(apiKeys);

    if (keyIndex === -1) {
      return {
        ok: false,
        error: 'Groq is rate limited across all available keys',
        status: 429,
        retryAfterSeconds: getSoonestGroqRetryAfterSeconds(apiKeys) || DEFAULT_GROQ_RETRY_AFTER_SECONDS,
      };
    }

    const apiKey = apiKeys[keyIndex];
    triedKeys.add(apiKey);

    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();

      // Parse provider-reported usage if present (OpenAI-style `usage` in body)
      const groqUsageRaw = data?.usage;
      const groqUsage = groqUsageRaw
        ? {
            prompt_tokens: Number(groqUsageRaw.prompt_tokens || 0),
            completion_tokens: Number(groqUsageRaw.completion_tokens || 0),
            total_tokens: Number(groqUsageRaw.total_tokens || 0),
          }
        : undefined;

      return { ok: true, data, usage: groqUsage ? { groq: groqUsage } : undefined };
    }

    if (response.status === 429) {
      const retryAfterSeconds = getRetryAfterSeconds(response);
      markGroqKeyCooldown(apiKey, retryAfterSeconds);
      continue;
    }

    return {
      ok: false,
      error: await readGroqErrorMessage(response),
      status: response.status,
    };
  }

  return {
    ok: false,
    error: 'Groq is temporarily unavailable',
    status: 429,
    retryAfterSeconds: getSoonestGroqRetryAfterSeconds(apiKeys) || DEFAULT_GROQ_RETRY_AFTER_SECONDS,
  };
}