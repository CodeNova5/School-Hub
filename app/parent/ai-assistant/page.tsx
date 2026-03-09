"use client";

/**
 * Parent AI Assistant Page with Chat History
 * Provides AI-powered data insights with session-based chat memory
 */

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';
import { Loader2, Plus, MessageSquare, Trash2, Clock, MoreVertical, Edit2, Pin, Archive, Trash, Settings, LogOut, Trash2 as TrashIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

export default function ParentAIAssistantPage() {
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
  const [openArchivedDropdownId, setOpenArchivedDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const archivedDropdownRef = useRef<HTMLDivElement>(null);

  // Rename modal state
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenamingSession, setIsRenamingSession] = useState(false);

  // Action loading states
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Track which sessions are not yet saved to database
  const [unsavedSessionIds, setUnsavedSessionIds] = useState<Set<string>>(new Set());

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
    isDestructive: false,
  });

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoCollapsSidebar, setIsAutoCollapseSidebar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClearingArchived, setIsClearingArchived] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Refs for preventing race conditions during initial load
  const isInitialLoadRef = useRef(true);
  const creatingSessionRef = useRef(false);
  const userProfileRef = useRef<{ user_id: string; school_id: string } | null>(null);
  const unsavedSessionIdsRef = useRef(unsavedSessionIds);

  // Keep ref in sync with state
  useEffect(() => {
    unsavedSessionIdsRef.current = unsavedSessionIds;
  }, [unsavedSessionIds]);

  // Helper function to create a new session with optimistic updates
  const createNewSessionOptimistic = useCallback(async (title: string = 'New Conversation') => {
    // Prevent duplicate creation attempts
    if (creatingSessionRef.current) return null;
    
    try {
      creatingSessionRef.current = true;

      // Get auth session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return null;

      // Use cached profile or fetch it
      let schoolId = userProfileRef.current?.school_id;
      if (!schoolId) {
        const { data: userProfile } = await supabase
          .from('parents')
          .select('school_id')
          .eq('user_id', session.user.id)
          .single();

        if (!userProfile) return null;
        schoolId = userProfile.school_id;
        userProfileRef.current = {
          user_id: session.user.id,
          school_id: userProfile.school_id,
        };
      }

      // Create session in database
      const { data: newSession, error } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: session.user.id,
          school_id: schoolId,
          title,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      if (!newSession) return null;

      // Return formatted session data
      return {
        id: newSession.id,
        title: newSession.title,
        createdAt: new Date(newSession.created_at),
        updatedAt: new Date(newSession.updated_at),
        isPinned: false,
        isArchived: false,
      } as ChatSession;
    } catch (error) {
      console.error('Error in createNewSessionOptimistic:', error);
      return null;
    } finally {
      creatingSessionRef.current = false;
    }
  }, []);

  // Initialize sessions on load
  useEffect(() => {
    let isMounted = true;
    let retryTimeoutId: NodeJS.Timeout | null = null;

    async function initializeSession() {
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
          router.push('/parent/login');
          return;
        }

        // Cache user profile for later use
        const { data: userProfile } = await supabase
          .from('parents')
          .select('school_id')
          .eq('user_id', session.user.id)
          .single();

        if (userProfile && isMounted) {
          userProfileRef.current = {
            user_id: session.user.id,
            school_id: userProfile.school_id,
          };
        }

        // Load existing sessions from database
        const { data: dbSessions, error } = await supabase
          .from('ai_chat_sessions')
          .select('id, title, created_at, updated_at, is_pinned, is_archived, deleted_at')
          .eq('user_id', session.user.id)
          .is('deleted_at', null)
          .order('is_pinned', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!isMounted) return;

        // Process sessions
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

          // Check if "New Conversation" already exists in active sessions
          const hasNewConversation = activeSessions.some((s: ChatSession) => s.title === 'New Conversation');

          // Only create a new session if one doesn't already exist
          let newSession: ChatSession | null = null;
          if (!hasNewConversation && userProfileRef.current) {
            newSession = await createNewSessionOptimistic('New Conversation');
          }

          // Set all sessions together in a single state update to ensure consistency
          if (newSession && isMounted) {
            setSessions([newSession, ...activeSessions]);
            setCurrentSessionId(newSession.id);
          } else if (isMounted) {
            setSessions(activeSessions);
            // Set the current session to "New Conversation" if it exists, otherwise first session
            const newConversationSession = activeSessions.find((s: ChatSession) => s.title === 'New Conversation');
            setCurrentSessionId(newConversationSession?.id || activeSessions[0]?.id || '');
          }

          if (isMounted) {
            setArchivedSessions(archived);
          }
        } else {
          // No sessions exist - create first chat automatically
          setSessions([]);
          setArchivedSessions([]);

          // Create initial session
          if (userProfileRef.current) {
            const newSession = await createNewSessionOptimistic('New Conversation');
            if (newSession && isMounted) {
              setSessions([newSession]);
              setCurrentSessionId(newSession.id);
            }
          }
        }

        if (isMounted) {
          isInitialLoadRef.current = false;
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Error initializing session:', error);

        if (!isMounted) return;

        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) {
          router.push('/parent/login');
          return;
        }

        // Retry once with exponential backoff for network errors
        retryTimeoutId = setTimeout(() => {
          if (isMounted) {
            initializeSession();
          }
        }, 1000);
      }
    }

    initializeSession();

    return () => {
      isMounted = false;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [router, createNewSessionOptimistic]);

  const handleNewChat = useCallback(async () => {
    // Prevent creating multiple chats during initial load
    if (isInitialLoadRef.current || creatingSessionRef.current) return;

    // Check if there's already a "New Conversation" session in the database
    const existingNewConversation = sessions.find((s) => s.title === 'New Conversation');

    // If new conversation already exists in DB, just switch to it
    if (existingNewConversation) {
      setCurrentSessionId(existingNewConversation.id);
      return;
    }

    // Create new session
    setIsCreatingSession(true);
    try {
      const newSession = await createNewSessionOptimistic('New Conversation');
      
      if (newSession) {
        setSessions((prev) => [newSession, ...prev]);
        setCurrentSessionId(newSession.id);
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsCreatingSession(false);
    }
  }, [sessions, createNewSessionOptimistic]);

  const handleMessagesUpdate = useCallback((newMessages: Message[]) => {
    // Mark session as having messages in localStorage
    if (currentSessionId && newMessages.length > 0) {
      const sessionMessagesKey = `aiAssistant_sessionMessages_${currentSessionId}`;
      localStorage.setItem(sessionMessagesKey, 'true');

      // If this is an unsaved session with messages, save it to database
      if (unsavedSessionIds.has(currentSessionId)) {
        (async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session) return;

            const currentSession = sessions.find((s) => s.id === currentSessionId);
            if (!currentSession) return;

            // Get user's school_id
            const { data: userProfile } = await supabase
              .from('parents')
              .select('school_id')
              .eq('user_id', session.user.id)
              .single();

            if (!userProfile) return;

            // Create session in database
            const { data: newSession, error } = await supabase
              .from('ai_chat_sessions')
              .insert({
                user_id: session.user.id,
                school_id: userProfile.school_id,
                title: currentSession.title,
              })
              .select()
              .single();

            if (!error && newSession) {
              // Update sessions with real ID from database
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === currentSessionId
                    ? {
                      id: newSession.id,
                      title: newSession.title || 'Untitled Conversation',
                      createdAt: new Date(newSession.created_at),
                      updatedAt: new Date(newSession.updated_at),
                      isPinned: false,
                      isArchived: false,
                    }
                    : s
                )
              );

              // Update current session ID to real ID
              setCurrentSessionId(newSession.id);

              // Remove from unsaved set
              setUnsavedSessionIds((prev) => {
                const updated = new Set(prev);
                updated.delete(currentSessionId);
                return updated;
              });
            }
          } catch (error: any) {
            console.error('Error saving unsaved session:', error);
          }
        })();
      }
    }
  }, [currentSessionId, sessions, unsavedSessionIds]);

  const handleTitleGenerated = useCallback(async (generatedTitle: string) => {
    if (!currentSessionId) {
      return;
    }

    try {
      // Update the session with the AI-generated title
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? {
              ...session,
              title: generatedTitle,
              updatedAt: new Date(),
            }
            : session
        )
      );

      // Only update DB if session is already saved (not unsaved)
      if (!unsavedSessionIdsRef.current.has(currentSessionId)) {
        const { error } = await supabase
          .from('ai_chat_sessions')
          .update({
            title: generatedTitle,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSessionId);
        
        if (error) {
          console.error('Error updating title in DB:', error);
        }
      }
    } catch (error: any) {
      console.error('Error updating session title:', error);
    }
  }, [currentSessionId]);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      // Clear localStorage flag for this session
      const sessionMessagesKey = `aiAssistant_sessionMessages_${id}`;
      localStorage.removeItem(sessionMessagesKey);

      // Only delete from database if it was saved
      if (!unsavedSessionIds.has(id)) {
        await supabase
          .from('ai_chat_sessions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
      }

      // Remove from unsaved set if present
      setUnsavedSessionIds((prev) => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });

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
  }, [currentSessionId, unsavedSessionIds]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete Conversation',
      description: 'This action cannot be undone. The conversation will be permanently removed.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setLoadingActionId(id);

          // Clear localStorage flag for this session
          const sessionMessagesKey = `aiAssistant_sessionMessages_${id}`;
          localStorage.removeItem(sessionMessagesKey);

          // Only delete from database if it was saved
          if (!unsavedSessionIds.has(id)) {
            await supabase
              .from('ai_chat_sessions')
              .delete()
              .eq('id', id);
          }

          // Remove from unsaved set if present
          setUnsavedSessionIds((prev) => {
            const updated = new Set(prev);
            updated.delete(id);
            return updated;
          });

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
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error('Error permanently deleting session:', error);
          alert('Failed to delete session. Please try again.');
        } finally {
          setLoadingActionId(null);
        }
      },
    });
  }, [currentSessionId, unsavedSessionIds]);

  const handleRenameSession = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    setIsRenamingSession(true);
    try {
      // Only update database if session is already saved
      if (!unsavedSessionIds.has(id)) {
        await supabase
          .from('ai_chat_sessions')
          .update({
            title: newTitle.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

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
  }, [unsavedSessionIds]);

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

      // Clear localStorage flag for this session
      const sessionMessagesKey = `aiAssistant_sessionMessages_${id}`;
      localStorage.removeItem(sessionMessagesKey);

      // If unsaved, just delete it since it can't be archived
      if (unsavedSessionIds.has(id)) {
        setUnsavedSessionIds((prev) => {
          const updated = new Set(prev);
          updated.delete(id);
          return updated;
        });

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
      } else {
        // Archive in database if already saved
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
      }

      setOpenDropdownId(null);
    } catch (error) {
      console.error('Error archiving session:', error);
      alert('Failed to archive session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [currentSessionId, sessions, unsavedSessionIds]);

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
          const updated = [...prev, { ...unarchivedSession, isArchived: false }];
          // Set as current session after unarchiving
          setTimeout(() => setCurrentSessionId(id), 0);
          return updated;
        }
        return prev;
      });

      setOpenArchivedDropdownId(null);
      setShowArchived(false);
    } catch (error) {
      console.error('Error unarchiving session:', error);
      alert('Failed to unarchive session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [archivedSessions]);

  const handleLogout = useCallback(async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Logout',
      description: 'Are you sure you want to logout from your account?',
      isDestructive: false,
      onConfirm: async () => {
        setIsLoggingOut(true);
        try {
          await supabase.auth.signOut();
          router.push('/parent/login');
        } catch (error) {
          console.error('Error logging out:', error);
          alert('Failed to logout. Please try again.');
        } finally {
          setIsLoggingOut(false);
        }
      },
    });
  }, [router]);

  const handleClearAllArchived = useCallback(async () => {
    const archivedIds = archivedSessions.map((s) => s.id);

    if (archivedIds.length === 0) {
      alert('No archived conversations to delete.');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Delete All Archived Conversations',
      description: `Are you sure you want to permanently delete all ${archivedIds.length} archived conversations? This action cannot be undone.`,
      isDestructive: true,
      onConfirm: async () => {
        setIsClearingArchived(true);
        try {
          // Clear all localStorage flags for archived sessions
          archivedIds.forEach((id: string) => {
            const sessionMessagesKey = `aiAssistant_sessionMessages_${id}`;
            localStorage.removeItem(sessionMessagesKey);
          });

          // Filter out unsaved sessions from deletion
          const savedArchivedIds = archivedIds.filter((id) => !unsavedSessionIds.has(id));

          if (savedArchivedIds.length > 0) {
            // Delete all saved archived sessions
            await supabase
              .from('ai_chat_sessions')
              .delete()
              .in('id', savedArchivedIds);
          }

          // Remove all archived sessions from local state
          setArchivedSessions([]);
          setShowSettings(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          alert('All archived conversations have been deleted.');
        } catch (error) {
          console.error('Error clearing archived:', error);
          alert('Failed to delete archived conversations. Please try again.');
        } finally {
          setIsClearingArchived(false);
        }
      },
    });
  }, [archivedSessions, unsavedSessionIds]);

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

  const handleDeleteAllChatHistory = useCallback(async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete All Chat History',
      description: 'This will permanently delete ALL conversations, messages, and archived chats. This action cannot be undone.',
      isDestructive: true,
      onConfirm: async () => {
        setIsDeletingAll(true);
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) return;

          // Get all SAVED session IDs for this user (excluding unsaved ones)
          const { data: allSessions } = await supabase
            .from('ai_chat_sessions')
            .select('id')
            .eq('user_id', session.user.id);

          if (allSessions && allSessions.length > 0) {
            const sessionIds = allSessions.map((s: any) => s.id);

            // Clear all localStorage flags for these sessions
            sessionIds.forEach((id: string) => {
              const sessionMessagesKey = `aiAssistant_sessionMessages_${id}`;
              localStorage.removeItem(sessionMessagesKey);
            });

            // Delete all messages for these sessions
            await supabase
              .from('ai_chat_messages')
              .delete()
              .in('session_id', sessionIds);

            // Delete all sessions
            await supabase
              .from('ai_chat_sessions')
              .delete()
              .in('id', sessionIds);
          }

          // Clear all local state including unsaved sessions
          setSessions([]);
          setArchivedSessions([]);
          setUnsavedSessionIds(new Set());
          setCurrentSessionId('');
          setShowSettings(false);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

          alert('All chat history has been permanently deleted.');
        } catch (error) {
          console.error('Error deleting all chat history:', error);
          alert('Failed to delete chat history. Please try again.');
        } finally {
          setIsDeletingAll(false);
        }
      },
    });
  }, []);

  const handleToggleAutoCollapse = useCallback(() => {
    const newValue = !isAutoCollapsSidebar;
    setIsAutoCollapseSidebar(newValue);
    localStorage.setItem('aiAssistant_autoCollapseSidebar', String(newValue));
  }, [isAutoCollapsSidebar]);

  // Ensure valid session is selected when closing modals
  const handleCloseArchived = useCallback(() => {
    setShowArchived(false);
    setOpenArchivedDropdownId(null);

    // If current session is no longer in active sessions, switch to first active session
    if (currentSessionId && !sessions.find(s => s.id === currentSessionId)) {
      if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
      }
    }
  }, [currentSessionId, sessions]);

  // Auto-create new session when all are deleted (after initial load)
  useEffect(() => {
    // Only auto-create if: user is done with initial load, has no sessions, and not currently creating
    if (!isInitialLoadRef.current && sessions.length === 0 && !isCreatingSession && currentSessionId === '') {
      handleNewChat();
    }
  }, [sessions.length, isCreatingSession, currentSessionId, handleNewChat]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
      if (archivedDropdownRef.current && !archivedDropdownRef.current.contains(event.target as Node)) {
        setOpenArchivedDropdownId(null);
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
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.isOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      }}>
        <AlertDialogContent className="bg-slate-800 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDialog.onConfirm}
              className={confirmDialog.isDestructive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
                    className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${currentSessionId === session.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg'
                        : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                  >
                    <div className="flex items-start gap-2 justify-between">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1 mt-0.5">
                          <MessageSquare
                            className={`h-4 w-4 flex-shrink-0 ${currentSessionId === session.id
                                ? 'text-white'
                                : 'text-slate-400'
                              }`}
                          />
                          {session.isPinned && (
                            <Pin
                              className={`h-3 w-3 flex-shrink-0 ${currentSessionId === session.id
                                  ? 'text-yellow-300'
                                  : 'text-yellow-400'
                                }`}
                              fill="currentColor"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className={`text-sm font-medium truncate ${currentSessionId === session.id
                                ? 'text-white'
                                : 'text-slate-200'
                              }`}
                          >
                            {session.title}
                          </h3>
                          <div
                            className={`text-xs flex items-center gap-1 mt-1 flex-shrink-0 ${currentSessionId === session.id
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
                          <MoreVertical className={`h-4 w-4 ${currentSessionId === session.id
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
          {showSettings && !showArchived && (
            <div
              className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3"
              onClick={() => setShowSettings(false)}
            >
              <div
                className="bg-slate-800 rounded-lg p-5 w-full max-w-sm border border-slate-700 shadow-2xl z-[60]"
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
                    onClick={() => {
                      setShowSettings(false);
                      setShowArchived(true);
                    }}
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

                  {/* Delete All Chat History */}
                  <button
                    onClick={handleDeleteAllChatHistory}
                    disabled={isDeletingAll}
                    className="w-full p-3 text-left bg-red-900/30 border border-red-700/50 rounded-lg hover:bg-red-900/40 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Trash className="h-4 w-4 text-red-400" />
                      <p className="text-sm font-medium text-red-300">
                        {isDeletingAll ? 'Deleting...' : 'Delete All History'}
                      </p>
                    </div>
                    <p className="text-xs text-red-300/70 ml-6">Permanently remove everything</p>
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
          className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3"
          onClick={handleCloseArchived}
        >
          <div
            className="bg-slate-800 rounded-xl w-full max-w-2xl border border-slate-700 shadow-2xl z-[60] flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-slate-700">
              <div className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/30 rounded-lg">
                    <Archive className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Archived Conversations</h2>
                    <p className="text-xs text-slate-400 mt-1">View and restore your archived chats</p>
                  </div>
                </div>
                <span className="px-3 py-1.5 bg-amber-500/30 text-amber-200 rounded-full text-sm font-semibold">
                  {archivedSessions.length}
                </span>
              </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 [&_[data-radix-scroll-area-thumb]]:hidden">
              <div className="p-6 space-y-3">
                {archivedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Archive className="h-12 w-12 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-400 text-center">No archived conversations yet</p>
                  </div>
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
                            className="bg-slate-800 rounded-lg p-6 w-full max-w-sm border border-slate-700 shadow-xl z-50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <h2 className="text-white font-semibold mb-4 text-lg">Rename Conversation</h2>
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
                              className="w-full bg-slate-700 border border-slate-600 text-white rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5"
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleRenameSession(session.id, renameValue)}
                                disabled={isRenamingSession || !renameValue.trim()}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                              >
                                {isRenamingSession ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={() => {
                                  setRenameSessionId(null);
                                  setRenameValue('');
                                }}
                                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded transition-colors font-medium"
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
                        className={`group p-4 rounded-lg cursor-pointer transition-all duration-200 border ${currentSessionId === session.id
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 border-blue-500 shadow-lg'
                            : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500'
                          }`}
                      >
                        <div className="flex items-start gap-3 justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mt-1">
                              <MessageSquare
                                className={`h-5 w-5 flex-shrink-0 ${currentSessionId === session.id
                                    ? 'text-white'
                                    : 'text-slate-400'
                                  }`}
                              />
                              <Archive
                                className="h-4 w-4 flex-shrink-0 text-amber-400"
                                fill="currentColor"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3
                                className={`text-base font-semibold truncate mb-2 ${currentSessionId === session.id
                                    ? 'text-white'
                                    : 'text-slate-100'
                                  }`}
                              >
                                {session.title}
                              </h3>
                              <div
                                className={`text-sm flex items-center gap-2 ${currentSessionId === session.id
                                    ? 'text-blue-100'
                                    : 'text-slate-400'
                                  }`}
                              >
                                <Clock className="h-4 w-4 flex-shrink-0" />
                                <span className="whitespace-nowrap">
                                  {session.updatedAt instanceof Date
                                    ? session.updatedAt.toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false,
                                    })
                                    : new Date(session.updatedAt).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: false,
                                    })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Dropdown Menu Button */}
                          <div ref={archivedDropdownRef} className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenArchivedDropdownId(openArchivedDropdownId === session.id ? null : session.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-600/50 rounded-lg"
                            >
                              <MoreVertical
                                className={`h-5 w-5 ${currentSessionId === session.id
                                    ? 'text-blue-100'
                                    : 'text-slate-300'
                                  }`}
                              />
                            </button>

                            {/* Dropdown Menu - Archived */}
                            {openArchivedDropdownId === session.id && (
                              <div className="absolute right-0 top-full mt-2 w-52 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-[100] overflow-hidden">
                                {/* Rename */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenameSessionId(session.id);
                                    setRenameValue(session.title);
                                    setOpenArchivedDropdownId(null);
                                  }}
                                  disabled={loadingActionId === session.id}
                                  className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors border-b border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Edit2 className="h-4 w-4" />
                                  <span>{loadingActionId === session.id ? 'Processing...' : 'Rename'}</span>
                                </button>

                                {/* Unarchive */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnarchiveSession(session.id);
                                  }}
                                  disabled={loadingActionId === session.id}
                                  className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors border-b border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Archive className="h-4 w-4" />
                                  <span>{loadingActionId === session.id ? 'Processing...' : 'Unarchive'}</span>
                                </button>

                                {/* Permanent Delete */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePermanentDelete(session.id);
                                  }}
                                  disabled={loadingActionId === session.id}
                                  className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-900/30 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash className="h-4 w-4" />
                                  <span>{loadingActionId === session.id ? 'Processing...' : 'Delete Permanently'}</span>
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

            {/* Footer */}
            <div className="p-6 border-t border-slate-700 bg-gradient-to-r from-slate-800/50 to-slate-700/50">
              <button
                onClick={handleCloseArchived}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold shadow-lg hover:shadow-xl"
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
              key={currentSessionId}
              sessionId={currentSessionId}
              onMessagesUpdate={handleMessagesUpdate}
              onGeneratedTitle={handleTitleGenerated}
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
