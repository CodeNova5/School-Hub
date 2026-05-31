"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolContext } from '@/hooks/use-school-context';
import { FolderKanban, AlertCircle, PencilLine, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type TopicGroupRecord = {
  id: string;
  title: string;
  topics: string[];
  created_by_teacher_id: string;
  created_at: string;
};

type BankRecord = {
  id: string;
  title: string;
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
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [groupTopicsInput, setGroupTopicsInput] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [bank, setBank] = useState<BankRecord | null>(null);

  useEffect(() => {
    if (schoolId && bankId) {
      void load();
    }
  }, [schoolId, bankId]);

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

  function startEditGroup(group: TopicGroupRecord) {
    setEditingGroupId(group.id);
    setGroupTitleInput(group.title || '');
    setGroupTopicsInput((group.topics || []).join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setGroupTitleInput('');
    setGroupTopicsInput('');
  }

  async function handleSaveTopicGroup() {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }

    const title = groupTitleInput.trim();
    const topics = groupTopicsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (!title) return toast.error('Provide a title for the topic group');
    if (topics.length === 0) return toast.error('Add at least one topic to the group');

    setTopicGroupsLoading(true);
    try {
      const method = editingGroupId ? 'PATCH' : 'POST';
      const url = editingGroupId
        ? `/api/teacher/question-bank/banks/${bankId}/topic-groups/${editingGroupId}`
        : `/api/teacher/question-bank/banks/${bankId}/topic-groups`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to save topic group');
        return;
      }

      const savedGroup = payload.group as TopicGroupRecord;
      if (editingGroupId) {
        setTopicGroups((prev) => prev.map((g) => (g.id === savedGroup.id ? savedGroup : g)));
        toast.success('Topic group updated');
      } else {
        setTopicGroups((prev) => [savedGroup, ...prev]);
        toast.success('Topic group created');
      }

      cancelEditGroup();
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
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Loading question groups...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="w-full space-y-6 pb-16">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-auto p-0 text-gray-500 hover:text-gray-900" onClick={() => router.push(`/teacher/question-bank/${bankId}`)}>
            ← Back
          </Button>
          <h1 className="text-2xl font-bold">Question Groups</h1>
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm sm:p-6">
            <div className="space-y-1.5 border-b border-slate-200/60 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{editingGroupId ? 'Edit Group' : 'Create New Group'}</p>
              <h3 className="text-lg font-semibold text-slate-950">{editingGroupId ? 'Edit Group' : 'Create New Group'}</h3>
              <p className="text-sm leading-6 text-slate-500">Save frequently used topic combinations for faster generation.</p>
            </div>

            <div className="mt-5 space-y-4">
              {!isEditable && (
                <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div>You can view saved groups here, but only the bank owner can create or edit them.</div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Group Title</Label>
                <Input
                  value={groupTitleInput}
                  onChange={(e) => setGroupTitleInput(e.target.value)}
                  disabled={!isEditable || topicGroupsLoading}
                  placeholder="e.g. Fractions revision set"
                  className="h-11 border-slate-200 bg-white text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Topics</Label>
                <Textarea
                  value={groupTopicsInput}
                  onChange={(e) => setGroupTopicsInput(e.target.value)}
                  disabled={!isEditable || topicGroupsLoading}
                  placeholder="Fractions, decimals, ratios"
                  rows={4}
                  className="resize-none border-slate-200 bg-white text-sm shadow-sm"
                />
                <p className="text-xs text-slate-500">Separate topics with commas. These labels are reused during AI generation.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="sm"
                  onClick={handleSaveTopicGroup}
                  disabled={!isEditable || topicGroupsLoading}
                  className="flex-1 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800"
                >
                  {topicGroupsLoading ? 'Saving...' : editingGroupId ? 'Update Group' : 'Create Group'}
                </Button>
                {editingGroupId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelEditGroup}
                    disabled={topicGroupsLoading}
                    className="flex-1 border-slate-200 bg-white"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4 border-b border-slate-200/60 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saved groups</p>
                <p className="mt-1 text-sm text-slate-500">Use, edit, or delete existing topic collections.</p>
              </div>
              <Badge variant="secondary" className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">{topicGroups.length} total</Badge>
            </div>

            {topicGroups.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                {topicGroups.map((group) => {
                  const topicCount = (group.topics || []).length;
                  return (
                    <div key={group.id} className="group flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                            <FolderKanban className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 space-y-1">
                            <p className="truncate font-semibold text-slate-950">{group.title}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>{topicCount} {topicCount === 1 ? 'topic' : 'topics'}</span>
                              <span>•</span>
                              <span>Created {formatDate(group.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEditGroup(group)}
                            disabled={topicGroupsLoading || !isEditable}
                            className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                            aria-label={`Edit ${group.title}`}
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteTopicGroup(group.id)}
                            disabled={topicGroupsLoading || !isEditable}
                            className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            aria-label={`Delete ${group.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {topicCount > 0 ? (
                          group.topics.map((topic) => (
                            <Badge key={`${group.id}-${topic}`} variant="secondary" className="rounded-full border border-indigo-100 bg-indigo-50/90 text-indigo-700 shadow-sm">{topic}</Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">No topics defined</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <FolderKanban className="h-7 w-7 text-slate-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">No Question Groups Yet</h3>
                <p className="mt-2 text-sm text-slate-500">Create your first reusable topic collection.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
