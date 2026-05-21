/**
 * AI Assistant API Route
 * Handles natural language questions about school data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateQueryPlan } from '@/lib/ai-assistant/query-planner';
import { executeQueryPlan } from '@/lib/ai-assistant/query-executor';
import { summarizeResults, generateSimpleSummary } from '@/lib/ai-assistant/result-summarizer';
import { getCachedQuery, setCachedQuery } from '@/lib/ai-assistant/query-cache';

export const dynamic = 'force-dynamic';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_GROQ_RETRY_AFTER_SECONDS = 60;

const groqKeyCooldowns = new Map<string, number>();
let groqKeyCursor = 0;

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  queryInfo?: any;
}

interface AskRequest {
  question: string;
  useCache?: boolean;
  sessionId?: string;
  context?: Message[];
  schoolId?: string;
}

interface GroqChatCompletionResult {
  ok: true;
  data: any;
}

interface GroqChatCompletionError {
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

  return Array.from(
    new Set([fromSingleKey, ...fromList, ...fromIndexedKeys].filter((key): key is string => Boolean(key)))
  );
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
    return errorBody?.error?.message || errorBody?.message || 'Failed to process question';
  } catch {
    try {
      const text = await response.text();
      return text || 'Failed to process question';
    } catch {
      return 'Failed to process question';
    }
  }
}

async function fetchGroqChatCompletion(
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
      return { ok: true, data };
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

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user's school_id from request (from client context) or fetch from DB
    // Parse request first
    const body: AskRequest = await request.json();
    const { question, useCache = true, sessionId, context = [] } = body;

    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Require `schoolId` in the request body — client must pass it
    const schoolId = body.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: 'schoolId is required in request body' },
        { status: 400 }
      );
    }

    const userRole = await getUserRole(supabase, userId);
    if (!userRole) {
      return NextResponse.json(
        { error: 'User role not found' },
        { status: 403 }
      );
    }

    // Get or create chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const { data: newSession, error: sessionError } = await supabase
        .rpc('get_or_create_chat_session', {
          p_user_id: userId,
          p_school_id: schoolId,
        });

      if (!sessionError && newSession) {
        currentSessionId = newSession;
      }
    }

    // Check cache first
    if (useCache) {
      const cachedResponse = getCachedQuery(question, schoolId, userId);
      if (cachedResponse) {
        const looksLikePermissionMessage =
          cachedResponse.toLowerCase().includes("don't have permission") ||
          cachedResponse.toLowerCase().includes('can only view your own');

        // Prevent stale false-denial cache hits for admin users.
        if (userRole === 'admin' && looksLikePermissionMessage) {
          // Continue and regenerate a fresh response.
        } else {
          return NextResponse.json({
            success: true,
            response: cachedResponse,
            cached: true,
          });
        }
      }
    }

    // Classify question and get response in single API call
    const classificationResult = await classifyAndRespond(question, context);

    if (classificationResult.error) {
      if (classificationResult.status === 429) {
        const retryAfterSeconds = classificationResult.retryAfterSeconds || DEFAULT_GROQ_RETRY_AFTER_SECONDS;

        return NextResponse.json(
          {
            error: classificationResult.error,
            success: false,
            retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(retryAfterSeconds),
            },
          }
        );
      }

      return NextResponse.json(
        {
          error: classificationResult.error,
          success: false
        },
        { status: 400 }
      );
    }

    // If not a data question, we have the direct response
    if (!classificationResult.isDataQuestion) {
      const responseText = classificationResult.response!;
      const generatedTitle = classificationResult.title || null;

      // Cache the response
      if (useCache) {
        setCachedQuery(question, schoolId, responseText, userId);
      }

      return NextResponse.json({
        success: true,
        response: responseText,
        cached: false,
        sessionId: currentSessionId,
        generatedTitle,
      });
    }

    // Generate query plan using AI for data questions
    const queryPlan = await generateQueryPlan(question, userRole, userId);

    if (queryPlan.error) {
      return NextResponse.json(
        {
          error: queryPlan.error,
          success: false
        },
        { status: 400 }
      );
    }

    // Log the generated query for debugging
    console.log('Generated query plan:', {
      question,
      query: queryPlan.query.substring(0, 200),
      tables: queryPlan.tables,
      explanation: queryPlan.explanation
    });

    // Normalize the query
    queryPlan.query = queryPlan.query.trim().replace(/;+\s*$/, '');

    // Execute query
    const queryResult = await executeQueryPlan(queryPlan, schoolId, userId);

    if (!queryResult.success) {
      const summaryResult = await summarizeResults(
        question,
        [],
        queryPlan.explanation,
        queryResult.error || 'Query execution failed.'
      );

      return NextResponse.json({
        success: true,
        response: summaryResult.summary || queryResult.error || 'Query execution failed.',
        queryPlan: {
          explanation: queryPlan.explanation,
          tables: queryPlan.tables,
        },
        resultCount: 0,
        errorCode: queryResult.errorCode,
        errorDetails: queryResult.errorDetails,
        errorHint: queryResult.errorHint,
        cached: false,
        sessionId: currentSessionId,
      });
    }

    // Generate natural language response
    let response: string;

    try {
      const summaryResult = await summarizeResults(
        question,
        queryResult.data || [],
        queryPlan.explanation
      );

      if (summaryResult.error) {
        // Fallback to simple summary if AI fails
        response = generateSimpleSummary(question, queryResult.data || []);
      } else {
        response = summaryResult.summary;
      }
    } catch (error) {
      // Fallback to simple summary
      response = generateSimpleSummary(question, queryResult.data || []);
    }

    // Cache the response
    if (useCache) {
      setCachedQuery(question, schoolId, response, userId);
    }

    // NOTE: Messages are saved by the client component via save-message endpoint
    // to avoid duplicate insertions and maintain single source of truth for persistence

    // Generate title from question for data questions
    const generatedTitle = classificationResult.title || null;

    return NextResponse.json({
      success: true,
      response,
      queryPlan: {
        explanation: queryPlan.explanation,
        tables: queryPlan.tables,
      },
      resultCount: queryResult.rowCount,
      cached: false,
      sessionId: currentSessionId,
      generatedTitle,
    });
  } catch (error) {
    console.error('AI Assistant error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false
      },
      { status: 500 }
    );
  }
}



/**
 * Get user's role
 */
