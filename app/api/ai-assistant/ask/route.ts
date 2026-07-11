/**
 * AI Assistant API Route
 * Handles natural language questions about school data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { generateQueryPlan } from '@/lib/ai-assistant/query-planner';
import { executeQueryPlan } from '@/lib/ai-assistant/query-executor';
import { summarizeResults, generateSimpleSummary } from '@/lib/ai-assistant/result-summarizer';
import { getCachedQuery, setCachedQuery } from '@/lib/ai-assistant/query-cache';
import { errorResponse, getAiAssistantContext } from '@/lib/api-helpers';
import {
  AIAssistantRole,
  estimateChatContextTokens,
  formatAIAssistantUsageSummary,
  getAIAssistantDailyTokenLimit,
  getSecondsUntilUtcMidnight,
  getUtcDateKey,
} from '@/lib/ai-assistant/usage';
import { fetchGroqChatCompletion, DEFAULT_GROQ_RETRY_AFTER_SECONDS } from '@/lib/ai-assistant/groq-client';

export const dynamic = 'force-dynamic';

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
const GROQ_MODEL = 'openai/gpt-oss-20b';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

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

    const contextInfo = await getAiAssistantContext();
    if (!contextInfo.authorized || !contextInfo.role || !contextInfo.schoolId) {
      return errorResponse(contextInfo.error || 'Forbidden', contextInfo.status || 403);
    }

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

    const schoolId = contextInfo.schoolId;
    const userRole = contextInfo.role as AIAssistantRole;

    if (body.schoolId && body.schoolId !== schoolId) {
      return NextResponse.json(
        { error: 'schoolId does not match the authenticated user' },
        { status: 403 }
      );
    }

    // Get or create chat session
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const createSessionResponse = await supabase.rpc('create_chat_session', {
        p_user_id: userId,
        p_school_id: schoolId,
      });

      if (!createSessionResponse.error && createSessionResponse.data) {
        currentSessionId = createSessionResponse.data;
      } else {
        const fallbackSessionResponse = await supabase.rpc('get_or_create_chat_session', {
          p_user_id: userId,
          p_school_id: schoolId,
        });

        if (!fallbackSessionResponse.error && fallbackSessionResponse.data) {
          currentSessionId = fallbackSessionResponse.data;
        }
      }
    }

    const usageDate = getUtcDateKey();
    const quotaLimit = getAIAssistantDailyTokenLimit(userRole);
    const estimatedTokens = estimateChatContextTokens(question, context);

    const { data: usageData, error: usageError } = await supabase.rpc('get_ai_assistant_usage_summary', {
      p_user_id: userId,
      p_school_id: schoolId,
      p_role: userRole,
      p_usage_date: usageDate,
    });

    if (usageError) {
      console.error('Error loading AI usage summary:', usageError);
      return NextResponse.json({ error: 'Failed to load usage summary' }, { status: 500 });
    }

    const usageSummary = formatAIAssistantUsageSummary({
      usageDate,
      tokensUsed: Number((usageData as Record<string, unknown> | null)?.tokensUsed ?? 0),
      quotaLimit: Number((usageData as Record<string, unknown> | null)?.quotaLimit ?? quotaLimit),
      role: userRole,
      schoolId,
      userId,
    });

    if (usageSummary.remainingTokens < estimatedTokens) {
      const retryAfterSeconds = getSecondsUntilUtcMidnight();
      return NextResponse.json(
        {
          error: 'Daily AI token limit reached',
          success: false,
          usage: usageSummary,
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
            usage: usageSummary,
          });
        }
      }
    }

    // Classify question and get response in single API call
    const classificationResult = await classifyAndRespond(question, context);

    // Aggregate provider-reported usage across the request lifecycle
    const providerTotals: Record<string, { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }> = {};
    function mergeUsage(source?: Record<string, { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }>) {
      if (!source) return;
      for (const [provider, vals] of Object.entries(source)) {
        const existing = providerTotals[provider] || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        providerTotals[provider] = {
          prompt_tokens: (existing.prompt_tokens || 0) + (vals.prompt_tokens || 0),
          completion_tokens: (existing.completion_tokens || 0) + (vals.completion_tokens || 0),
          total_tokens: (existing.total_tokens || 0) + (vals.total_tokens || 0),
        };
      }
    }

    // Merge classification usage if present
    mergeUsage((classificationResult as any).usage);

    if (classificationResult.error) {
      if (classificationResult.status === 429) {
        const retryAfterSeconds = classificationResult.retryAfterSeconds || DEFAULT_GROQ_RETRY_AFTER_SECONDS;

        return NextResponse.json(
          {
            error: classificationResult.error,
            success: false,
            usage: usageSummary,
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

      const finalUsage = await recordAIAssistantUsageDelta(supabase, {
        userId,
        schoolId,
        role: userRole,
        usageDate,
        tokensDelta: estimatedTokens,
        quotaLimit,
      }, providerTotals);

      if ((finalUsage as any)?.quotaExceeded) {
        const retryAfterSeconds = getSecondsUntilUtcMidnight();
        return NextResponse.json(
          { error: 'Daily AI token limit reached', success: false, usage: (finalUsage as any).usage, retryAfterSeconds },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
        );
      }

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
        usage: finalUsage,
      });
    }

    // Generate query plan using AI for data questions
    const queryPlan = await generateQueryPlan(question, userRole, userId);
    // Merge any usage produced by query planning
    mergeUsage((queryPlan as any).usage);

    if (queryPlan.error) {
      return NextResponse.json(
        {
          error: queryPlan.error,
          success: false,
          usage: usageSummary,
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

      // Merge summarization usage
      mergeUsage((summaryResult as any).usage);

      const finalUsage = await recordAIAssistantUsageDelta(supabase, {
        userId,
        schoolId,
        role: userRole,
        usageDate,
        tokensDelta: estimatedTokens,
        quotaLimit,
      }, providerTotals);

      if ((finalUsage as any)?.quotaExceeded) {
        const retryAfterSeconds = getSecondsUntilUtcMidnight();
        return NextResponse.json(
          { error: 'Daily AI token limit reached', success: false, usage: (finalUsage as any).usage, retryAfterSeconds },
          { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
        );
      }

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
        usage: finalUsage,
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

      // Merge summarization usage
      mergeUsage((summaryResult as any).usage);

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

    const finalUsage = await recordAIAssistantUsageDelta(supabase, {
      userId,
      schoolId,
      role: userRole,
      usageDate,
      tokensDelta: estimatedTokens,
      quotaLimit,
    }, providerTotals);

    if ((finalUsage as any)?.quotaExceeded) {
      const retryAfterSeconds = getSecondsUntilUtcMidnight();
      return NextResponse.json(
        { error: 'Daily AI token limit reached', success: false, usage: (finalUsage as any).usage, retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
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
      usage: finalUsage,
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
async function recordAIAssistantUsageDelta(
  supabase: any,
  params: {
    userId: string;
    schoolId: string;
    role: 'student' | 'teacher' | 'admin' | 'parent';
    usageDate: string;
    tokensDelta: number;
    quotaLimit: number;
  }
  , providerTotals?: Record<string, { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }>
) {
  // Prefer commit_ai_assistant_usage which accepts provider totals
  const rpcParams: Record<string, unknown> = {
    p_user_id: params.userId,
    p_school_id: params.schoolId,
    p_role: params.role,
    p_provider_totals: providerTotals ?? null,
    p_tokens_delta: params.tokensDelta,
    p_quota_limit: params.quotaLimit,
    p_usage_date: params.usageDate,
  };

  const { data, error } = await supabase.rpc('commit_ai_assistant_usage', rpcParams);

  if (error) {
    console.error('Error committing AI usage:', error);

    // Detect quota-exceeded error (using our RPC's P0001)
    if (String(error?.code) === 'P0001' || String(error?.message || '').toLowerCase().includes('quota exceeded')) {
      // Return structured indicator so caller can return 429
      const fallback = formatAIAssistantUsageSummary({
        usageDate: params.usageDate,
        tokensUsed: params.tokensDelta,
        quotaLimit: params.quotaLimit,
        role: params.role,
        schoolId: params.schoolId,
        userId: params.userId,
      });
      return { quotaExceeded: true, usage: fallback } as any;
    }

    return formatAIAssistantUsageSummary({
      usageDate: params.usageDate,
      tokensUsed: params.tokensDelta,
      quotaLimit: params.quotaLimit,
      role: params.role,
      schoolId: params.schoolId,
      userId: params.userId,
    });
  }

  const summary = data as Record<string, unknown> | null;
  return formatAIAssistantUsageSummary({
    usageDate: String(summary?.usageDate || params.usageDate),
    tokensUsed: Number(summary?.tokensUsed ?? params.tokensDelta),
    quotaLimit: Number(summary?.quotaLimit ?? params.quotaLimit),
    role: params.role,
    schoolId: params.schoolId,
    userId: params.userId,
  });
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
    const resultUsage = (result as any).usage;

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
      return { isDataQuestion: true, title: safeTitle, usage: resultUsage } as any;
    }

    if (!isDataQuestion && responseText) {
      return { isDataQuestion: false, response: responseText, title: safeTitle, usage: resultUsage } as any;
    }

    return { isDataQuestion: false, error: 'Invalid response format', usage: resultUsage } as any;
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

