import React from 'react';
import { Settings, Archive, Download, Trash2 as TrashIcon, Trash, LogOut } from 'lucide-react';

type Props = {
  open: boolean;
  archivedCount: number;
  isAutoCollapseSidebar: boolean;
  isClearingArchived?: boolean;
  isDeletingAll?: boolean;
  isLoggingOut?: boolean;
  onClose: () => void;
  onToggleAutoCollapse: () => void;
  onOpenArchived: () => void;
  onExport: () => void;
  onClearAllArchived: () => Promise<void> | void;
  onDeleteAllChatHistory: () => Promise<void> | void;
  onLogout: () => Promise<void> | void;
};

export default function AIAssistantSettings({
  open,
  archivedCount,
  isAutoCollapseSidebar,
  isClearingArchived,
  isDeletingAll,
  isLoggingOut,
  onClose,
  onToggleAutoCollapse,
  onOpenArchived,
  onExport,
  onClearAllArchived,
  onDeleteAllChatHistory,
  onLogout,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg p-5 w-full max-w-sm border border-slate-700 shadow-2xl z-[60]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Settings</h2>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isAutoCollapseSidebar} onChange={onToggleAutoCollapse} className="w-4 h-4 rounded accent-blue-500" />
              <div>
                <p className="text-sm font-medium text-slate-200">Auto-Collapse Sidebar</p>
                <p className="text-xs text-slate-400">Sidebar collapses on startup</p>
              </div>
            </label>
          </div>

          <button onClick={() => { onClose(); onOpenArchived(); }} className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Archive className="h-4 w-4 text-amber-400" />
              <p className="text-sm font-medium text-slate-200">View Archived</p>
            </div>
            <p className="text-xs text-slate-400 ml-6">{archivedCount} archived conversation{archivedCount !== 1 ? 's' : ''}</p>
          </button>

          <button onClick={onExport} className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-4 w-4 text-green-400" />
              <p className="text-sm font-medium text-slate-200">Export as JSON</p>
            </div>
            <p className="text-xs text-slate-400 ml-6">Download all chat history</p>
          </button>

          <button onClick={onClearAllArchived} disabled={isClearingArchived || archivedCount === 0} className="w-full p-3 text-left bg-red-900/20 border border-red-700/50 rounded-lg hover:bg-red-900/30 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center gap-2 mb-1">
              <TrashIcon className="h-4 w-4 text-red-400" />
              <p className="text-sm font-medium text-red-300">{isClearingArchived ? 'Clearing...' : 'Clear All Archived'}</p>
            </div>
            <p className="text-xs text-red-300/70 ml-6">Permanently delete all archived</p>
          </button>

          <button onClick={onDeleteAllChatHistory} disabled={isDeletingAll} className="w-full p-3 text-left bg-red-900/30 border border-red-700/50 rounded-lg hover:bg-red-900/40 hover:border-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center gap-2 mb-1">
              <Trash className="h-4 w-4 text-red-400" />
              <p className="text-sm font-medium text-red-300">{isDeletingAll ? 'Deleting...' : 'Delete All History'}</p>
            </div>
            <p className="text-xs text-red-300/70 ml-6">Permanently remove everything</p>
          </button>

          <button onClick={onLogout} disabled={isLoggingOut} className="w-full p-3 text-left bg-slate-700/50 border border-slate-600 rounded-lg hover:bg-slate-700 hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="flex items-center gap-2 mb-1">
              <LogOut className="h-4 w-4 text-slate-300" />
              <p className="text-sm font-medium text-slate-200">{isLoggingOut ? 'Signing out...' : 'Logout'}</p>
            </div>
            <p className="text-xs text-slate-400 ml-6">Sign out from your account</p>
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors font-medium text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}
