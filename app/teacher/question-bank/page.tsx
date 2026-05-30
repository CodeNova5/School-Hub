"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, BookOpen, Layers, Lock, Globe2, SlidersHorizontal, Search, Calendar } from 'lucide-react';
import { useSchoolContext } from '@/hooks/use-school-context';

type SubjectClassItem = {
  id: string;
  subjects?: { id: string; name: string } | null;
  classes?: { id: string; name: string } | null;
};

type QuestionBankItem = {
  id: string;
  title: string;
  description?: string | null;
  subject_class_id: string;
  visibility: 'private' | 'public_school';
  created_by_teacher_id: string;
  created_at: string;
  updated_at?: string;
};

type ContextPayload = {
  teacherId: string;
  subjectClasses: SubjectClassItem[];
  banks: QuestionBankItem[];
};

type FilterVisibility = 'all' | 'private' | 'public_school';

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function TeacherQuestionBankPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [banks, setBanks] = useState<QuestionBankItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVisibility, setFilterVisibility] = useState<FilterVisibility>('all');
  const [bankTitle, setBankTitle] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [bankSubjectClassId, setBankSubjectClassId] = useState('');
  const [bankVisibility, setBankVisibility] = useState<'private' | 'public_school'>('private');
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (schoolId) {
      void loadContext();
    }
  }, [schoolId]);

  const subjectClassLabelMap = useMemo(() => {
    return new Map(
      subjectClasses.map((item) => [
        item.id,
        `${item.subjects?.name || 'Subject'} — ${item.classes?.name || 'Class'}`,
      ])
    );
  }, [subjectClasses]);

  const filteredBanks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return banks.filter((bank) => {
      const matchesSearch =
        !query ||
        bank.title.toLowerCase().includes(query) ||
        (bank.description || '').toLowerCase().includes(query) ||
        (subjectClassLabelMap.get(bank.subject_class_id) || '').toLowerCase().includes(query);

      const matchesVisibility = filterVisibility === 'all' || bank.visibility === filterVisibility;

      return matchesSearch && matchesVisibility;
    });
  }, [banks, filterVisibility, searchTerm, subjectClassLabelMap]);

  const stats = useMemo(() => {
    const mine = banks.filter((bank) => bank.created_by_teacher_id === teacherId);
    const shared = banks.filter((bank) => bank.visibility === 'public_school');

    return {
      total: banks.length,
      mine: mine.length,
      shared: shared.length,
      subjectClasses: subjectClasses.length,
    };
  }, [banks, subjectClasses.length, teacherId]);

  async function loadContext() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/teacher/question-bank/context', { cache: 'no-store' });
      const payload = (await response.json()) as ContextPayload | { error: string };

      if (!response.ok || 'error' in payload) {
        if (response.status === 401) {
          toast.error('Please log in to continue');
        } else {
          toast.error('Failed to load question bank overview');
        }
        return;
      }

      setTeacherId(payload.teacherId || '');
      setSubjectClasses(payload.subjectClasses || []);
      setBanks(payload.banks || []);

      if (payload.subjectClasses?.length > 0) {
        setBankSubjectClassId(payload.subjectClasses[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load question bank overview');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateBank() {
    if (!bankTitle.trim() || !bankSubjectClassId) {
      toast.error('Enter a bank title and pick a subject/class');
      return;
    }

    setIsCreatingBank(true);
    try {
      const response = await fetch('/api/teacher/question-bank/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bankTitle.trim(),
          description: bankDescription.trim(),
          subjectClassId: bankSubjectClassId,
          visibility: bankVisibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to create question bank');
        return;
      }

      const createdBank = payload.bank as QuestionBankItem;
      setBanks((prev) => [createdBank, ...prev]);
      setBankTitle('');
      setBankDescription('');
      setBankVisibility('private');
      setIsBankModalOpen(false);
      toast.success('Question bank created');
      router.push(`/teacher/question-bank/${createdBank.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create question bank');
    } finally {
      setIsCreatingBank(false);
    }
  }

  function getVisibilityMeta(visibility: QuestionBankItem['visibility']) {
    if (visibility === 'public_school') {
      return {
        label: 'Shared',
        icon: Globe2,
        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900',
      };
    }

    return {
      label: 'Private',
      icon: Lock,
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
  }

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="text-center space-y-2">
            <div className="mx-auto h-6 w-6 rounded-full border-2 border-slate-900 border-t-transparent animate-spin dark:border-white" />
            <p className="text-xs text-slate-500">Loading your question banks...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        
        {/* Premium Dark Hero Section */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-sm space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-400">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                Management Console
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Question Bank Directory</h1>
              <p className="text-sm text-slate-400 max-w-xl">
                Configure structured container shells linked to primary classes. Populate and organize assessment items step-by-step inside each safe repository.
              </p>
            </div>
            <Button 
              onClick={() => setIsBankModalOpen(true)} 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm gap-1.5 sm:self-start w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" /> New Question Bank
            </Button>
          </div>

          {/* Inline Flat Summary Metrics row (Avoids redundant cards block below) */}
          <div className="grid grid-cols-2 gap-4 sm:flex sm:items-center sm:gap-8 text-sm">
            <div className="space-y-0.5">
              <span className="text-slate-500 text-xs">Total Indexes</span>
              <p className="text-xl font-semibold text-slate-100">{stats.total}</p>
            </div>
            <div className="space-y-0.5 border-l border-slate-800 pl-4 sm:pl-8">
              <span className="text-slate-500 text-xs">Personal Shells</span>
              <p className="text-xl font-semibold text-slate-100">{stats.mine}</p>
            </div>
            <div className="space-y-0.5 border-l border-slate-800 pl-4 sm:pl-8">
              <span className="text-slate-500 text-xs">Network Shared</span>
              <p className="text-xl font-semibold text-slate-100">{stats.shared}</p>
            </div>
            <div className="space-y-0.5 border-l border-slate-800 pl-4 sm:pl-8">
              <span className="text-slate-500 text-xs">Linked Subject/Classes</span>
              <p className="text-xl font-semibold text-slate-100">{stats.subjectClasses}</p>
            </div>
          </div>
        </section>

        {/* Catalog Search & Filtering Layout */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="space-y-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-medium">Bank Shell Registry</CardTitle>
                <CardDescription className="text-xs">Browse, target, and edit structural scopes.</CardDescription>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs h-9"
                  placeholder="Filter title, details or tags..."
                />
              </div>
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <select
                  value={filterVisibility}
                  onChange={(e) => setFilterVisibility(e.target.value as FilterVisibility)}
                  className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="all">All network rules</option>
                  <option value="private">Private Scope Only</option>
                  <option value="public_school">Shared System Wide</option>
                </select>
              </div>
              <div className="relative sm:col-span-2 lg:col-span-1">
                <select
                  value={bankSubjectClassId}
                  onChange={(e) => setBankSubjectClassId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Default dynamic subjects</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {subjectClassLabelMap.get(item.id)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {filteredBanks.length === 0 ? (
              <div className="py-12 text-center space-y-3 max-w-sm mx-auto">
                <BookOpen className="mx-auto h-6 w-6 text-slate-300" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No active indexes discovered</p>
                  <p className="text-xs text-slate-400">Modify active keyword metrics or register your first primary question bank shell profile.</p>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setIsBankModalOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Initial Entry
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBanks.map((bank) => {
                  const visibilityMeta = getVisibilityMeta(bank.visibility);
                  const VisibilityIcon = visibilityMeta.icon;
                  const subjectClassLabel = subjectClassLabelMap.get(bank.subject_class_id) || 'General Category Context';

                  return (
                    <Card key={bank.id} className="border-slate-200 dark:border-slate-800 shadow-none hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                      <CardHeader className="space-y-2 p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <CardTitle className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 line-clamp-1">{bank.title}</CardTitle>
                            <CardDescription className="text-xs font-medium text-blue-600 dark:text-blue-400 line-clamp-1">{subjectClassLabel}</CardDescription>
                          </div>
                          <Badge variant="outline" className={`shrink-0 text-[10px] px-2 py-0.5 gap-1 font-medium ${visibilityMeta.className}`}>
                            <VisibilityIcon className="h-3 w-3" />
                            {visibilityMeta.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-4 pt-1 space-y-4 flex flex-col justify-between h-full">
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {bank.description || 'No analytical description logged for this storage shell context element yet.'}
                        </p>

                        <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3 text-[11px] text-slate-400">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Managed</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(bank.updated_at || bank.created_at)}</span>
                          </div>
                        </div>

                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 mt-2"
                          onClick={() => router.push(`/teacher/question-bank/${bank.id}`)}
                        >
                          Configure Questions
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creation Modal Element */}
      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base font-semibold">Create Question Bank Shell</DialogTitle>
            <DialogDescription className="text-xs">
              Establish core metadata configuration nodes before initializing dynamic quiz parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="bank-title" className="text-xs">Primary Shell Title</Label>
              <Input
                id="bank-title"
                value={bankTitle}
                onChange={(e) => setBankTitle(e.target.value)}
                placeholder="e.g. JSS2 Mathematics Third Term Core"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bank-description" className="text-xs">Description Meta</Label>
              <Textarea
                id="bank-description"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                placeholder="Summarize target criteria metrics for testing use..."
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Affiliated Class Link</Label>
                <select
                  value={bankSubjectClassId}
                  onChange={(e) => setBankSubjectClassId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Select match</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {subjectClassLabelMap.get(item.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Security Context</Label>
                <select
                  value={bankVisibility}
                  onChange={(e) => setBankVisibility(e.target.value as 'private' | 'public_school')}
                  className="h-9 w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="public_school">Shared with School Network</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsBankModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateBank} disabled={isCreatingBank} className="text-xs bg-blue-600 hover:bg-blue-700 text-white">
              {isCreatingBank ? 'Creating...' : 'Initialize Index Container'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}