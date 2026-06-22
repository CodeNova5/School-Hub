"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Clock,
  FileText,
  Plus,
  PencilLine,
  Trash2,
  Sparkles,
  Printer,
  Save,
  Download,
  Copy,
  FolderKanban,
  Settings2,
  Search,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────

type AuditLogRecord = {
  id: string;
  bank_id: string;
  school_id: string;
  action: string;
  actor_id: string;
  actor_role: 'teacher' | 'admin';
  actor_name?: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

type ActiveFilter = 'all' | 'question_created' | 'question_updated' | 'question_deleted' | 'question_generated' | 'question_duplicated' | 'exam_printed' | 'exam_config_saved' | 'exam_config_loaded' | 'bank_updated' | 'group_created' | 'group_updated' | 'group_deleted';

// ─── Action config ────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  bank_created: {
    label: 'Bank Created',
    icon: <Plus className="w-3.5 h-3.5" />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  bank_updated: {
    label: 'Bank Updated',
    icon: <Settings2 className="w-3.5 h-3.5" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  question_created: {
    label: 'Question Created',
    icon: <Plus className="w-3.5 h-3.5" />,
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  question_updated: {
    label: 'Question Edited',
    icon: <PencilLine className="w-3.5 h-3.5" />,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  question_deleted: {
    label: 'Question Deleted',
    icon: <Trash2 className="w-3.5 h-3.5" />,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  question_generated: {
    label: 'Questions Generated',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  question_duplicated: {
    label: 'Question Duplicated',
    icon: <Copy className="w-3.5 h-3.5" />,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  },
  exam_printed: {
    label: 'Exam Printed',
    icon: <Printer className="w-3.5 h-3.5" />,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  exam_config_saved: {
    label: 'Exam Config Saved',
    icon: <Save className="w-3.5 h-3.5" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  exam_config_loaded: {
    label: 'Exam Config Loaded',
    icon: <Download className="w-3.5 h-3.5" />,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  },
  exam_config_deleted: {
    label: 'Exam Config Deleted',
    icon: <Trash2 className="w-3.5 h-3.5" />,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  group_created: {
    label: 'Topic Group Created',
    icon: <FolderKanban className="w-3.5 h-3.5" />,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  group_updated: {
    label: 'Topic Group Updated',
    icon: <PencilLine className="w-3.5 h-3.5" />,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  group_deleted: {
    label: 'Topic Group Deleted',
    icon: <Trash2 className="w-3.5 h-3.5" />,
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

// ─── Props ────────────────────────────────────────────────

interface QuestionBankAuditProps {
  role: 'admin' | 'teacher';
}

// ─── Helpers ──────────────────────────────────────────────

function formatDateTime(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function getActionSummary(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case 'question_created':
      return `Created question${details.count ? ` (${details.count})` : ''}`;
    case 'question_updated': {
      const fields = details.changedFields as string[] | undefined;
      return fields?.length ? `Edited: ${fields.join(', ')}` : 'Edited question';
    }
    case 'question_deleted':
      return `Deleted question${details.topic ? ` — ${details.topic}` : ''}`;
    case 'question_generated':
      return `Generated ${details.count || '?'} question${(details.count as number) !== 1 ? 's' : ''}`;
    case 'question_duplicated':
      return `Duplicated question${details.count ? ` (${details.count})` : ''}`;
    case 'exam_printed':
      return `Printed exam${details.term ? ` (Term ${details.term})` : ''}${details.totalQuestions ? ` — ${details.totalQuestions} questions` : ''}`;
    case 'exam_config_saved':
      return `Saved exam config${details.term ? ` (Term ${details.term})` : ''}`;
    case 'exam_config_loaded':
      return `Loaded exam config${details.term ? ` (Term ${details.term})` : ''}`;
    case 'exam_config_deleted':
      return `Deleted exam config${details.term ? ` (Term ${details.term})` : ''}`;
    case 'bank_updated':
      return `Updated bank settings`;
    case 'group_created':
      return `Created topic group${details.title ? ` — ${details.title}` : ''}`;
    case 'group_updated':
      return `Updated topic group${details.title ? ` — ${details.title}` : ''}`;
    case 'group_deleted':
      return `Deleted topic group${details.title ? ` — ${details.title}` : ''}`;
    default:
      return action.replace(/_/g, ' ');
  }
}

// ─── Main Component ───────────────────────────────────────

export function QuestionBankAudit({ role }: QuestionBankAuditProps) {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const apiPrefix = `/api/${role}/question-bank`;
  const routePrefix = `/${role}/question-bank`;

  const [isLoading, setIsLoading] = useState(true);
  const [bank, setBank] = useState<{ title: string } | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const LIMIT = 50;

  useEffect(() => {
    if (bankId) {
      loadBank();
      loadLogs();
    }
  }, [bankId]);

  useEffect(() => {
    if (bankId) {
      setCurrentPage(0);
      loadLogs();
    }
  }, [activeFilter]);

  async function loadBank() {
    try {
      const res = await fetch(`${apiPrefix}/banks/${bankId}`);
      if (res.ok) {
        const data = await res.json();
        setBank(data.bank);
      }
    } catch {
      // ignore
    }
  }

  async function loadLogs() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(LIMIT));
      params.set('offset', String(currentPage * LIMIT));
      if (activeFilter !== 'all') {
        params.set('action', activeFilter);
      }

      const res = await fetch(`${apiPrefix}/banks/${bankId}/audit-logs?${params}`);
      if (!res.ok) {
        toast.error('Failed to load audit logs');
        return;
      }

      const data = await res.json();
      setLogs(data.logs || []);
      setTotalCount(data.total || 0);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const summary = getActionSummary(log.action, log.details).toLowerCase();
      const actor = (log.actor_name || '').toLowerCase();
      return summary.includes(q) || actor.includes(q);
    });
  }, [logs, searchQuery]);

  // ── Actions list ──

  const actionFilters: { key: ActiveFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All Activity', count: totalCount },
    { key: 'question_created', label: 'Created', count: 0 },
    { key: 'question_updated', label: 'Edited', count: 0 },
    { key: 'question_deleted', label: 'Deleted', count: 0 },
    { key: 'question_generated', label: 'Generated', count: 0 },
    { key: 'exam_printed', label: 'Printed', count: 0 },
    { key: 'exam_config_saved', label: 'Config Saved', count: 0 },
  ];

  // ── Render ──

  return (
    <DashboardLayout role={role}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-12">

        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push(`${routePrefix}/${bankId}`)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Go back to bank"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>
                  <p className="text-sm text-slate-500">{bank?.title || 'Question Bank'}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {totalCount} event{totalCount !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Search and filter summary */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search activity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              Showing page {currentPage + 1} of {totalPages} ({totalCount} total)
            </div>
          </div>

          {/* Action filter chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {actionFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                  ${activeFilter === f.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  }
                `}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="text-center space-y-3">
                <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                <p className="text-sm text-gray-500 font-medium">Loading audit trail...</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && logs.length === 0 && (
            <Card className="border-slate-200">
              <CardContent className="py-16 text-center">
                <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Activity Yet</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Actions like creating, editing, or printing questions will appear here as you use the question bank.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Audit log entries */}
          {!isLoading && filteredLogs.length > 0 && (
            <Card className="border-slate-200">
              <CardContent className="p-0 divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const config = ACTION_CONFIG[log.action] || {
                    label: log.action.replace(/_/g, ' '),
                    icon: <FileText className="w-3.5 h-3.5" />,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };

                  return (
                    <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                      {/* Action icon */}
                      <div className={`flex items-center justify-center w-9 h-9 rounded-xl border shrink-0 ${config.color}`}>
                        {config.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <Badge variant="outline" className={`text-[10px] font-semibold ${config.color}`}>
                            {config.label}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {formatDateTime(log.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">
                          {getActionSummary(log.action, log.details)}
                        </p>
                        {(log.details.questionText as string) && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {log.details.questionText as string}
                          </p>
                        )}
                      </div>

                      {/* Actor */}
                      <div className="shrink-0 text-right">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {log.actor_role === 'admin' ? 'Admin' : 'Teacher'}
                        </Badge>
                        {log.actor_name && (
                          <p className="text-[11px] text-slate-500 mt-0.5">{log.actor_name}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6">
              <p className="text-xs text-slate-500">
                Page {currentPage + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.max(0, p - 1));
                  }}
                  disabled={currentPage === 0}
                  className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i;
                  } else if (currentPage < 3) {
                    pageNum = i;
                  } else if (currentPage > totalPages - 4) {
                    pageNum = totalPages - 7 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[32px] h-8 px-2 rounded-md text-sm font-semibold transition-colors ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
                  }}
                  disabled={currentPage >= totalPages - 1}
                  className="p-2 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Link back */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`${routePrefix}/${bankId}`)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Bank
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
