"use client";

/**
 * Admin AI Assistant Page with Chat History
 * Provides AI-powered data insights with session-based chat memory
 */

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Loader2, Plus, MessageSquare, Trash2, Clock, MoreVertical, Edit2, Pin, Archive, Trash, Settings, LogOut, Trash2 as TrashIcon, Download } from 'lucide-react';
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
  isPinned?: boolean;
  isArchived?: boolean;
}

export default function AdminAIAssistantPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  // Dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Rename modal state
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenamingSession, setIsRenamingSession] = useState(false);
  
  // Action loading states
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  
  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoCollapsSidebar, setIsAutoCollapseSidebar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClearingArchived, setIsClearingArchived] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let retryTimeoutId: NodeJS.Timeout | null = null;

    async function checkSession() {
      try {
        // Load sidebar auto-collapse preference from localStorage
        const savedAutoCollapse = localStorage.getItem('aiAssistant_autoCollapseSidebar') === 'true';
        if (isMounted) {
          setIsAutoCollapseSidebar(savedAutoCollapse);
        }

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
          .select('id, title, created_at, updated_at, is_pinned, is_archived, deleted_at')
          .is('deleted_at', null)
          .order('is_pinned', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!isMounted) return;

        if (!error && dbSessions && dbSessions.length > 0) {
          const activeSessions = dbSessions
            .filter((s: any) => !s.is_archived)
            .map((s: any) => ({
              id: s.id,
              title: s.title || 'Untitled Conversation',
              createdAt: new Date(s.created_at),
              updatedAt: new Date(s.updated_at),
              isPinned: s.is_pinned || false,
              isArchived: s.is_archived || false,
            }));
          
          const archived = dbSessions
            .filter((s: any) => s.is_archived)
            .map((s: any) => ({
              id: s.id,
              title: s.title || 'Untitled Conversation',
              createdAt: new Date(s.created_at),
              updatedAt: new Date(s.updated_at),
              isPinned: s.is_pinned || false,
              isArchived: s.is_archived || false,
            }));
          
          setSessions(activeSessions);
          setArchivedSessions(archived);
          
          if (activeSessions.length > 0) {
            setCurrentSessionId(activeSessions[0].id);
          }
        } else {
          // No sessions exist, start with empty state and let user create first chat
          setSessions([]);
          setArchivedSessions([]);
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

  const handlePermanentDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      setLoadingActionId(id);
      // Permanently delete from database
      await supabase
        .from('ai_chat_sessions')
        .delete()
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

      // Also remove from archived if present
      setArchivedSessions((prev) => prev.filter((session) => session.id !== id));

      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error permanently deleting session:', error);
      alert('Failed to delete session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [currentSessionId]);

  const handleRenameSession = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    setIsRenamingSession(true);
    try {
      await supabase
        .from('ai_chat_sessions')
        .update({
          title: newTitle.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      setSessions((prev) =>
        prev.map((session) =>
          session.id === id
            ? {
                ...session,
                title: newTitle.trim(),
                updatedAt: new Date(),
              }
            : session
        )
      );
      setRenameSessionId(null);
      setRenameValue('');
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error renaming session:', error);
    } finally {
      setIsRenamingSession(false);
    }
  }, []);

  const handlePinSession = useCallback(async (id: string, isPinned: boolean) => {
    try {
      setLoadingActionId(id);
      await supabase
        .from('ai_chat_sessions')
        .update({
          is_pinned: !isPinned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      setSessions((prev) => {
        const updated = prev.map((session) =>
          session.id === id
            ? {
                ...session,
                isPinned: !isPinned,
                updatedAt: new Date(),
              }
            : session
        );
        
        // Re-sort with pinned items first
        return updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) {
            return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
          }
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      });
      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error pinning session:', error);
      alert('Failed to pin session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, []);

  const handleArchiveSession = useCallback(async (id: string) => {
    try {
      setLoadingActionId(id);
      await supabase
        .from('ai_chat_sessions')
        .update({
          is_archived: true,
          updated_at: new Date().toISOString(),
        })
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

      // Add to archived sessions
      setArchivedSessions((prev) => {
        const archivedSession = sessions.find((s) => s.id === id);
        if (archivedSession) {
          return [...prev, { ...archivedSession, isArchived: true }];
        }
        return prev;
      });

      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error archiving session:', error);
      alert('Failed to archive session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [currentSessionId, sessions]);

  const handleUnarchiveSession = useCallback(async (id: string) => {
    try {
      setLoadingActionId(id);
      await supabase
        .from('ai_chat_sessions')
        .update({
          is_archived: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      // Remove from archived sessions
      setArchivedSessions((prev) => prev.filter((session) => session.id !== id));

      // Add to active sessions
      setSessions((prev) => {
        const unarchivedSession = archivedSessions.find((s) => s.id === id);
        if (unarchivedSession) {
          return [...prev, { ...unarchivedSession, isArchived: false }];
        }
        return prev;
      });

      setOpenDropdownId(null);
      setShowArchived(false);
    } catch (error) {
      console.error('Error unarchiving session:', error);
      alert('Failed to unarchive session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [archivedSessions]);

  const handleLogout = useCallback(async () => {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }

    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error logging out:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  }, [router]);

  const handleClearAllArchived = useCallback(async () => {
    if (!confirm(`Are you sure you want to permanently delete all ${archivedSessions.length} archived conversations? This action cannot be undone.`)) {
      return;
    }

    setIsClearingArchived(true);
    try {
      // Get all archived session IDs
      const archivedIds = archivedSessions.map((s) => s.id);
      
      if (archivedIds.length === 0) {
        alert('No archived conversations to delete.');
        return;
      }

      // Delete all archived sessions
      await supabase
        .from('ai_chat_sessions')
        .delete()
        .in('id', archivedIds);

      setArchivedSessions([]);
      setShowSettings(false);
      alert('All archived conversations have been deleted.');
    } catch (error) {
      console.error('Error clearing archived:', error);
      alert('Failed to delete archived conversations. Please try again.');
    } finally {
      setIsClearingArchived(false);
    }
  }, [archivedSessions]);

  const handleExportAsJSON = useCallback(() => {
    try {
      // Prepare export data
      const exportData = {
        exportDate: new Date().toISOString(),
        totalSessions: sessions.length + archivedSessions.length,
        activeSessions: sessions,
        archivedSessions: archivedSessions,
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chat-history-${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setShowSettings(false);
      alert('Chat history exported successfully!');
    } catch (error) {
      console.error('Error exporting:', error);
      alert('Failed to export chat history. Please try again.');
    }
  }, [sessions, archivedSessions]);

  const handleToggleAutoCollapse = useCallback(() => {
    const newValue = !isAutoCollapsSidebar;
    setIsAutoCollapseSidebar(newValue);
    localStorage.setItem('aiAssistant_autoCollapseSidebar', String(newValue));
  }, [isAutoCollapsSidebar]);

  // Auto-create new session when all are deleted
  useEffect(() => {
    if (sessions.length === 0 && !isLoading && !isCreatingSession) {
      handleNewChat();
    }
  }, [sessions.length, isLoading, isCreatingSession, handleNewChat]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
              {/* Sessions List */}
              {sessions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No conversations yet</p>
              ) : (
                  sessions.map((session) => (
                    <div key={session.id} className="relative">
                    {/* Rename Modal */}
                    {renameSessionId === session.id && (
                      <div className="fixed inset-0 bg-slate-900/80 z-40 flex items-center justify-center p-3" onClick={() => {
                        setRenameSessionId(null);
                        setRenameValue('');
                      }}>
                        <div className="bg-slate-800 rounded-lg p-4 w-full max-w-sm border border-slate-700 shadow-xl z-50" onClick={(e) => e.stopPropagation()}>
                          <h2 className="text-white font-semibold mb-3">Rename Conversation</h2>
                          <input
                            autoFocus
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSession(session.id, renameValue);
                              } else if (e.key === 'Escape') {
                                setRenameSessionId(null);
                                setRenameValue('');
                              }
                            }}
                            placeholder="New name..."
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRenameSession(session.id, renameValue)}
                              disabled={isRenamingSession || !renameValue.trim()}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                              {isRenamingSession ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={() => {
                                setRenameSessionId(null);
                                setRenameValue('');
                              }}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded transition-colors font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Session Item */}
                    <div
                      onClick={() => {
                        setCurrentSessionId(session.id);
                        setOpenDropdownId(null);
                      }}
                      className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        currentSessionId === session.id
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg'
                          : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-1 mt-0.5">
                            <MessageSquare
                              className={`h-4 w-4 flex-shrink-0 ${
                                currentSessionId === session.id
                                  ? 'text-white'
                                  : 'text-slate-400'
                              }`}
                            />
                            {session.isPinned && (
                              <Pin
                                className={`h-3 w-3 flex-shrink-0 ${
                                  currentSessionId === session.id
                                    ? 'text-yellow-300'
                                    : 'text-yellow-400'
                                }`}
                                fill="currentColor"
                              />
                            )}
                          </div>
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

                        {/* Dropdown Menu Button */}
                        <div ref={dropdownRef} className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === session.id ? null : session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600/50 rounded"
                          >
                            <MoreVertical className={`h-4 w-4 ${
                              currentSessionId === session.id
                                ? 'text-blue-100'
                                : 'text-slate-300'
                            }`} />
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdownId === session.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 overflow-hidden">
                              {/* Rename */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameSessionId(session.id);
                                  setRenameValue(session.title);
                                }}
                                disabled={loadingActionId === session.id}
                                className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-2 transition-colors border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit2 className="h-4 w-4" />
                                {loadingActionId === session.id ? 'Processing...' : 'Rename'}
                              </button>

                              {/* Pin/Unpin */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePinSession(session.id, session.isPinned || false);
                                }}
                                disabled={loadingActionId === session.id}
                                className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-2 transition-colors border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Pin className={`h-4 w-4 ${session.isPinned ? 'text-yellow-400' : ''}`} />
                                {loadingActionId === session.id ? 'Processing...' : session.isPinned ? 'Unpin' : 'Pin'}
                              </button>

                              {/* Archive */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleArchiveSession(session.id);
                                }}
                                disabled={loadingActionId === session.id}
                                className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-2 transition-colors border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Archive className="h-4 w-4" />
                                {loadingActionId === session.id ? 'Processing...' : 'Archive'}
                              </button>

                              {/* Permanent Delete */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePermanentDelete(session.id);
                                }}
                                disabled={loadingActionId === session.id}
                                className="w-full px-4 py-2 text-left text-sm text-red-300 hover:bg-red-900/30 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash className="h-4 w-4" />
                                {loadingActionId === session.id ? 'Processing...' : 'Delete Permanently'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Sidebar Footer with Settings */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            {/* Settings Modal */}
            {showSettings && (
              <div
                className="fixed inset-0 bg-slate-900/80 z-40 flex items-center justify-center p-3"
                onClick={() => setShowSettings(false)}
              >
                <div
                  className="bg-slate-800 rounded-lg p-5 w-full max-w-sm border border-slate-700 shadow-2xl z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="h-5 w-5 text-blue-400" />
                    <h2 className="text-lg font-semibold text-white">Settings</h2>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {/* Auto-Collapse Sidebar Toggle */}
                    <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAutoCollapsSidebar}
                          onChange={handleToggleAutoCollapse}
                          className="w-4 h-4 rounded accent-blue-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-200">Auto-Collapse Sidebar</p>
                          <p className="text-xs text-slate-400">Sidebar collapses on startup</p>
                        </div>
                      </label>
                    </div>

                    {/* View Archived Conversations */}
                    <button
                      onClick={() => setShowArchived(true)}
                      className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Archive className="h-4 w-4 text-amber-400" />
                        <p className="text-sm font-medium text-slate-200">View Archived</p>
                      </div>
                      <p className="text-xs text-slate-400 ml-6">{archivedSessions.length} archived conversation{archivedSessions.length !== 1 ? 's' : ''}</p>
                    </button>

                    {/* Export Chat History */}
                    <button
                      onClick={handleExportAsJSON}
                      className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Download className="h-4 w-4 text-green-400" />
                        <p className="text-sm font-medium text-slate-200">Export as JSON</p>
                      </div>
                      <p className="text-xs text-slate-400 ml-6">Download all chat history</p>
                    </button>

                    {/* Clear All Archived */}
                    <button
                      onClick={handleClearAllArchived}
                      disabled={isClearingArchived || archivedSessions.length === 0}
                      className="w-full p-3 text-left bg-red-900/20 border border-red-700/50 rounded-lg hover:bg-red-900/30 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <TrashIcon className="h-4 w-4 text-red-400" />
                        <p className="text-sm font-medium text-red-300">
                          {isClearingArchived ? 'Clearing...' : 'Clear All Archived'}
                        </p>
                      </div>
                      <p className="text-xs text-red-300/70 ml-6">Permanently delete all archived</p>
                    </button>

                    {/* Logout */}
                    <button
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <LogOut className="h-4 w-4 text-slate-300" />
                        <p className="text-sm font-medium text-slate-200">
                          {isLoggingOut ? 'Signing out...' : 'Logout'}
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 ml-6">Sign out from your account</p>
                    </button>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowSettings(false)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors font-medium text-sm"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200 rounded-lg transition-all border border-slate-600 hover:border-slate-500"
            >
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>
          </div>
        </div>

        {/* Archived Sessions Modal */}
        {showArchived && (
          <div
            className="fixed inset-0 bg-slate-900/80 z-40 flex items-center justify-center p-3"
            onClick={() => setShowArchived(false)}
          >
            <div
              className="bg-slate-800 rounded-lg w-full max-w-md border border-slate-700 shadow-2xl z-50 flex flex-col max-h-96"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-white">Archived Conversations</h2>
                  <span className="ml-auto text-xs bg-amber-500/30 text-amber-200 px-2 py-1 rounded">
                    {archivedSessions.length}
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {archivedSessions.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">No archived conversations</p>
                  ) : (
                    archivedSessions.map((session) => (
                      <div key={session.id} className="relative">
                        {/* Rename Modal */}
                        {renameSessionId === session.id && (
                          <div
                            className="fixed inset-0 bg-slate-900/80 z-40 flex items-center justify-center p-3"
                            onClick={() => {
                              setRenameSessionId(null);
                              setRenameValue('');
                            }}
                          >
                            <div
                              className="bg-slate-800 rounded-lg p-4 w-full max-w-sm border border-slate-700 shadow-xl z-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h2 className="text-white font-semibold mb-3">Rename Conversation</h2>
                              <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRenameSession(session.id, renameValue);
                                  } else if (e.key === 'Escape') {
                                    setRenameSessionId(null);
                                    setRenameValue('');
                                  }
                                }}
                                placeholder="New name..."
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleRenameSession(session.id, renameValue)}
                                  disabled={isRenamingSession || !renameValue.trim()}
                                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                >
                                  {isRenamingSession ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => {
                                    setRenameSessionId(null);
                                    setRenameValue('');
                                  }}
                                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded transition-colors font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Session Item - Archived */}
                        <div
                          onClick={() => {
                            setCurrentSessionId(session.id);
                            setOpenDropdownId(null);
                          }}
                          className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                            currentSessionId === session.id
                              ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg'
                              : 'bg-slate-700 hover:bg-slate-600'
                          }`}
                        >
                          <div className="flex items-start gap-2 justify-between">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <div className="flex items-center gap-1 mt-0.5">
                                <MessageSquare
                                  className={`h-4 w-4 flex-shrink-0 ${
                                    currentSessionId === session.id
                                      ? 'text-white'
                                      : 'text-slate-400'
                                  }`}
                                />
                                <Archive
                                  className="h-3 w-3 flex-shrink-0 text-amber-500"
                                  fill="currentColor"
                                />
                              </div>
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

                            {/* Dropdown Menu Button */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === session.id ? null : session.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600/50 rounded"
                              >
                                <MoreVertical
                                  className={`h-4 w-4 ${
                                    currentSessionId === session.id
                                      ? 'text-blue-100'
                                      : 'text-slate-300'
                                  }`}
                                />
                              </button>

                              {/* Dropdown Menu - Archived */}
                              {openDropdownId === session.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 overflow-hidden">
                                  {/* Rename */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRenameSessionId(session.id);
                                      setRenameValue(session.title);
                                    }}
                                    disabled={loadingActionId === session.id}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-2 transition-colors border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                    {loadingActionId === session.id ? 'Processing...' : 'Rename'}
                                  </button>

                                  {/* Unarchive */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUnarchiveSession(session.id);
                                    }}
                                    disabled={loadingActionId === session.id}
                                    className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-2 transition-colors border-b border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Archive className="h-4 w-4" />
                                    {loadingActionId === session.id ? 'Processing...' : 'Unarchive'}
                                  </button>

                                  {/* Permanent Delete */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePermanentDelete(session.id);
                                    }}
                                    disabled={loadingActionId === session.id}
                                    className="w-full px-4 py-2 text-left text-sm text-red-300 hover:bg-red-900/30 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Trash className="h-4 w-4" />
                                    {loadingActionId === session.id ? 'Processing...' : 'Delete Permanently'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={() => setShowArchived(false)}
                  className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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
