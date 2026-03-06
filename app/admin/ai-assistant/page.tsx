"use client";

/**
 * Admin AI Assistant Page with Chat History
 * Provides AI-powered data insights with session-based chat memory
 */

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Loader2, Plus, MessageSquare, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  queryInfo?: {
    explanation: string;
    tables: string[];
    resultCount?: number;
  };
  error?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function AdminAIAssistantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let retryTimeoutId: NodeJS.Timeout | null = null;

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session) {
          router.push('/admin/login');
          return;
        }
        
        // Load existing sessions from database
        const { data: dbSessions, error } = await supabase
          .from('ai_chat_sessions')
          .select('id, title, created_at, updated_at, deleted_at')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!isMounted) return;

        if (!error && dbSessions && dbSessions.length > 0) {
          const formattedSessions = dbSessions.map((s: any) => ({
            id: s.id,
            title: s.title || 'Untitled Conversation',
            createdAt: new Date(s.created_at),
            updatedAt: new Date(s.updated_at),
          }));
          setSessions(formattedSessions);
          setCurrentSessionId(formattedSessions[0].id);
        } else {
          // No sessions exist, start with empty state and let user create first chat
          setSessions([]);
          setCurrentSessionId('');
        }
        
        setIsLoading(false);
      } catch (error: any) {
        console.error('Error checking session:', error);
        
        if (!isMounted) return;
        
        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) {
          router.push('/admin/login');
          return;
        }

        // Retry once with exponential backoff for network errors
        retryTimeoutId = setTimeout(() => {
          if (isMounted) {
            checkSession();
          }
        }, 1000);
      }
    }

    checkSession();

    return () => {
      isMounted = false;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [router]);

  const handleNewChat = useCallback(async () => {
    if (isCreatingSession) return; // Prevent duplicate creation

    setIsCreatingSession(true);
    setCurrentSessionId(''); // Unmount old chat to prevent stale updates
    
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // Get user's school_id
      const { data: userProfile } = await supabase
        .from('admins')
        .select('school_id')
        .eq('user_id', session.user.id)
        .single();

      if (!userProfile) return;

      // Create new session in database
      const { data: newSession, error } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: session.user.id,
          school_id: userProfile.school_id,
          title: 'New Conversation',
        })
        .select()
        .single();

      if (!error && newSession) {
        const sessionData: ChatSession = {
          id: newSession.id,
          title: newSession.title,
          createdAt: new Date(newSession.created_at),
          updatedAt: new Date(newSession.updated_at),
        };

        setSessions((prev) => [sessionData, ...prev]);
        setCurrentSessionId(newSession.id);
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsCreatingSession(false);
    }
  }, [isCreatingSession]);

  const handleMessagesUpdate = useCallback((newMessages: Message[]) => {
    // Only update title once - if current session has default title and there's a first user message
    setSessions((prevSessions) => {
      const currentSession = prevSessions.find((s) => s.id === currentSessionId);
      if (!currentSession || currentSession.title !== 'New Conversation') {
        return prevSessions; // No need to update
      }

      const firstUserMessage = newMessages.find((m) => m.role === 'user');
      if (!firstUserMessage || !currentSessionId) {
        return prevSessions;
      }

      const newTitle = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');

      // Update session in database with new title (fire and forget)
      (async () => {
        try {
          await supabase
            .from('ai_chat_sessions')
            .update({
              title: newTitle,
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSessionId);
        } catch (error: any) {
          console.error('Error updating session title:', error);
        }
      })();

      return prevSessions.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              title: newTitle,
              updatedAt: new Date(),
            }
          : session
      );
    });
  }, [currentSessionId]);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      // Delete session from database (soft delete)
      await supabase
        .from('ai_chat_sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      setSessions((prev) => {
        const wasCurrentSession = currentSessionId === id;
        const filtered = prev.filter((session) => session.id !== id);
        
        if (wasCurrentSession) {
          if (filtered.length > 0) {
            setCurrentSessionId(filtered[0].id);
          } else {
            setCurrentSessionId('');
          }
        }
        
        return filtered;
      });
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }, [currentSessionId]);

  // Auto-create new session when all are deleted
  useEffect(() => {
    if (sessions.length === 0 && !isLoading && !isCreatingSession) {
      handleNewChat();
    }
  }, [sessions.length, isLoading, isCreatingSession, handleNewChat]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Premium Sidebar */}
        <div className={`${showSidebar ? 'w-80' : 'w-0'} bg-gradient-to-b from-slate-800 to-slate-900 border-r border-slate-700 flex flex-col transition-all duration-300 overflow-hidden shadow-2xl`}>
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-700">
            <Button
              onClick={handleNewChat}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold gap-2 h-10 shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>

          {/* Chat History */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {sessions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No conversations yet</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => setCurrentSessionId(session.id)}
                    className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      currentSessionId === session.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg'
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    <div className="flex items-start gap-2 justify-between">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <MessageSquare
                          className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                            currentSessionId === session.id
                              ? 'text-white'
                              : 'text-slate-400'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-sm font-medium truncate ${
                              currentSessionId === session.id
                                ? 'text-white'
                                : 'text-slate-200'
                            }`}
                          >
                            {session.title}
                          </h3>
                          <div
                            className={`text-xs flex items-center gap-1 mt-1 flex-shrink-0 ${
                              currentSessionId === session.id
                                ? 'text-blue-100'
                                : 'text-slate-400'
                            }`}
                          >
                            <Clock className="h-3 w-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {session.updatedAt instanceof Date
                                ? session.updatedAt.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                  })
                                : new Date(session.updatedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                  })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4 text-red-400 hover:text-red-300" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            <div className="bg-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-300 font-semibold mb-1">💡 Tip</p>
              <p className="text-xs text-slate-400">Each conversation maintains its own memory. Start a new chat for fresh context.</p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 px-8 py-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">School Hub AI</h1>
                  <p className="text-sm text-slate-300">Intelligent Analytics Platform</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">Session Active</p>
                <p className="text-xs text-slate-400">{sessions.length} conversation{sessions.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Chat Container */}
          <div className="flex-1 overflow-hidden">
            {currentSessionId && currentSession ? (
              <AIAssistantChat
                sessionId={currentSessionId}
                onMessagesUpdate={handleMessagesUpdate}
                welcomeMessage="👋 Welcome to School Hub AI! I'm here to help you analyze your school data. Ask me anything about students, classes, grades, attendance, teachers, and more."
                placeholder="Ask me anything about your school data..."
                suggestedQuestions={[
                  'How many students are enrolled?',
                  'Show students with low attendance',
                  'Average grades by class',
                  'Which teacher has the most classes assigned?',
                ]}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                <p>Loading chat...</p>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
