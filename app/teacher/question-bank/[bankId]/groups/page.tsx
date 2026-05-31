"use client";

import { useEffect, useState, KeyboardEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSchoolContext } from '@/hooks/use-school-context';
import { FolderKanban, AlertCircle, PencilLine, Trash2, Plus, ArrowLeft, X, BookOpen, Calendar, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type TopicGroupRecord = {
  id: string;
  title: string;
  topics: string[];
  created_by_teacher_id: string;
  created_at: string;
  term?: number; // 1, 2 or 3 — scheme of work term
};

type BankRecord = {
  id: string;
  title: string;
  subject_class_id: string;
  created_by_teacher_id: string;
};

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function TeacherQuestionGroupsPage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicGroupsLoading, setTopicGroupsLoading] = useState(false);
  // Scheme-of-work: selected term (1,2,3)
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
  
  const [teacherId, setTeacherId] = useState('');
  const [bank, setBank] = useState<BankRecord | null>(null);

  useEffect(() => {
    if (schoolId && bankId) {
      void load();
    }
  }, [schoolId, bankId]);

  // derive groups visible for the selected term; default any group without term to term 1
  const filteredGroups = topicGroups.filter((g) => String(g.term ?? 1) === selectedTerm);

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
        fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
      ]);

      const contextPayload = await contextRes.json();
      const groupsPayload = await groupsRes.json();
      const bankPayload = await bankRes.json();

      if (contextRes.ok) setTeacherId(contextPayload.teacherId || '');
      if (groupsRes.ok) setTopicGroups(groupsPayload.groups || []);
      if (bankRes.ok) setBank(bankPayload.bank || null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }

  const isEditable = bank ? bank.created_by_teacher_id === teacherId : false;

  // Open modal for creating a new group
  function handleOpenCreateModal() {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }
    setEditingGroupId(null);
    // Prefill group title based on currently selected term (e.g. "1st term scheme")
    const ordinal = selectedTerm === '1' ? '1st' : selectedTerm === '2' ? '2nd' : '3rd';
    setGroupTitleInput(`${ordinal} term scheme`);
    setGroupTopics([]);
    setTopicInput('');
    setTermInput(selectedTerm);
    setIsModalOpen(true);
  }

  // Open modal for editing an existing group
  function handleOpenEditModal(group: TopicGroupRecord) {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }
    setEditingGroupId(group.id);
    setGroupTitleInput(group.title || '');
    setGroupTopics(group.topics || []);
    setTopicInput('');
    setTermInput(String(group.term ?? 1) as '1' | '2' | '3');
    setIsModalOpen(true);
  }

  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingGroupId(null);
    setGroupTitleInput('');
    setGroupTopics([]);
    setTopicInput('');
  }

  // Manage dynamic structured topics array
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
      const res = await fetch('/api/teacher/question-bank/topics/generate', {
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

    setTopicGroupsLoading(true);
    try {
      const method = editingGroupId ? 'PATCH' : 'POST';
      const url = editingGroupId
        ? `/api/teacher/question-bank/banks/${bankId}/topic-groups/${editingGroupId}`
        : `/api/teacher/question-bank/banks/${bankId}/topic-groups`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics: groupTopics, term: Number(termInput) }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to save topic group');
        return;
      }

      const savedGroup = payload.group as TopicGroupRecord;
      // ensure local term value is present (fallback to selected modal value)
      if (savedGroup && (savedGroup.term === undefined || savedGroup.term === null)) {
        savedGroup.term = Number(termInput);
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
      const res = await fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups/${id}`, { method: 'DELETE' });
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

  if (schoolLoading || loading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading question groups...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="min-h-screen bg-slate-50">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="text-slate-500 hover:text-slate-800 -ml-2 gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <FolderKanban className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-slate-900 leading-tight">
                    {bank?.title ?? 'Question Bank'}
                  </h1>
                  <p className="text-sm text-slate-500 mt-0.5">Topic Groups · Scheme of Work</p>
                </div>
              </div>

              {isEditable && (
                <Button
                  onClick={handleOpenCreateModal}
                  disabled={topicGroupsLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 self-start sm:self-auto"
                >
                  <Plus className="h-4 w-4" />
                  New Topic Group
                </Button>
              )}
            </div>

            {/* Term tabs */}
            <div className="flex gap-1 mt-5 bg-slate-100 p-1 rounded-lg w-fit">
              {(['1', '2', '3'] as const).map((term) => (
                <button
                  key={term}
                  onClick={() => setSelectedTerm(term)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                    selectedTerm === term
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
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
              <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <BookOpen className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-700 mb-1">
                No topic groups for Term {selectedTerm}
              </h3>
              <p className="text-sm text-slate-400 max-w-xs mb-6">
                Topic groups help you organise questions by curriculum topics for this term's scheme of work.
              </p>
              {isEditable && (
                <Button
                  onClick={handleOpenCreateModal}
                  variant="outline"
                  className="gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
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
                  className="group relative bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden"
                >
                  {/* Accent strip */}
                  <div className="h-1 w-full bg-gradient-to-r from-indigo-400 to-violet-400" />

                  <CardHeader className="pb-3 pt-4 px-5">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-semibold text-slate-800 leading-snug line-clamp-2">
                        {group.title}
                      </CardTitle>
                      {isEditable && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(group)}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Edit"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTopicGroup(group.id)}
                            disabled={topicGroupsLoading}
                            className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <CardDescription className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(group.created_at)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="px-5 pb-5">
                    {/* Topics preview */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          Topics
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          {group.topics.length}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2">
                        {(expandedTopicGroups[group.id] ? group.topics : group.topics.slice(0, 3)).map((topic, i) => (
                          <div
                            key={`${group.id}-topic-${i}`}
                            className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200/70"
                          >
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-600">
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
                            className="h-8 w-full justify-center rounded-xl text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            {expandedTopicGroups[group.id]
                              ? 'Show fewer topics'
                              : `Show ${group.topics.length - 3} more topics`}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Footer meta */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {group.topics.length} topic{group.topics.length !== 1 ? 's' : ''}
                      </span>
                      <Badge className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 font-medium rounded-full px-2 py-0.5">
                        Term {group.term ?? 1}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="sm:max-w-[540px] rounded-2xl p-0 overflow-hidden gap-0">
          {/* Modal header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {editingGroupId ? 'Edit Topic Group' : 'Create Topic Group'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-0.5">
              {editingGroupId
                ? 'Update the title, topics, and term assignment for this group.'
                : 'Define a new topic group for this scheme of work term.'}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-5">
            {/* Group title */}
            <div className="space-y-1.5">
              <Label htmlFor="group-title" className="text-sm font-medium text-slate-700">
                Group Title
              </Label>
              <Input
                id="group-title"
                placeholder="e.g. Number and Numeration"
                value={groupTitleInput}
                onChange={(e) => setGroupTitleInput(e.target.value)}
                className="border-slate-200 focus-visible:ring-indigo-500"
              />
            </div>

            {/* Term selection */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">Term</Label>
              <div className="flex gap-2">
                {(['1', '2', '3'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTermInput(t)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      termInput === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
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
                <Label className="text-sm font-medium text-slate-700">Topics</Label>
                <button
                  type="button"
                  onClick={handleGenerateTopicsWithAI}
                  disabled={aiGeneratingTopics}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  className="border-slate-200 focus-visible:ring-indigo-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTopic}
                  className="border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 flex-shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-400">Press Enter or comma to add a topic quickly.</p>

              {/* Topics chips */}
              {groupTopics.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-40 overflow-y-auto mt-2">
                  {groupTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs rounded-full px-2.5 py-1 shadow-sm"
                    >
                      {topic}
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(i)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {groupTopics.length === 0 && (
                <div className="flex items-center justify-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-2">
                  <p className="text-xs text-slate-400">No topics yet. Add one above or use AI generation.</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleCloseModal}
              className="border-slate-200 text-slate-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTopicGroup}
              disabled={topicGroupsLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
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
    </DashboardLayout>
  );
}