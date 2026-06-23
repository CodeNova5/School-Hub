"use client";

import { useEffect, useState, KeyboardEvent, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FolderKanban, AlertCircle, PencilLine, Trash2, Plus, ArrowLeft, X,
  BookOpen, Calendar, Sparkles, Check, Save, Loader2, ChevronDown, ChevronUp,
  RefreshCw, Coffee
} from 'lucide-react';
import { toast } from 'sonner';

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                         */
/* ────────────────────────────────────────────────────────────────────────────── */

type WeekEntry = {
  week_number: number;
  topics: string[];
  is_break: boolean;
};

type SchemeRecord = {
  id: string;
  title: string;
  topics: string[];
  weeks: WeekEntry[];
  created_by_teacher_id?: string | null;
  created_by_admin_id?: string | null;
  created_at: string;
  term?: number;
};

type BankRecord = {
  id: string;
  title: string;
  subject_class_id: string;
  created_by_teacher_id?: string | null;
  created_by_admin_id?: string | null;
};

type ContextPayload = {
  userId?: string;
  teacherId?: string;
};

type BankPayload = {
  bank: BankRecord;
};

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                       */
/* ────────────────────────────────────────────────────────────────────────────── */

function buildDefaultWeeks(): WeekEntry[] {
  const weeks: WeekEntry[] = [];
  for (let w = 1; w <= 12; w++) {
    weeks.push({ week_number: w, topics: [], is_break: w === 6 });
  }
  return weeks;
}

function flattenTopics(weeks: WeekEntry[]): string[] {
  return (weeks || [])
    .filter((w) => !w.is_break)
    .flatMap((w) => w.topics || [])
    .filter(Boolean);
}

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getWeekLabel(week: WeekEntry): string {
  if (week.is_break) return 'Mid-Term Break';
  return `Week ${week.week_number}`;
}

