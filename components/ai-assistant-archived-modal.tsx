import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Archive, MessageSquare, Clock, MoreVertical, Edit2, Trash } from 'lucide-react';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date | string;
  isPinned?: boolean;
  isArchived?: boolean;
}

type Props = {
  open: boolean;
  archivedSessions: ChatSession[];
  currentSessionId?: string;
  loadingActionId?: string | null;
  onClose: () => void;
  onUnarchive: (id: string) => Promise<void> | void;
  onPermanentDelete: (id: string) => Promise<void> | void;
  onSetCurrentSession?: (id: string) => void;
  onRename?: (id: string, newTitle: string) => Promise<void> | void;
};

export default function AIAssistantArchivedModal({
  open,
  archivedSessions,
  currentSessionId,
  loadingActionId,
  onClose,
  onUnarchive,
  onPermanentDelete,
  onSetCurrentSession,
  onRename,
}: Props) {
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl w-full max-w-4xl xl:max-w-5xl h-[85vh] max-h-[85vh] border border-slate-700 shadow-2xl z-[60] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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

        <ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-thumb]]:hidden">
          <div className="p-6 space-y-4">
            {archivedSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Archive className="h-12 w-12 text-slate-600 mb-3" />
                <p className="text-sm text-slate-400 text-center">No archived conversations yet</p>
              </div>
            ) : (
              archivedSessions.map((session) => (
                <div key={session.id} className="relative">
                  {renameSessionId === session.id && (
                    <div
                      className="fixed inset-0 bg-slate-900/80 z-40 flex items-center justify-center p-3"
                      onClick={() => {
                        setRenameSessionId(null);
                        setRenameValue('');
                      }}
                    >
                      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-sm border border-slate-700 shadow-xl z-50" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-white font-semibold mb-4 text-lg">Rename Conversation</h2>
                        <input
                          autoFocus
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && onRename && renameSessionId) {
                              setIsRenaming(true);
                              Promise.resolve(onRename(renameSessionId, renameValue)).finally(() => {
                                setIsRenaming(false);
                                setRenameSessionId(null);
                                setRenameValue('');
                              });
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
                            onClick={() => {
                              if (!onRename || !renameSessionId) return;
                              setIsRenaming(true);
                              Promise.resolve(onRename(renameSessionId, renameValue)).finally(() => {
                                setIsRenaming(false);
                                setRenameSessionId(null);
                                setRenameValue('');
                              });
                            }}
                            disabled={isRenaming || !renameValue.trim()}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {isRenaming ? 'Saving...' : 'Save'}
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

                  <div
                    onClick={() => {
                      onSetCurrentSession?.(session.id);
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
                            className={`h-5 w-5 flex-shrink-0 ${currentSessionId === session.id ? 'text-white' : 'text-slate-400'}`}
                          />
                          <Archive className="h-4 w-4 flex-shrink-0 text-amber-400" fill="currentColor" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-base font-semibold truncate mb-2 ${currentSessionId === session.id ? 'text-white' : 'text-slate-100'}`}>
                            {session.title}
                          </h3>
                          <div className={`text-sm flex items-center gap-2 ${currentSessionId === session.id ? 'text-blue-100' : 'text-slate-400'}`}>
                            <Clock className="h-4 w-4 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {session.updatedAt instanceof Date ? session.updatedAt.toLocaleString() : new Date(session.updatedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // toggle small menu by setting rename id — consumer can handle dropdown state if needed
                            setRenameSessionId(renameSessionId === session.id ? null : renameSessionId);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-600/50 rounded-lg"
                        >
                          <MoreVertical className={`h-5 w-5 ${currentSessionId === session.id ? 'text-blue-100' : 'text-slate-300'}`} />
                        </button>

                        <div className="absolute right-0 top-full mt-2 w-56 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-[100] overflow-hidden">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameSessionId(session.id);
                              setRenameValue(session.title);
                            }}
                            disabled={loadingActionId === session.id}
                            className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors border-b border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Edit2 className="h-4 w-4" />
                            <span>{loadingActionId === session.id ? 'Processing...' : 'Rename'}</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnarchive(session.id);
                            }}
                            disabled={loadingActionId === session.id}
                            className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-slate-600 flex items-center gap-3 transition-colors border-b border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Archive className="h-4 w-4" />
                            <span>{loadingActionId === session.id ? 'Processing...' : 'Unarchive'}</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPermanentDelete(session.id);
                            }}
                            disabled={loadingActionId === session.id}
                            className="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-red-900/30 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash className="h-4 w-4" />
                            <span>{loadingActionId === session.id ? 'Processing...' : 'Delete Permanently'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-6 border-t border-slate-700 bg-gradient-to-r from-slate-800/50 to-slate-700/50">
          <button onClick={onClose} className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold shadow-lg hover:shadow-xl">Close</button>
        </div>
      </div>
    </div>
  );
}
