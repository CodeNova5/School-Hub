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
  
  const [teacherId, setTeacherId] = useState('');
  const [bank, setBank] = useState<BankRecord | null>(null);

  useEffect(() => {
    if (schoolId && bankId) {
      void load();
    }
  }, [schoolId, bankId]);

  // derive groups visible for the selected term; default any group without term to term 1
  const filteredGroups = topicGroups.filter((g) => String(g.term ?? 1) === selectedTerm);

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
    setGroupTitleInput('');
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
      <div className="w-full max-w-7xl mx-auto space-y-8 pb-16 px-4 sm:px-6">
        
        {/* Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-6">
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2 -ml-2 text-slate-500 hover:text-slate-900" 
              onClick={() => router.push(`/teacher/question-bank/${bankId}`)}
            >
              <ArrowLeft className="h-4 w-4" /> Back to Bank
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Question Groups</h1>
            <p className="text-sm text-slate-500">
              Manage custom topic clusters for automated smart AI assignment and exam generations.
            </p>
          </div>
          
          {isEditable && (
            <Button onClick={handleOpenCreateModal} className="sm:w-auto self-start gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm rounded-xl">
              <Plus className="h-4 w-4" /> Create New Group
            </Button>
          )}
        </div>

        {/* Informative Warning if viewer-only */}
        {!isEditable && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 max-w-2xl">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">Read-only mode</p>
              <p className="text-amber-700/90 mt-0.5">You can view saved topic setups here, but updates can only be executed by the authentic bank manager.</p>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">Active Assemblies</h2>
                <Badge variant="secondary" className="rounded-md bg-slate-100 text-slate-700 font-medium">
                  {filteredGroups.length} Active
                </Badge>
              </div>

              {/* Term selector for scheme-of-work */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTerm('1')}
                  className={`rounded-lg text-xs ${selectedTerm === '1' ? 'bg-slate-900 text-white' : ''}`}
                >
                  1st Term
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTerm('2')}
                  className={`rounded-lg text-xs ${selectedTerm === '2' ? 'bg-slate-900 text-white' : ''}`}
                >
                  2nd Term
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedTerm('3')}
                  className={`rounded-lg text-xs ${selectedTerm === '3' ? 'bg-slate-900 text-white' : ''}`}
                >
                  3rd Term
                </Button>
              </div>
            </div>
          </div>

          {filteredGroups.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGroups.map((group) => {
                const topicCount = (group.topics || []).length;
                return (
                  <Card key={group.id} className="group relative flex flex-col justify-between overflow-hidden border-slate-200/60 bg-white transition-all duration-200 hover:shadow-md hover:border-slate-300">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <CardTitle className="text-base font-bold text-slate-900 truncate" title={group.title}>
                            {group.title}
                          </CardTitle>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> {topicCount} {topicCount === 1 ? 'topic' : 'topics'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(group.created_at)}</span>
                          </div>
                        </div>

                        {/* Actions wrapper accessible via intuitive interactive states */}
                        {isEditable && (
                          <div className="flex items-center gap-0.5 bg-slate-50 rounded-lg p-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEditModal(group)}
                              disabled={topicGroupsLoading}
                              className="h-7 w-7 text-slate-500 hover:text-slate-900"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteTopicGroup(group.id)}
                              disabled={topicGroupsLoading}
                              className="h-7 w-7 text-slate-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-5 pt-0">
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {topicCount > 0 ? (
                          group.topics.map((topic, idx) => (
                            <Badge 
                              key={`${group.id}-${idx}`} 
                              variant="secondary" 
                              className="rounded-md border border-slate-100 bg-slate-50/80 text-slate-600 text-[11px] font-normal px-2 py-0.5"
                            >
                              {topic}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No explicit topics added.</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center max-w-xl mx-auto">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-100 shadow-sm">
                <FolderKanban className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">No question clusters</h3>
              <p className="mt-1 text-xs text-slate-500">Create a group to organize structured sub-topics for easier tracking.</p>
              {isEditable && (
                <Button onClick={handleOpenCreateModal} size="sm" variant="outline" className="mt-4 rounded-xl text-xs">
                  Add First Group
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Structural Custom Dialog Modal for Create & Edit */}
        <Dialog open={isModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
          <DialogContent className="sm:max-w-[480px] overflow-hidden rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {editingGroupId ? 'Modify Topic Group' : 'New Topic Group'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure contextual tags for systemic reuse during questionnaire distributions.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Group Title Field */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-semibold text-slate-700">Group Title</Label>
                <Input
                  id="title"
                  value={groupTitleInput}
                  onChange={(e) => setGroupTitleInput(e.target.value)}
                  placeholder="e.g., Mid-Term Algebra Stack"
                  className="h-10 border-slate-200 rounded-xl bg-white text-sm focus-visible:ring-slate-900"
                />
              </div>

              {/* Term selector inside modal */}
              <div className="space-y-2">
                <Label htmlFor="term" className="text-xs font-semibold text-slate-700">Term</Label>
                <select
                  id="term"
                  value={termInput}
                  onChange={(e) => setTermInput(e.target.value as '1' | '2' | '3')}
                  className="h-10 border-slate-200 rounded-xl bg-white text-sm px-3"
                >
                  <option value="1">1st Term</option>
                  <option value="2">2nd Term</option>
                  <option value="3">3rd Term</option>
                </select>
              </div>

              {/* Advanced Interactive Tag Field Structure */}
              <div className="space-y-2">
                <Label htmlFor="topic-input" className="text-xs font-semibold text-slate-700">Add Topics</Label>
                <div className="flex gap-2">
                  <Input
                    id="topic-input"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type topic name and press Enter"
                    className="h-10 border-slate-200 rounded-xl bg-white text-sm focus-visible:ring-slate-900"
                  />
                  <Button 
                    type="button" 
                    variant="secondary"
                    onClick={handleAddTopic}
                    className="h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateTopicsWithAI}
                    disabled={aiGeneratingTopics || topicGroupsLoading}
                    className="h-10 rounded-xl border-slate-200 bg-white text-slate-800 hover:bg-slate-50 gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    {aiGeneratingTopics ? 'Generating from NERDC...' : 'Generate with AI'}
                  </Button>
                  <p className="text-[11px] text-slate-400">
                    Uses the bank subject, class, selected term, and official NERDC curriculum sources.
                  </p>
                </div>
                <p className="text-[11px] text-slate-400">Press <kbd className="bg-slate-50 px-1 border rounded text-[10px]">Enter</kbd> or <kbd className="bg-slate-50 px-1 border rounded text-[10px]">,</kbd> to separate inputs dynamically.</p>

                {/* Tags Display Container */}
                <div className="mt-3 min-h-[80px] rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  {groupTopics.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {groupTopics.map((topic, index) => (
                        <Badge 
                          key={index} 
                          className="flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium px-2 py-1 text-xs shadow-none"
                        >
                          {topic}
                          <button
                            type="button"
                            onClick={() => handleRemoveTopic(index)}
                            className="rounded-full p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[56px] text-xs text-slate-400 italic">
                      No tags compiled yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-50 pt-4">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                disabled={topicGroupsLoading}
                className="rounded-xl border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveTopicGroup}
                disabled={topicGroupsLoading}
                className="rounded-xl bg-slate-950 text-white hover:bg-slate-900"
              >
                {topicGroupsLoading ? 'Saving...' : editingGroupId ? 'Save Changes' : 'Create Cluster'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}