"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Plus, MoreVertical, Clock, Pin } from 'lucide-react';

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
}

export default function AIAssistantSidebar({
  sessions = [],
  archivedSessions = [],
  currentSessionId,
  showSidebar = true,
  onNewChat,
  onSessionClick,
  onOpenSettings,
}: SidebarProps) {
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

                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-600/50 rounded">
                      <MoreVertical className={`h-4 w-4 ${currentSessionId === session.id ? 'text-blue-100' : 'text-slate-300'}`} />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200 rounded-lg transition-all border border-slate-600 hover:border-slate-500"
        >
          <Settings className="h-4 w-4" />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
