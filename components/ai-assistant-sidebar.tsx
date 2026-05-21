"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Plus, MoreVertical, Clock, Pin, Settings, Edit2, Archive, Trash } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  updatedAt: Date | string;
  isPinned?: boolean;
  isArchived?: boolean;
}

interface SidebarProps {
  sessions?: ChatSession[];
  archivedSessions?: ChatSession[];
  currentSessionId?: string;
  showSidebar?: boolean;
  onNewChat?: () => void;
  onSessionClick?: (id: string) => void;
  onOpenSettings?: () => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onPinSession?: (id: string, isPinned?: boolean) => void;
  onArchiveSession?: (id: string) => void;
  onDeleteSession?: (id: string) => void;
  onOpenArchived?: () => void;
}

export default function AIAssistantSidebar({
  sessions = [],
  archivedSessions = [],
  currentSessionId,
  showSidebar = true,
  onNewChat,
  onSessionClick,
  onOpenSettings,
  onRenameSession,
  onPinSession,
  onArchiveSession,
  onDeleteSession,
  onOpenArchived,
}: SidebarProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) {
        setOpenDropdownId(null);
        return;
      }

      if (openDropdownId && !target.closest(`[data-session-dropdown="${openDropdownId}"]`)) {
        setOpenDropdownId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);
  return (
    <div className={`${showSidebar ? 'w-80' : 'w-0'} bg-[#0e1524] border-r border-white/10 flex flex-col transition-all duration-300 overflow-hidden shadow-2xl`}>
      <div className="p-4 border-b border-white/10">
        <Button
          onClick={onNewChat}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold gap-2 h-10 shadow-lg hover:shadow-xl transition-all"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No conversations yet</p>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="relative">
                <div
                  onClick={() => onSessionClick?.(session.id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${currentSessionId === session.id
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg'
                      : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                >
                  <div className="flex items-start gap-2 justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <div className="flex items-center gap-1 mt-0.5">
                        <MessageSquare
                          className={`h-4 w-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-white' : 'text-slate-400'}`}
                        />
                        {session.isPinned && (
                          <Pin className={`h-3 w-3 flex-shrink-0 ${currentSessionId === session.id ? 'text-yellow-300' : 'text-yellow-400'}`} fill="currentColor" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-medium truncate ${currentSessionId === session.id ? 'text-white' : 'text-slate-200'}`}>
                          {session.title}
                        </h3>
                        <div className={`text-xs flex items-center gap-1 mt-1 flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-100' : 'text-slate-400'}`}>
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="whitespace-nowrap">
                            {session.updatedAt instanceof Date
                              ? session.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                              : new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative" data-session-dropdown={session.id}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId((current) => (current === session.id ? null : session.id));
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600/50 rounded"
                        aria-haspopup="true"
                        aria-expanded={openDropdownId === session.id}
                      >
                        <MoreVertical className={`h-4 w-4 ${currentSessionId === session.id ? 'text-blue-100' : 'text-slate-300'}`} />
                      </button>

                      {openDropdownId === session.id && (
                        <div className="z-50 relative right-0 top-full mt-2 w-44 bg-slate-700 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newTitle = prompt('Rename conversation', session.title || '');
                              if (newTitle !== null && newTitle.trim() !== '') {
                                onRenameSession?.(session.id, newTitle.trim());
                              }
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                            Rename
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPinSession?.(session.id, session.isPinned);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors"
                          >
                            <Pin className="h-4 w-4" />
                            {session.isPinned ? 'Unpin' : 'Pin'}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const ok = confirm('Archive this conversation? You can restore it from the Archived list.');
                              if (ok) onArchiveSession?.(session.id);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors"
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const ok = confirm('Delete this conversation? This will remove local copies and, if saved, mark it deleted.');
                              if (ok) onDeleteSession?.(session.id);
                              setOpenDropdownId(null);
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-900/30 flex items-center gap-3 transition-colors"
                          >
                            <Trash className="h-4 w-4" />
                            Delete
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

      <div className="p-4 border-t border-white/10 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => onOpenArchived?.()}
            className="flex-1 px-3 py-2 bg-slate-700/60 hover:bg-slate-700 rounded-lg text-sm text-slate-200 border border-slate-600"
          >
            Archived
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200 rounded-lg transition-all border border-slate-600 hover:border-slate-500"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
