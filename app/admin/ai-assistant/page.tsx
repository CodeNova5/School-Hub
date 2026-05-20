"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bot, Loader2, MessageSquarePlus, Send, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const STORAGE_KEY = 'admin-ai-assistant-session-id';

const suggestedPrompts = [
  'How many students are currently enrolled?',
  'Show me the latest attendance trend.',
  'Which classes need attention this week?',
  'Summarize recent academic performance.',
];

export default function AdminAIAssistantEntryPage() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState('New chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/admin/login');
          return;
        }

        const { data: userProfile } = await supabase
          .from('admins')
          .select('school_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!userProfile?.school_id) {
          if (isMounted) {
            setError('Unable to load your school profile.');
          }
          return;
        }

        if (!isMounted) return;

        setSchoolId(userProfile.school_id);

        const savedSessionId = localStorage.getItem(STORAGE_KEY);
        if (savedSessionId) {
          const response = await fetch(`/api/ai-assistant/history?sessionId=${savedSessionId}`);
          const data = await response.json();

          if (response.ok && data.success) {
            const restoredMessages = (data.messages || []).map((message: any) => ({
              id: message.id,
              role: message.role,
              content: message.content,
              timestamp: new Date(message.timestamp || Date.now()),
            }));

            if (isMounted) {
              setMessages(restoredMessages);
              setSessionId(savedSessionId);
              setConversationTitle(data.session?.title || 'New chat');
            }
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Error initializing AI assistant:', err);
        if (isMounted) {
          setError('Something went wrong while loading the assistant.');
        }
      } finally {
        if (isMounted) {
          setIsCheckingAccess(false);
        }
      }
    };

    initialize();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [input]);

  const persistMessage = async (
    activeSessionId: string,
    role: 'user' | 'assistant',
    content: string,
    queryPlan?: {
      explanation: string;
      tables: string[];
      resultCount?: number;
    }
  ) => {
    await fetch('/api/ai-assistant/save-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: activeSessionId,
        role,
        content,
        queryPlan,
      }),
    });
  };

  const handleSubmit = async (value?: string) => {
    const prompt = (value ?? input).trim();

    if (!prompt || isSending || !schoolId) {
      return;
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    setError(null);
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/ai-assistant/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: prompt,
          sessionId: sessionId || undefined,
          schoolId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate a response.');
      }

      const activeSessionId = data.sessionId || sessionId;

      if (!activeSessionId) {
        throw new Error('No chat session was created.');
      }

      if (!sessionId) {
        localStorage.setItem(STORAGE_KEY, activeSessionId);
      }

      setSessionId(activeSessionId);
      setConversationTitle(data.generatedTitle || conversationTitle || 'New chat');

      const assistantMessage: Message = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((current) => [...current, assistantMessage]);

      await persistMessage(activeSessionId, 'user', prompt);
      await persistMessage(activeSessionId, 'assistant', data.response, data.queryPlan);
    } catch (err) {
      console.error('Error sending AI prompt:', err);
      setError('The assistant could not reply just now. Please try again.');

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: 'assistant',
          content: 'Something went wrong while generating a reply.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionId(null);
    setConversationTitle('New chat');
    setMessages([]);
    setInput('');
    setError(null);
  };

  if (isCheckingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_36%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#111827_100%)]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-slate-100 backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin text-sky-400" />
          <span>Loading the assistant...</span>
        </div>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_36%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#111827_100%)] px-4">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/8 p-6 text-center text-slate-100 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <p className="text-lg font-semibold">Unable to open the assistant</p>
          <p className="mt-2 text-sm text-slate-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_36%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#111827_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-sky-300/80">Admin AI Assistant</p>
              <h1 className="text-lg font-semibold text-white">{conversationTitle}</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-400/40 hover:bg-sky-400/10"
          >
            <MessageSquarePlus className="h-4 w-4" />
            New chat
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-6">
          {messages.length === 0 ? (
            <section className="grid flex-1 place-items-center py-10">
              <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/6 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-10">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">
                  <Sparkles className="h-4 w-4" />
                  Ask anything about your school data
                </div>

                <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
                  Start with a question, not a blank chat.
                </h2>

                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  This assistant stays empty until you type. Your first prompt creates the conversation, and reloading will bring back the same chat instead of making a new one.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-left text-sm text-slate-200 transition hover:border-sky-400/30 hover:bg-sky-400/10"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <section className="flex-1 space-y-4 overflow-y-auto rounded-[2rem] border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur-xl sm:p-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20'
                        : 'border border-white/10 bg-slate-950/40 text-slate-100'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                    Thinking...
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="sticky bottom-0 pb-2 pt-4">
            <div className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:p-4">
              <div className="flex items-end gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about attendance, results, teachers, fees, or anything else..."
                  rows={1}
                  className="max-h-40 min-h-[52px] flex-1 resize-none border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                />

                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isSending || !schoolId}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white transition hover:shadow-lg hover:shadow-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <Sparkles className="h-3 w-3" />
                  Session starts only when you send a message
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Shift + Enter for a new line
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
