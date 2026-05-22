"use client";

/**
 * Admin AI Assistant Page with Chat History
 * Provides AI-powered data insights with session-based chat memory
 */

import { supabase } from '@/lib/supabase';
import useAIAssistantSessions from '@/hooks/useAIAssistantSessions';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import AIAssistantChat from '@/components/ai-assistant-chat';
import AIAssistantSidebar from '@/components/ai-assistant-sidebar';
import { Bot, MessageSquare, Trash2, Clock, MoreVertical, Edit2, Pin, Archive, Trash, Settings, LogOut, Trash2 as TrashIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AIAssistantUsageSummary } from '@/lib/ai-assistant/usage';
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
  timestamp: Date | string;
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
  const params = useParams();
  const routeSessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [isLoading, setIsLoading] = useState(true);
  const {
    sessions,
    archivedSessions,
    loadSessions,
    renameSession,
    pinSession,
    archiveSession,
    unarchiveSession,
    deleteSession,
    permanentDelete,
    clearAllArchived,
    exportAsJSON,
    deleteAllChatHistory,
    unsavedSessionIds,
    setUnsavedSessionIds,
  } = useAIAssistantSessions();
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [invalidSessionId, setInvalidSessionId] = useState(false);

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
    onConfirm: () => { },
    isDestructive: false,
  });

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoCollapsSidebar, setIsAutoCollapseSidebar] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClearingArchived, setIsClearingArchived] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [usageSummary, setUsageSummary] = useState<AIAssistantUsageSummary | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);

  const unsavedSessionIdsRef = useRef(unsavedSessionIds);

  // Keep ref in sync with state
  useEffect(() => {
    unsavedSessionIdsRef.current = unsavedSessionIds;
  }, [unsavedSessionIds]);

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
          router.push('/admin/login');
          return;
        }

        if (!routeSessionId) {
          router.replace('/admin/ai-assistant');
          return;
        }

        // load sessions via shared hook and validate against the freshly loaded list
        const loadedSessions = await loadSessions();
        const matchedSession = loadedSessions.activeSessions.find((s: ChatSession) => s.id === routeSessionId)
          || loadedSessions.archivedSessions.find((s: ChatSession) => s.id === routeSessionId);
        if (matchedSession) {
          setCurrentSessionId(routeSessionId);
          setInvalidSessionId(false);
        } else {
          setCurrentSessionId('');
          setInvalidSessionId(true);
        }

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Error initializing session:', error);

        if (!isMounted) return;

        // Don't retry on auth errors
        if (error?.status === 401 || error?.status === 403) {
          router.push('/admin/login');
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
  }, [router, routeSessionId]);

  const handleNewChat = useCallback(() => {
    router.push('/admin/ai-assistant');
  }, [router]);

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
              .from('admins')
              .select('school_id')
              .eq('user_id', session.user.id)
              .maybeSingle();

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
              // Refresh sessions from DB
              await loadSessions();

              // Update current session ID to real ID
              setCurrentSessionId(newSession.id);
              router.replace(`/admin/ai-assistant/${newSession.id}`);

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
  }, [currentSessionId, sessions, unsavedSessionIds, router]);

  const handleTitleGenerated = useCallback(async (sessionId: string, generatedTitle: string) => {
    if (!sessionId) {
      return;
    }
    try {
      await renameSession(sessionId, generatedTitle);

      if (sessionId === currentSessionId) {
        setCurrentSessionId(sessionId);
      }
    } catch (err) {
      console.error('Error updating session title:', err);
    }
  }, [currentSessionId, renameSession]);

  const handleSessionIdChange = useCallback((newSessionId: string) => {
    if (!newSessionId) return;
    setCurrentSessionId(newSessionId);
    setInvalidSessionId(false);
    if (newSessionId !== routeSessionId) {
      router.replace(`/admin/ai-assistant/${newSessionId}`);
    }
  }, [routeSessionId, router]);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await deleteSession(id);
      // if deleting current session, navigate to first available or clear
      if (currentSessionId === id) {
        if (sessions.length > 0) {
          const next = sessions.find((s) => s.id !== id);
          if (next) {
            setCurrentSessionId(next.id);
            router.push(`/admin/ai-assistant/${next.id}`);
          } else {
            setCurrentSessionId('');
          }
        } else {
          setCurrentSessionId('');
        }
      }
      await loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }, [currentSessionId, sessions, deleteSession, loadSessions, router]);

  const handlePermanentDelete = useCallback(async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Permanently Delete Conversation',
      description: 'This action cannot be undone. The conversation will be permanently removed.',
      isDestructive: true,
      onConfirm: async () => {
        try {
          setLoadingActionId(id);
          await permanentDelete(id);
          setOpenDropdownId(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await loadSessions();
        } catch (error) {
          console.error('Error permanently deleting session:', error);
          alert('Failed to delete session. Please try again.');
        } finally {
          setLoadingActionId(null);
        }
      },
    });
  }, [permanentDelete, loadSessions]);

  const handleRenameSession = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setIsRenamingSession(true);
    try {
      await renameSession(id, newTitle);
      setRenameSessionId(null);
      setRenameValue('');
      setOpenDropdownId(null);
    } catch (err) {
      console.error('Error renaming session:', err);
    } finally {
      setIsRenamingSession(false);
    }
  }, [renameSession]);

  const handlePinSession = useCallback(async (id: string, isPinned?: boolean) => {
    try {
      setLoadingActionId(id);
      await pinSession(id, isPinned);
      setOpenDropdownId(null);
      await loadSessions();
    } catch (error) {
      console.error('Error pinning session:', error);
      alert('Failed to pin session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [pinSession, loadSessions]);

  const handleArchiveSession = useCallback(async (id: string) => {
    try {
      setLoadingActionId(id);
      await archiveSession(id);
      setOpenDropdownId(null);
      await loadSessions();
    } catch (error) {
      console.error('Error archiving session:', error);
      alert('Failed to archive session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [archiveSession, loadSessions]);

  const handleUnarchiveSession = useCallback(async (id: string) => {
    try {
      setLoadingActionId(id);
      await unarchiveSession(id);
      setOpenArchivedDropdownId(null);
      setShowArchived(false);
      await loadSessions();
    } catch (error) {
      console.error('Error unarchiving session:', error);
      alert('Failed to unarchive session. Please try again.');
    } finally {
      setLoadingActionId(null);
    }
  }, [unarchiveSession, loadSessions]);

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
          router.push('/admin/login');
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
          await clearAllArchived();
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
    exportAsJSON();
    setShowSettings(false);
    alert('Chat history exported successfully!');
  }, [exportAsJSON]);

  const handleDeleteAllChatHistory = useCallback(async () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete All Chat History',
      description: 'This will permanently delete ALL conversations, messages, and archived chats. This action cannot be undone.',
      isDestructive: true,
      onConfirm: async () => {
        setIsDeletingAll(true);
        try {
          await deleteAllChatHistory();
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
  }, [deleteAllChatHistory]);

  const handleToggleAutoCollapse = useCallback(() => {
    const newValue = !isAutoCollapsSidebar;
    setIsAutoCollapseSidebar(newValue);
    localStorage.setItem('aiAssistant_autoCollapseSidebar', String(newValue));
  }, [isAutoCollapsSidebar]);

  const loadUsageSummary = useCallback(async () => {
    try {
      setIsLoadingUsage(true);
      const response = await fetch('/api/ai-assistant/usage');
      const data = await response.json();

      if (data?.success && data?.usage) {
        setUsageSummary(data.usage);
      }
    } catch (error) {
      console.error('Error loading AI usage summary:', error);
    } finally {
      setIsLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    if (showSettings) {
      loadUsageSummary();
    }
  }, [showSettings, loadUsageSummary]);

  // Ensure valid session is selected when closing modals
  const handleCloseArchived = useCallback(() => {
    setShowArchived(false);
    setOpenArchivedDropdownId(null);

    // If current session is no longer in active sessions, switch to first active session
    if (currentSessionId && !sessions.find(s => s.id === currentSessionId)) {
      if (sessions.length > 0) {
        setCurrentSessionId(sessions[0].id);
        router.push(`/admin/ai-assistant/${sessions[0].id}`);
      }
    }
  }, [currentSessionId, sessions, router]);

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

  return (
    <div className="flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden">
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
              <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-slate-200">Daily Token Usage</p>
                  <p className="text-xs text-slate-400">
                    {isLoadingUsage ? 'Loading...' : usageSummary?.usageDate || new Date().toISOString().slice(0, 10)}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-slate-900/50 border border-slate-600 p-2">
                    <p className="text-slate-400">Used</p>
                    <p className="text-white font-semibold">{usageSummary ? usageSummary.tokensUsed.toLocaleString() : '0'}</p>
                  </div>
                  <div className="rounded-md bg-slate-900/50 border border-slate-600 p-2">
                    <p className="text-slate-400">Remaining</p>
                    <p className="text-white font-semibold">{usageSummary ? usageSummary.remainingTokens.toLocaleString() : '0'}</p>
                  </div>
                  <div className="rounded-md bg-slate-900/50 border border-slate-600 p-2">
                    <p className="text-slate-400">Limit</p>
                    <p className="text-white font-semibold">{usageSummary ? usageSummary.quotaLimit.toLocaleString() : '0'}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Resets at {usageSummary ? new Date(usageSummary.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00'} UTC
                </p>
              </div>

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

              <button
                onClick={handleCloseArchived}
                className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Archive className="h-4 w-4 text-amber-400" />
                  <p className="text-sm font-medium text-slate-200">View Archived</p>
                </div>
                <p className="text-xs text-slate-400 ml-6">{archivedSessions.length} archived conversation{archivedSessions.length !== 1 ? 's' : ''}</p>
              </button>

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
      {/* Shared Sidebar */}
      <AIAssistantSidebar
        sessions={sessions}
        archivedSessions={archivedSessions}
        currentSessionId={currentSessionId}
        showSidebar={showSidebar}
        onNewChat={handleNewChat}
        onSessionClick={(id) => {
          setCurrentSessionId(id);
          setInvalidSessionId(false);
          setOpenDropdownId(null);
          router.push(`/admin/ai-assistant/${id}`);
        }}
        onOpenSettings={() => setShowSettings(true)}
        onRenameSession={handleRenameSession}
        onPinSession={handlePinSession}
        onArchiveSession={handleArchiveSession}
        onDeleteSession={handleDeleteSession}
        onOpenArchived={() => setShowArchived(true)}
      />

      {/* Archived Sessions Modal */}
      {showArchived && (
        <div
          className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3"
          onClick={handleCloseArchived}
        >
          <div
            className="bg-[#0e1524] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl z-[60] flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-[#0f172a]">
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
            <div className="p-6 border-t border-white/10 bg-[#0f172a]/70">
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
        <div className="border-b border-white/10 bg-[#0f1420]/90 backdrop-blur-xl px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setShowSidebar(!showSidebar)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition-colors hover:bg-white/10"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-400 shadow-lg shadow-blue-500/20">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-white">School Deck AI</h1>
                  <p className="truncate text-sm text-slate-400">Ask questions, get data answers</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Live
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-right">
                <p className="text-xs font-medium text-slate-200">{sessions.length} conversation{sessions.length !== 1 ? 's' : ''}</p>
                <p className="text-[11px] text-slate-400">Session active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 overflow-hidden">
          {invalidSessionId ? (
            <div className="h-full flex items-center justify-center text-slate-300">
              <div className="text-center space-y-4">
                <p className="text-lg font-semibold text-white">Conversation not found</p>
                <p className="text-sm text-slate-400">This chat does not exist or is no longer available.</p>
                <Button
                  onClick={handleNewChat}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start a new chat
                </Button>
              </div>
            </div>
          ) : currentSessionId && currentSession ? (
            <AIAssistantChat
              key={currentSessionId}
              sessionId={currentSessionId}
              onMessagesUpdate={handleMessagesUpdate}
              onGeneratedTitle={handleTitleGenerated}
              onSessionIdChange={handleSessionIdChange}
              welcomeMessage="👋 Welcome to School Deck AI! I'm here to help you analyze your school data. Ask me anything about students, classes, grades, attendance, teachers, and more."
              placeholder="Ask me anything about your school data..."
              suggestedQuestions={[
                'How many students are enrolled?',
                'Show students with low attendance',
                'Average grades by class',
                'Which teacher has the most classes assigned?',
              ]}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
             
            </div>
          )}
        </div>
      </div>
    </div>

  );
}
