"use client";

import { useEffect, useState, KeyboardEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderKanban, AlertCircle, PencilLine, Trash2, Plus, ArrowLeft, X, BookOpen, Calendar, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                         */
/* ────────────────────────────────────────────────────────────────────────────── */

type TopicGroupRecord = {
  id: string;
  title: string;
  topics: string[];
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

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function inferTermFromTitle(title: string): number {
  const label = title.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return 1;
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return 2;
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return 3;
  return 1; // default to term 1
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Props                                                                         */
/* ────────────────────────────────────────────────────────────────────────────── */

interface QuestionBankGroupsProps {
  role: 'admin' | 'teacher';
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                     */
/* ────────────────────────────────────────────────────────────────────────────── */

export function QuestionBankGroups({ role }: QuestionBankGroupsProps) {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const apiPrefix = `/api/${role}/question-bank`;
  const routePrefix = `/${role}/question-bank`;

  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicGroupsLoading, setTopicGroupsLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<'1' | '2' | '3'>('1');

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [groupTopics, setGroupTopics] = useState<string[]>([]);
  const [termInput, setTermInput] = useState<'1' | '2' | '3'>('1');
  const [aiGeneratingTopics, setAiGeneratingTopics] = useState(false);
  const [expandedTopicGroups, setExpandedTopicGroups] = useState<Record<string, boolean>>({});

  const [ownerId, setOwnerId] = useState('');
  const [bank, setBank] = useState<BankRecord | null>(null);

  useEffect(() => {
    if (bankId) {
      void load();
    }
  }, [bankId]);

  const filteredGroups = topicGroups.filter((g) => String(g.term ?? inferTermFromTitle(g.title)) === selectedTerm);

  // Admins can always edit; teachers only if they own the bank
  const isEditable = role === 'admin'
    ? true
    : bank
      ? bank.created_by_teacher_id === ownerId
      : false;

  function toggleGroupTopics(groupId: string) {
    setExpandedTopicGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
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
      const groupsPayload = (await groupsRes.json()) as { groups?: TopicGroupRecord[] } & { error?: string };
      const bankPayload = (await bankRes.json()) as BankPayload & { error?: string };

      if (contextRes.ok) setOwnerId(contextPayload.teacherId || contextPayload.userId || '');
      if (groupsRes.ok) setTopicGroups(groupsPayload.groups || []);
      if (bankRes.ok) setBank(bankPayload.bank || null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  // ── Modal handlers ──

  function handleOpenCreateModal() {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }
    if (topicGroups.some((g) => String(g.term ?? inferTermFromTitle(g.title)) === selectedTerm)) {
      toast.error(`A topic group for Term ${selectedTerm} already exists`);
      return;
    }

    setEditingGroupId(null);
    const ordinal = selectedTerm === '1' ? '1st' : selectedTerm === '2' ? '2nd' : '3rd';
    setGroupTitleInput(`${ordinal} term scheme`);
    setGroupTopics([]);
    setTopicInput('');
    setTermInput(selectedTerm);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(group: TopicGroupRecord) {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }
    setEditingGroupId(group.id);
    setGroupTitleInput(group.title || '');
    setGroupTopics(group.topics || []);
    setTopicInput('');
    setTermInput(String(group.term ?? inferTermFromTitle(group.title)) as '1' | '2' | '3');
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingGroupId(null);
    setGroupTitleInput('');
    setGroupTopics([]);
    setTopicInput('');
  }

  function handleAddTopic() {
    const sanitized = topicInput.trim();
    if (!sanitized) return;
    if (groupTopics.includes(sanitized)) {
      toast.error('Topic already added');
      return;
    }
    setGroupTopics([...groupTopics, sanitized]);
    setTopicInput('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTopic();
    }
  }

  function handleRemoveTopic(indexToRemove: number) {
    setGroupTopics(groupTopics.filter((_, index) => index !== indexToRemove));
  }

  async function handleGenerateTopicsWithAI() {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }

    if (!bank?.subject_class_id) {
      toast.error('Unable to identify the subject class for this bank');
      return;
    }

    setAiGeneratingTopics(true);
    try {
      const res = await fetch(`${apiPrefix}/topics/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectClassId: bank.subject_class_id,
          term: Number(termInput),
          count: 10,
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

      setGroupTopics((prev) => {
        const merged = [...prev];
        for (const topic of generatedTopics) {
          if (!merged.some((entry) => entry.toLowerCase() === topic.toLowerCase())) {
            merged.push(topic);
          }
        }
        return merged;
      });

      toast.success('Topics generated from official NERDC-aligned sources');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate topics');
    } finally {
      setAiGeneratingTopics(false);
    }
  }

  async function handleSaveTopicGroup() {
    const title = groupTitleInput.trim();
    if (!title) return toast.error('Provide a title for the topic group');
    if (groupTopics.length === 0) return toast.error('Add at least one topic to the group');
    if (!editingGroupId && topicGroups.some((g) => String(g.term ?? inferTermFromTitle(g.title)) === String(termInput))) {
      toast.error(`A topic group for Term ${termInput} already exists`);
      return;
    }

    setTopicGroupsLoading(true);
    try {
      const method = editingGroupId ? 'PATCH' : 'POST';
      const url = editingGroupId
        ? `${apiPrefix}/banks/${bankId}/topic-groups/${editingGroupId}`
        : `${apiPrefix}/banks/${bankId}/topic-groups`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics: groupTopics }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to save topic group');
        return;
      }

      const savedGroup = payload.group as TopicGroupRecord;
      if (savedGroup && (savedGroup.term === undefined || savedGroup.term === null)) {
        (savedGroup as any).term = Number(termInput);
      }
      if (editingGroupId) {
        setTopicGroups((prev) => prev.map((g) => (g.id === savedGroup.id ? savedGroup : g)));
        toast.success('Topic group updated');
      } else {
        setTopicGroups((prev) => [savedGroup, ...prev]);
        toast.success('Topic group created');
      }

      handleCloseModal();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save topic group');
    } finally {
      setTopicGroupsLoading(false);
    }
  }

  async function handleDeleteTopicGroup(id: string) {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }
    if (!confirm('Delete this topic group? This action cannot be undone.')) return;

    setTopicGroupsLoading(true);
    try {
      const res = await fetch(`${apiPrefix}/banks/${bankId}/topic-groups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json();
        toast.error(payload?.error || 'Failed to delete topic group');
        return;
      }
      setTopicGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success('Topic group deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete topic group');
    } finally {
      setTopicGroupsLoading(false);
    }
  }

  /* ─────────────────────────── Loading State ─────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading question groups...</p>
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
                <p className="text-sm text-stone-500 mt-0.5">Topic Groups · Scheme of Work</p>
              </div>
            </div>

            {isEditable && (
              <Button
                onClick={handleOpenCreateModal}
                disabled={
                  topicGroupsLoading || topicGroups.some((g) => String(g.term ?? inferTermFromTitle(g.title)) === selectedTerm)
                }
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2 self-start sm:self-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                New Topic Group
              </Button>
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
            <p>You are viewing this question bank in read-only mode. Only the creator can add or edit topic groups.</p>
          </div>
        )}

        {filteredGroups.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
              <BookOpen className="h-7 w-7 text-stone-400" />
            </div>
            <h3 className="text-base font-semibold text-stone-700 mb-1">
              No topic groups for Term {selectedTerm}
            </h3>
            <p className="text-sm text-stone-400 max-w-xs mb-6">
              Topic groups help you organise questions by curriculum topics for this term's scheme of work.
            </p>
            {isEditable && (
              <Button
                onClick={handleOpenCreateModal}
                variant="outline"
                disabled={
                  topicGroupsLoading || topicGroups.some((g) => String(g.term ?? inferTermFromTitle(g.title)) === selectedTerm)
                }
                className="gap-2 border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                Create First Topic Group
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => (
              <Card
                key={group.id}
                className="group relative bg-white border border-stone-200 hover:border-amber-200 hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden"
              >
                {/* Accent strip */}
                <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />

                <CardHeader className="pb-3 pt-4 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold text-stone-800 leading-snug line-clamp-2">
                      {group.title}
                    </CardTitle>
                    {isEditable && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => handleOpenEditModal(group)}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTopicGroup(group.id)}
                          disabled={topicGroupsLoading}
                          className="h-7 w-7 rounded-md flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <CardDescription className="flex items-center gap-1.5 text-xs text-stone-400 mt-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(group.created_at)}
                  </CardDescription>
                </CardHeader>

                <CardContent className="px-5 pb-5">
                  {/* Topics preview */}
                  <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Topics
                      </span>
                      <Badge
                        variant="secondary"
                        className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600"
                      >
                        {group.topics.length}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(expandedTopicGroups[group.id] ? group.topics : group.topics.slice(0, 3)).map((topic, i) => (
                        <div
                          key={`${group.id}-topic-${i}`}
                          className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm text-stone-700 shadow-sm ring-1 ring-stone-200/70"
                        >
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[11px] font-semibold text-amber-600">
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1 leading-5 line-clamp-2">{topic}</span>
                        </div>
                      ))}

                      {group.topics.length > 3 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleGroupTopics(group.id)}
                          className="h-8 w-full justify-center rounded-xl text-xs font-medium text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                        >
                          {expandedTopicGroups[group.id]
                            ? 'Show fewer topics'
                            : `Show ${group.topics.length - 3} more topics`}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Footer meta */}
                  <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                    <span className="text-xs text-stone-400">
                      {group.topics.length} topic{group.topics.length !== 1 ? 's' : ''}
                    </span>
                    <Badge className="text-xs bg-amber-50 text-amber-600 border border-amber-100 font-medium rounded-full px-2 py-0.5">
                      Term {group.term ?? inferTermFromTitle(group.title)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[540px] rounded-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-stone-100">
            <DialogTitle className="text-lg font-semibold text-stone-900">
              {editingGroupId ? 'Edit Topic Group' : 'Create Topic Group'}
            </DialogTitle>
            <DialogDescription className="text-sm text-stone-500 mt-0.5">
              {editingGroupId
                ? 'Update the title, topics, and term assignment for this group.'
                : 'Define a new topic group for this scheme of work term.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            {/* Group title */}
            <div className="space-y-1.5">
              <Label htmlFor="group-title" className="text-sm font-medium text-stone-700">
                Group Title
              </Label>
              <Input
                id="group-title"
                placeholder="e.g. Number and Numeration"
                value={groupTitleInput}
                onChange={(e) => setGroupTitleInput(e.target.value)}
                className="border-stone-200 focus-visible:ring-amber-500"
              />
            </div>

            {/* Term selection */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-stone-700">Term</Label>
              <div className="flex gap-2">
                {(['1', '2', '3'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTermInput(t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      termInput === t
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300 hover:text-amber-600'
                    }`}
                  >
                    Term {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Topics input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-stone-700">Topics</Label>
                <button
                  type="button"
                  onClick={handleGenerateTopicsWithAI}
                  disabled={aiGeneratingTopics}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${aiGeneratingTopics ? 'animate-pulse' : ''}`} />
                  {aiGeneratingTopics ? 'Generating…' : 'Generate with AI'}
                </button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Type a topic and press Enter"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border-stone-200 focus-visible:ring-amber-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTopic}
                  className="border-stone-200 text-stone-600 hover:text-amber-600 hover:border-amber-300 flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-stone-400">Press Enter or comma to add a topic quickly.</p>

              {/* Topics chips */}
              {groupTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-stone-50 rounded-xl border border-stone-100 max-h-40 overflow-y-auto mt-2">
                  {groupTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-white border border-stone-200 text-stone-700 text-xs rounded-full px-2.5 py-1 shadow-sm"
                    >
                      {topic}
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(i)}
                        className="text-stone-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {groupTopics.length === 0 && (
                <div className="flex items-center justify-center py-6 bg-stone-50 rounded-xl border border-dashed border-stone-200 mt-2">
                  <p className="text-xs text-stone-400">No topics yet. Add one above or use AI generation.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-stone-100 flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              className="border-stone-200 text-stone-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTopicGroup}
              disabled={topicGroupsLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              {topicGroupsLoading ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Saving…
                </>
              ) : editingGroupId ? (
                'Save Changes'
              ) : (
                'Create Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
