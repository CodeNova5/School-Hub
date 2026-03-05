"use client";

/**
 * Admin AI Assistant Page with Chat History
 * Provides AI-powered data insights with session-based chat memory
 */

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Loader2, Plus, MessageSquare, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export default function AdminAIAssistantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/admin/login');
          return;
        }
        
        // Initialize with first chat session
        const firstSessionId = 'session-' + Date.now();
        const initialSession: ChatSession = {
          id: firstSessionId,
          title: 'New Conversation',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        setSessions([initialSession]);
        setCurrentSessionId(firstSessionId);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking session:', error);
        router.push('/admin/login');
      }
    }

    checkSession();
  }, [router]);

  const handleNewChat = () => {
    const newSessionId = 'session-' + Date.now();
    const newSession: ChatSession = {
      id: newSessionId,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
  };

  const handleMessagesUpdate = (newMessages: Message[]) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: newMessages,
              updatedAt: new Date(),
              title: newMessages.length > 1
                ? newMessages[1]?.content.substring(0, 50) + '...'
                : 'New Conversation',
            }
          : session
      )
    );
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((session) => session.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(sessions[0]?.id || '');
      if (sessions.length <= 1) {
        handleNewChat();
      }
    }
  };

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="flex h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
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
                            className={`text-xs flex items-center gap-1 mt-1 ${
                              currentSessionId === session.id
                                ? 'text-blue-100'
                                : 'text-slate-400'
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {session.updatedAt.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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
            {currentSession && (
              <AIAssistantChat
                key={currentSession.id}
                initialMessages={currentSession.messages}
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
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