async function getUserRole(
  supabase: any,
  userId: string
): Promise<'student' | 'teacher' | 'admin' | 'parent' | null> {
  try {
    // Check if admin
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (admin) return 'admin';

    // Check if teacher
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (teacher) return 'teacher';

    // Check if student
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (student) return 'student';

    // Check if parent
    const { data: parent } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (parent) return 'parent';

    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Classify question and respond in a single API call
 * Returns either the direct answer (for general questions) or a marker that it needs data processing
 * Always includes a title for the conversation
 */
async function classifyAndRespond(
  question: string,
  context: Message[] = []
): Promise<{ isDataQuestion: boolean; response?: string; title?: string; error?: string; status?: number; retryAfterSeconds?: number }> {
  const fallbackTitle = buildFallbackTitle(question);

  try {
    const result = await fetchGroqChatCompletion({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a classifier and AI assistant for a school management system.

Your task:
1. Determine if the question requires school database access (student records, grades, attendance, classes, teachers, schedules, results, marks, etc.)
2. Generate a short, clean title (2-4 words max) for the conversation

Title rules:
- Use a noun phrase, not a full sentence or question
- Avoid question marks, quotes, filler words, and punctuation
- Prefer concrete topic words from the question
- Keep it natural for a sidebar label

If the question REQUIRES database access:
- Set "isDataQuestion": true
- Set "response": "[[DATA_QUESTION]]"
- Generate and set a "title" based on the question

If it does NOT require database access:
- Set "isDataQuestion": false
- Provide a direct, concise answer to the question (2-3 paragraphs max)
- Set "response" to your answer
- Generate a "title" based on the question/answer

ALWAYS respond with valid JSON in this format ONLY:
{
  "isDataQuestion": boolean,
  "response": "string",
  "title": "3-4 word title"
}

No markdown formatting in the response field, just plain text.`,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    if (!result.ok) {
      return {
        isDataQuestion: false,
        error: result.error,
        status: result.status,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    }

    const data = result.data;
    const message = data.choices?.[0]?.message?.content?.trim();

    if (!message) {
      return { isDataQuestion: false, error: 'No response generated' };
    }

    // Parse JSON response
    let parsed;
    try {
      parsed = JSON.parse(message);
    } catch (e) {
      console.error('Failed to parse JSON response:', message);
      return { isDataQuestion: false, error: 'Failed to parse response format' };
    }

    const { isDataQuestion, response: responseText, title } = parsed;
    const safeTitle = sanitizeGeneratedTitle(title, fallbackTitle);

    if (isDataQuestion && responseText === '[[DATA_QUESTION]]') {
      return { isDataQuestion: true, title: safeTitle };
    }

    if (!isDataQuestion && responseText) {
      return { isDataQuestion: false, response: responseText, title: safeTitle };
    }

    return { isDataQuestion: false, error: 'Invalid response format' };
  } catch (error) {
    console.error('Error classifying question:', error);
    return { isDataQuestion: false, error: error instanceof Error ? error.message : 'Failed to process question' };
  }

}

function sanitizeGeneratedTitle(rawTitle: unknown, fallbackTitle: string): string {
  if (typeof rawTitle !== 'string') {
    return fallbackTitle;
  }

  const normalized = rawTitle
    .replace(/[\r\n]+/g, ' ')
    .replace(/["'`]/g, '')
    .replace(/[?.!,;:]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return fallbackTitle;
  }

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0) {
    return fallbackTitle;
  }

  const lowerFirstWord = words[0].toLowerCase();
  const questionStarters = new Set(['what', 'why', 'how', 'when', 'where', 'who', 'which', 'can', 'could', 'should', 'would', 'do', 'does', 'is', 'are']);
  if (questionStarters.has(lowerFirstWord) || normalized.includes('?')) {
    return fallbackTitle;
  }

  if (words.length > 4) {
    return fallbackTitle;
  }

  const cleanedWords = words.filter((word) => word.length > 1);
  if (cleanedWords.length === 0) {
    return fallbackTitle;
  }

  return cleanedWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function buildFallbackTitle(question: string): string {
  const cleaned = question
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'New Conversation';
  }

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length === 0) {
    return 'New Conversation';
  }

  const stopWords = new Set(['show', 'tell', 'give', 'me', 'the', 'a', 'an', 'please', 'can', 'you', 'could', 'would', 'should', 'how', 'what', 'why', 'when', 'where', 'who', 'which', 'is', 'are', 'am', 'do', 'does', 'did']);
  const topicWords = words.filter((word) => !stopWords.has(word.toLowerCase())).slice(0, 4);
  const sourceWords = topicWords.length > 0 ? topicWords : words.slice(0, 4);

  return sourceWords
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