function getTotalTopicCount(weeks: WeekEntry[]): number {
  return flattenTopics(weeks).length;
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Props                                                                         */
/* ────────────────────────────────────────────────────────────────────────────── */

interface QuestionBankGroupsProps {
  role: 'admin' | 'teacher';
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                                */
/* ────────────────────────────────────────────────────────────────────────────── */

function WeekCard({
  week,
  expanded,
  onToggle,
  onUpdateTopics,
  isEditable,
  saving,
}: {
  week: WeekEntry;
  expanded: boolean;
  onToggle: () => void;
  onUpdateTopics: (weekNumber: number, topics: string[]) => void;
  isEditable: boolean;
  saving: boolean;
}) {
  const [editTopics, setEditTopics] = useState(week.topics.join(', '));
  const [isEditing, setIsEditing] = useState(false);

  // Reset edit state when week data changes
  useEffect(() => {
    if (!isEditing) {
      setEditTopics(week.topics.join(', '));
    }
  }, [week.topics, isEditing]);

  function handleSave() {
    const parsed = editTopics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    // Deduplicate while preserving order
    const unique = [...new Set(parsed)];
    onUpdateTopics(week.week_number, unique);
    // Keep editing closed; the parent will close the expansion or the user
    // can tap again to see the saved result.
    setIsEditing(false);
  }

  function handleCancel() {
    setEditTopics(week.topics.join(', '));
    setIsEditing(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  if (week.is_break) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-200 bg-stone-50/50 p-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <Coffee className="h-6 w-6 text-stone-300" />
          <div>
            <p className="text-sm font-semibold text-stone-400">Week 6</p>
            <p className="text-xs text-stone-300 font-medium">Mid-Term Break</p>
          </div>
        </div>
      </div>
    );
  }

  const topicCount = week.topics.length;
  const isExpandedOrHasTopics = expanded || topicCount > 0;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        expanded
          ? 'border-amber-300 bg-amber-50/40 shadow-md ring-1 ring-amber-200/50'
          : topicCount > 0
            ? 'border-stone-200 bg-white hover:border-amber-200 hover:shadow-sm'
            : 'border-dashed border-stone-200 bg-stone-50/50 hover:border-stone-300'
      }`}
    >
      {/* Week header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
        disabled={!isEditable}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              topicCount > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-stone-100 text-stone-400'
            }`}
          >
            {week.week_number}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${
              topicCount > 0 ? 'text-stone-800' : 'text-stone-400'
            }`}>
              {getWeekLabel(week)}
            </p>
            {topicCount > 0 && (
              <p className="text-xs text-stone-500 mt-0.5">
                {topicCount} topic{topicCount !== 1 ? 's' : ''}
              </p>
            )}
            {topicCount === 0 && !expanded && (
              <p className="text-xs text-stone-400 mt-0.5">No topics set</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {topicCount > 0 && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 bg-white rounded-full px-2 py-0.5 border border-stone-200">
              {topicCount}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-amber-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-stone-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-amber-200/60 mt-0">
          {isEditing ? (
            <div className="space-y-2 mt-3">
              <div className="flex gap-2">
                <Input
                  value={editTopics}
                  onChange={(e) => setEditTopics(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Introduction to Algebra, Set Theory"
                  className="border-stone-200 focus-visible:ring-amber-500 text-sm h-9"
                  disabled={saving}
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-stone-400">Separate topics with commas. Press Enter to save.</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancel}
                  className="h-7 text-xs text-stone-500"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {topicCount > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {week.topics.map((topic, i) => (
                    <Badge
                      key={`${week.week_number}-topic-${i}`}
                      variant="secondary"
                      className="bg-white border border-stone-200 text-stone-700 text-xs rounded-full px-2.5 py-0.5"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">No topics yet</p>
              )}

              {isEditable && (
                <button
                  type="button"
                  onClick={() => {
                    setEditTopics(week.topics.join(', '));
                    setIsEditing(true);
                  }}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline transition-colors"
                >
                  {topicCount > 0 ? 'Edit topics' : 'Add topics'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Main Component                                                               */
/* ────────────────────────────────────────────────────────────────────────────── */

export function QuestionBankGroups({ role }: QuestionBankGroupsProps) {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const apiPrefix = `/api/${role}/question-bank`;
  const routePrefix = `/${role}/question-bank`;

  const [schemes, setSchemes] = useState<SchemeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<'1' | '2' | '3'>('1');
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, Set<number>>>({});
  const [aiGenerating, setAiGenerating] = useState(false);

  const [ownerId, setOwnerId] = useState('');
  const [bank, setBank] = useState<BankRecord | null>(null);

  useEffect(() => {
    if (bankId) {
      void load();
    }
  }, [bankId]);

  const currentScheme = schemes.find((s) => String(s.term ?? 1) === selectedTerm);
  const currentWeeks = currentScheme?.weeks ?? buildDefaultWeeks();

  // Admins can always edit; teachers only if they own the bank
  const isEditable = role === 'admin'
    ? true
    : bank
      ? bank.created_by_teacher_id === ownerId
      : false;

  const expandedSet = expandedWeeks[currentScheme?.id ?? 'new'] ?? new Set<number>();

  function toggleWeek(weekNumber: number) {
    const key = currentScheme?.id ?? 'new';
    setExpandedWeeks((prev) => {
      const next = new Set(prev[key] ?? new Set<number>());
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return { ...prev, [key]: next };
    });
  }

  async function load() {
    setLoading(true);
    try {
      const [contextRes, groupsRes, bankRes] = await Promise.all([
        fetch(`${apiPrefix}/context`, { cache: 'no-store' }),
        fetch(`${apiPrefix}/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
        fetch(`${apiPrefix}/banks/${bankId}`, { cache: 'no-store' }),
      ]);

      const contextPayload = (await contextRes.json()) as ContextPayload & { error?: string };
      const groupsPayload = (await groupsRes.json()) as { groups?: SchemeRecord[] } & { error?: string };
      const bankPayload = (await bankRes.json()) as BankPayload & { error?: string };

      if (contextRes.ok) setOwnerId(contextPayload.teacherId || contextPayload.userId || '');
      if (groupsRes.ok) setSchemes(groupsPayload.groups || []);
      if (bankRes.ok) setBank(bankPayload.bank || null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load scheme');
    } finally {
      setLoading(false);
    }
  }

  // ── Week topic update handler ──

  const handleUpdateWeekTopics = useCallback(async (weekNumber: number, topics: string[]) => {
    if (!isEditable) {
      toast.error('You can only manage schemes for banks you created');
      return;
    }

    // If no scheme exists yet, create one first
    if (!currentScheme) {
      // Auto-create a scheme for this term
      const ordinal = selectedTerm === '1' ? '1st' : selectedTerm === '2' ? '2nd' : '3rd';
      const defaultTitle = `${ordinal} term scheme`;
      const weeks = buildDefaultWeeks();
      const weekIdx = weeks.findIndex((w) => w.week_number === weekNumber);
      if (weekIdx !== -1) {
        weeks[weekIdx].topics = topics;
      }

      setSaving(true);
      try {
        const res = await fetch(`${apiPrefix}/banks/${bankId}/topic-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: defaultTitle, weeks }),
        });

        const payload = await res.json();
        if (!res.ok) {
          toast.error(payload?.error || 'Failed to create scheme');
          return;
        }

        const saved = payload.group as SchemeRecord;
        setSchemes((prev) => [saved, ...prev]);
        toast.success('Week topics saved');
      } catch (error) {
        console.error(error);
        toast.error('Failed to save');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Update existing scheme
    const updatedWeeks = currentWeeks.map((w) =>
      w.week_number === weekNumber ? { ...w, topics } : w
    );

    setSaving(true);
    try {
      const res = await fetch(`${apiPrefix}/banks/${bankId}/topic-groups/${currentScheme.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks: updatedWeeks }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to update week topics');
        return;
      }

      const saved = payload.group as SchemeRecord;
      setSchemes((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      toast.success('Week topics saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }, [isEditable, currentScheme, currentWeeks, apiPrefix, bankId, selectedTerm]);

  // ── AI Generate ──

  async function handleGenerateWithAI() {
    if (!isEditable) {
      toast.error('You can only manage schemes for banks you created');
      return;
    }
    if (!bank?.subject_class_id) {
      toast.error('Unable to identify the subject class for this bank');
      return;
    }

    setAiGenerating(true);
    try {
      const res = await fetch(`${apiPrefix}/topics/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectClassId: bank.subject_class_id,
          term: Number(selectedTerm),
          count: 11, // One topic per teaching week (1-5, 7-12)
        }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to generate topics');
        return;
      }

      const generatedTopics = Array.isArray(payload?.topics)
        ? payload.topics.map((topic: unknown) => String(topic || '').trim()).filter(Boolean)
        : [];

      if (generatedTopics.length === 0) {
        toast.error('AI did not return any topics');
        return;
      }

      // Distribute topics across teaching weeks (round-robin)
      const teachingWeeks = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
      const newWeeks = currentWeeks.map((w) => ({ ...w, topics: [] as string[] }));
      let topicIdx = 0;

      while (topicIdx < generatedTopics.length) {
        for (const tw of teachingWeeks) {
          if (topicIdx >= generatedTopics.length) break;
          const weekIdx = newWeeks.findIndex((r) => r.week_number === tw);
          if (weekIdx !== -1) {
            newWeeks[weekIdx].topics.push(generatedTopics[topicIdx]);
          }
          topicIdx++;
        }
      }

      // Save the generated scheme
      if (currentScheme) {
        const saveRes = await fetch(`${apiPrefix}/banks/${bankId}/topic-groups/${currentScheme.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weeks: newWeeks }),
        });

        const savePayload = await saveRes.json();
        if (!saveRes.ok) {
          toast.error(savePayload?.error || 'Failed to save generated topics');
          return;
        }

        const saved = savePayload.group as SchemeRecord;
        setSchemes((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        // Create new scheme
        const ordinal = selectedTerm === '1' ? '1st' : selectedTerm === '2' ? '2nd' : '3rd';
        const saveRes = await fetch(`${apiPrefix}/banks/${bankId}/topic-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${ordinal} term scheme`, weeks: newWeeks }),
        });

        const savePayload = await saveRes.json();
        if (!saveRes.ok) {
          toast.error(savePayload?.error || 'Failed to save generated scheme');
          return;
        }

        const saved = savePayload.group as SchemeRecord;
        setSchemes((prev) => [saved, ...prev]);
      }

      toast.success(`Scheme generated with ${generatedTopics.length} topics across weeks`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate topics');
    } finally {
      setAiGenerating(false);
    }
  }

  // ── Delete Scheme ──

  async function handleDeleteScheme() {
    if (!isEditable || !currentScheme) return;
    if (!confirm('Delete this scheme of work? All week topics will be lost. This cannot be undone.')) return;

    setSaving(true);
    try {
      const res = await fetch(`${apiPrefix}/banks/${bankId}/topic-groups/${currentScheme.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json();
        toast.error(payload?.error || 'Failed to delete scheme');
        return;
      }
      setSchemes((prev) => prev.filter((s) => s.id !== currentScheme.id));
      toast.success('Scheme deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete scheme');
    } finally {
      setSaving(false);
    }
  }

  /* ─────────────────────────── Loading State ─────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading scheme of work...</p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────── Main Render ─────────────────────────── */

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-stone-500 hover:text-stone-800 -ml-2 gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FolderKanban className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-stone-900 leading-tight">
                  {bank?.title ?? 'Question Bank'}
                </h1>
                <p className="text-sm text-stone-500 mt-0.5">Scheme of Work · Week-by-Week Plan</p>
              </div>
            </div>

            {isEditable && (
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  onClick={handleGenerateWithAI}
                  disabled={aiGenerating}
                  variant="outline"
                  className="border-stone-200 text-stone-700 gap-2"
                >
                  <Sparkles className={`h-4 w-4 ${aiGenerating ? 'animate-pulse' : ''}`} />
                  {aiGenerating ? 'Generating...' : 'Generate Scheme'}
                </Button>
                {currentScheme && (
                  <Button
                    onClick={handleDeleteScheme}
                    disabled={saving}
                    variant="ghost"
                    className="text-stone-400 hover:text-red-500 hover:bg-red-50 gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Term tabs */}
          <div className="flex gap-1 mt-5 bg-stone-100 p-1 rounded-lg w-fit">
            {(['1', '2', '3'] as const).map((term) => (
              <button
                key={term}
                onClick={() => setSelectedTerm(term)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  selectedTerm === term
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Term {term}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {!isEditable && bank && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
            <p>You are viewing this scheme in read-only mode. Only the creator can edit.</p>
          </div>
        )}

        {/* Scheme stats bar */}
        {currentScheme && (
          <div className="flex items-center gap-4 mb-6 text-sm">
            <div className="flex items-center gap-2 bg-white rounded-lg border border-stone-200 px-4 py-2 shadow-sm">
              <BookOpen className="h-4 w-4 text-stone-400" />
              <span className="text-stone-600">
                <strong className="text-stone-800">{getTotalTopicCount(currentWeeks)}</strong> topics across 11 teaching weeks
              </span>
            </div>
            {currentScheme.created_at && (
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Calendar className="h-3 w-3" />
                Created {formatDate(currentScheme.created_at)}
              </div>
            )}
          </div>
        )}

        {/* Read-only notice when no scheme exists */}
        {!currentScheme && !isEditable && (
          <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6 text-sm text-stone-600">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-stone-400" />
            <p>No scheme of work yet for Term {selectedTerm}.</p>
          </div>
        )}

        {/* Empty state */}
        {!currentScheme && isEditable && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <BookOpen className="h-7 w-7 text-stone-400" />
            </div>
            <h3 className="text-base font-semibold text-stone-700 mb-1">
              No scheme of work for Term {selectedTerm}
            </h3>
            <p className="text-sm text-stone-400 max-w-md mb-6">
              Create a weekly scheme of work with topics for each teaching week.
              Click any week below to start adding topics, or use AI to generate them.
            </p>

            {/* Show empty weeks grid even when no scheme exists */}
            <div className="w-full max-w-4xl mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {buildDefaultWeeks().map((week) => (
                  <WeekCard
                    key={week.week_number}
                    week={week}
                    expanded={expandedSet.has(week.week_number)}
                    onToggle={() => toggleWeek(week.week_number)}
                    onUpdateTopics={handleUpdateWeekTopics}
                    isEditable={isEditable}
                    saving={saving}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Weeks grid */}
        {currentScheme && (
          <div className="space-y-6">
            {/* Teaching phase label: Weeks 1-5 */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-400">
                  First Half · Weeks 1 – 5
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentWeeks
                  .filter((w) => w.week_number >= 1 && w.week_number <= 5)
                  .map((week) => (
                    <WeekCard
                      key={week.week_number}
                      week={week}
                      expanded={expandedSet.has(week.week_number)}
                      onToggle={() => toggleWeek(week.week_number)}
                      onUpdateTopics={handleUpdateWeekTopics}
                      isEditable={isEditable}
                      saving={saving}
                    />
                  ))}
              </div>
            </div>

            {/* Mid-Term Break */}
            <div>
              <div className="max-w-sm mx-auto">
                {currentWeeks
                  .filter((w) => w.is_break)
                  .map((week) => (
                    <WeekCard
                      key={week.week_number}
                      week={week}
                      expanded={false}
                      onToggle={() => {}}
                      onUpdateTopics={handleUpdateWeekTopics}
                      isEditable={false}
                      saving={false}
                    />
                  ))}
              </div>
            </div>

            {/* Teaching phase label: Weeks 7-12 */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-400">
                  Second Half · Weeks 7 – 12
                </span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentWeeks
                  .filter((w) => w.week_number >= 7 && w.week_number <= 12)
                  .map((week) => (
                    <WeekCard
                      key={week.week_number}
                      week={week}
                      expanded={expandedSet.has(week.week_number)}
                      onToggle={() => toggleWeek(week.week_number)}
                      onUpdateTopics={handleUpdateWeekTopics}
                      isEditable={isEditable}
                      saving={saving}
                    />
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom: Show empty weeks if no scheme yet */}
        {!currentScheme && isEditable && (
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={handleGenerateWithAI}
              disabled={aiGenerating}
              className="gap-2 border-stone-200 text-stone-700"
            >
              <Sparkles className={`h-4 w-4 ${aiGenerating ? 'animate-pulse' : ''}`} />
              {aiGenerating ? 'Generating...' : 'Generate Scheme with AI'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
