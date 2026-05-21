"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  isPinned?: boolean;
  isArchived?: boolean;
}

export default function useAIAssistantSessions() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [archivedSessions, setArchivedSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unsavedSessionIds, setUnsavedSessionIds] = useState<Set<string>>(new Set());
  const unsavedRef = useRef(unsavedSessionIds);

  useEffect(() => {
    unsavedRef.current = unsavedSessionIds;
  }, [unsavedSessionIds]);

  const loadSessions = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return { activeSessions: [], archivedSessions: [] };

      const { data: dbSessions, error } = await supabase
        .from('ai_chat_sessions')
        .select('id, title, created_at, updated_at, is_pinned, is_archived, deleted_at')
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(50);

      if (!error && dbSessions) {
        const active = dbSessions
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

        setSessions(active);
        setArchivedSessions(archived);
        return { activeSessions: active, archivedSessions: archived };
      } else {
        setSessions([]);
        setArchivedSessions([]);
        return { activeSessions: [], archivedSessions: [] };
      }
    } catch (err) {
      console.error('Failed to load chat sessions', err);
      return { activeSessions: [], archivedSessions: [] };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const renameSession = useCallback(async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      if (!unsavedRef.current.has(id)) {
        await supabase
          .from('ai_chat_sessions')
          .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: newTitle.trim(), updatedAt: new Date() } : s)));
      setArchivedSessions((prev) => prev.map((s) => (s.id === id ? { ...s, title: newTitle.trim(), updatedAt: new Date() } : s)));
    } catch (err) {
      console.error('Error renaming session', err);
    }
  }, []);

  const pinSession = useCallback(async (id: string, isPinned?: boolean) => {
    try {
      await supabase
        .from('ai_chat_sessions')
        .update({ is_pinned: !isPinned, updated_at: new Date().toISOString() })
        .eq('id', id);

      setSessions((prev) => {
        const updated = prev.map((session) => (session.id === id ? { ...session, isPinned: !isPinned, updatedAt: new Date() } : session));
        return updated.sort((a, b) => {
          if (a.isPinned !== b.isPinned) {
            return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
          }
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      });
    } catch (err) {
      console.error('Error pinning session', err);
    }
  }, []);

  const archiveSession = useCallback(async (id: string) => {
    try {
      // Clear local flag
      localStorage.removeItem(`aiAssistant_sessionMessages_${id}`);

      if (unsavedRef.current.has(id)) {
        setUnsavedSessionIds((prev) => {
          const updated = new Set(prev);
          updated.delete(id);
          return updated;
        });

        setSessions((prev) => prev.filter((s) => s.id !== id));
      } else {
        await supabase.from('ai_chat_sessions').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
        const archived = sessionsRef.current?.find((s: any) => s.id === id);
        // We'll refresh the list after archiving
        await loadSessions();
      }
    } catch (err) {
      console.error('Error archiving session', err);
    }
  }, [loadSessions]);

  const unarchiveSession = useCallback(async (id: string) => {
    try {
      await supabase.from('ai_chat_sessions').update({ is_archived: false, updated_at: new Date().toISOString() }).eq('id', id);
      await loadSessions();
      // navigate to session
      router.push(`/admin/ai-assistant/${id}`);
    } catch (err) {
      console.error('Error unarchiving session', err);
    }
  }, [loadSessions, router]);

  const deleteSession = useCallback(async (id: string) => {
    try {
      localStorage.removeItem(`aiAssistant_sessionMessages_${id}`);
      if (!unsavedRef.current.has(id)) {
        await supabase.from('ai_chat_sessions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      }
      setUnsavedSessionIds((prev) => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error deleting session', err);
    }
  }, []);

  const permanentDelete = useCallback(async (id: string) => {
    try {
      localStorage.removeItem(`aiAssistant_sessionMessages_${id}`);
      if (!unsavedRef.current.has(id)) {
        await supabase.from('ai_chat_sessions').delete().eq('id', id);
      }
      setUnsavedSessionIds((prev) => {
        const updated = new Set(prev);
        updated.delete(id);
        return updated;
      });
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setArchivedSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error permanently deleting session', err);
    }
  }, []);

  const clearAllArchived = useCallback(async () => {
    try {
      const archivedIds = archivedSessions.map((s) => s.id);
      archivedIds.forEach((id) => localStorage.removeItem(`aiAssistant_sessionMessages_${id}`));
      const savedArchivedIds = archivedIds.filter((id) => !unsavedRef.current.has(id));
      if (savedArchivedIds.length > 0) {
        await supabase.from('ai_chat_sessions').delete().in('id', savedArchivedIds);
      }
      setArchivedSessions([]);
    } catch (err) {
      console.error('Error clearing archived', err);
    }
  }, [archivedSessions]);

  const exportAsJSON = useCallback(() => {
    try {
      const exportData = { exportDate: new Date().toISOString(), totalSessions: sessions.length + archivedSessions.length, activeSessions: sessions, archivedSessions };
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
    } catch (err) {
      console.error('Error exporting', err);
    }
  }, [sessions, archivedSessions]);

  const deleteAllChatHistory = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: allSessions } = await supabase.from('ai_chat_sessions').select('id').eq('user_id', session.user.id);
      if (allSessions && allSessions.length > 0) {
        const sessionIds = allSessions.map((s: any) => s.id);
        sessionIds.forEach((id: any) => localStorage.removeItem(`aiAssistant_sessionMessages_${id}`));
        await supabase.from('ai_chat_messages').delete().in('session_id', sessionIds);
        await supabase.from('ai_chat_sessions').delete().in('id', sessionIds);
      }
      setSessions([]);
      setArchivedSessions([]);
      setUnsavedSessionIds(new Set());
    } catch (err) {
      console.error('Error deleting all chat history', err);
    }
  }, []);

  // keep a ref for sessions if needed in some callbacks
  const sessionsRef = useRef<ChatSession[] | null>(null);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    archivedSessions,
    isLoading,
    unsavedSessionIds,
    setUnsavedSessionIds,
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
  };
}
