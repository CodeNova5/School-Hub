"use client";

import React, { useState } from 'react';
import { MessageSquare, Plus, Settings, LogOut, Clock, Pin, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SessionItem {
  id: string;
  title: string;
  updatedAt?: Date | string;
  isPinned?: boolean;
}

interface ShellProps {
  children: React.ReactNode;
  sessions: SessionItem[];
  archivedSessions: SessionItem[];
  isLoadingSessions?: boolean;
  showSidebar?: boolean;
  onNewChat?: () => void;
  onSelectSession?: (id: string) => void;
  onLogout?: () => void;
  onToggleAutoCollapse?: () => void;
  onUnarchive?: (id: string) => Promise<void>;
}

export default function AIAssistantShell({
  children,
  sessions,
  archivedSessions,
  isLoadingSessions = false,
  showSidebar = true,
  onNewChat,
  onSelectSession,
  onLogout,
  onToggleAutoCollapse,
  onUnarchive,
}: ShellProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="flex h-screen w-screen bg-[#090d16] text-slate-100 overflow-hidden">
      <div className={`${showSidebar ? 'w-80' : 'w-0'} bg-[#0e1524] border-r border-white/10 flex flex-col transition-all duration-300 overflow-hidden shadow-2xl`}>
        <div className="p-4 border-b border-white/10">
          <Button onClick={onNewChat} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold gap-2 h-10 shadow-lg hover:shadow-xl transition-all">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 p-6">
          <ScrollArea className="h-full">
            <div className="space-y-2 p-2">
              {isLoadingSessions ? (
                <div className="py-8 text-center text-slate-400">Loading conversations...</div>
              ) : sessions.length === 0 ? (
                <div className="h-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center flex items-center justify-center">
                  <p className="text-sm text-slate-400">No conversations yet — send your first message.</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} onClick={() => onSelectSession?.(session.id)} className="group p-3 rounded-lg cursor-pointer transition-all duration-200 bg-slate-700 hover:bg-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-slate-200" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate text-slate-100">{session.title}</p>
                          <p className="text-xs text-slate-400">{session.updatedAt instanceof Date ? session.updatedAt.toLocaleString() : ''}</p>
                        </div>
                      </div>
                      {session.isPinned && <Pin className="h-4 w-4 text-amber-400" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button onClick={() => setShowArchived(true)} className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Archive className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-medium text-slate-200">View Archived</p>
            </div>
            <p className="text-xs text-slate-400 ml-6">{archivedSessions.length} archived conversation{archivedSessions.length !== 1 ? 's' : ''}</p>
          </button>

          <button onClick={() => setShowSettings(true)} className="w-full flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200 rounded-lg transition-all border border-slate-600 hover:border-slate-500">
            <Settings className="h-4 w-4" />
            <span className="text-sm font-medium">Settings</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden"> 
        <div className="border-b border-white/10 bg-[#0f1420]/90 backdrop-blur-xl px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-400 shadow-lg shadow-blue-500/20">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-white">School Deck AI</h1>
                <p className="truncate text-sm text-slate-400">Ask questions, get data answers</p>
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

        <div className="flex-1 overflow-hidden">{children}</div>
      </div>

      {/* Archived modal */}
      {showArchived && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3" onClick={() => setShowArchived(false)}>
          <div className="bg-[#0e1524] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl z-[60] flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
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
                <span className="px-3 py-1.5 bg-amber-500/30 text-amber-200 rounded-full text-sm font-semibold">{archivedSessions.length}</span>
              </div>
            </div>

            <ScrollArea className="flex-1 [&_[data-radix-scroll-area-thumb]]:hidden">
              <div className="p-6 space-y-3">
                {archivedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Archive className="h-12 w-12 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-400 text-center">No archived conversations yet</p>
                  </div>
                ) : (
                  archivedSessions.map((s) => (
                    <div key={s.id} className="group p-4 rounded-lg cursor-pointer transition-all duration-200 border bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:border-slate-500">
                      <div className="flex items-start gap-3 justify-between">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mt-1">
                            <MessageSquare className={`h-5 w-5 flex-shrink-0 text-slate-400`} />
                            <Archive className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold truncate mb-2 text-slate-100">{s.title}</h3>
                            <div className="text-sm text-slate-400">
                              <Clock className="h-4 w-4 inline-block mr-2" />
                              <span>{s.updatedAt instanceof Date ? s.updatedAt.toLocaleString() : ''}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => onUnarchive && onUnarchive(s.id)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded">Unarchive</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-6 border-t border-white/10 bg-[#0f172a]/70">
              <button onClick={() => setShowArchived(false)} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
