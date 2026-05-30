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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, BookOpen, Layers, Lock, Globe2
} from 'lucide-react';

import { SlidersHorizontal, Search } from 'lucide-react';
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
        label: 'Shared with school',
        icon: Globe2,
        className: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    }

    return {
      label: 'Private',
      icon: Lock,
      className: 'bg-gray-50 text-gray-700 border-gray-200',
    };
  }

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div className="mx-auto h-10 w-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-gray-500">Loading question bank overview…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8 pb-12">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.75)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.4fr_0.9fr] lg:px-8 lg:py-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                <Layers className="h-3.5 w-3.5" />
                Question bank overview
              </div>
              <div className="space-y-3 max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Create each bank here, then build the questions later.
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  This page stays focused on bank setup and properties only: title, linked subject/class, visibility,
                  and a short description to keep your structure tidy from the start.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setIsBankModalOpen(true)} className="gap-2 bg-white text-slate-950 hover:bg-slate-100">
                  <Plus className="h-4 w-4" /> New question bank
                </Button>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
                  <BookOpen className="h-4 w-4 text-sky-300" />
                  {stats.total} bank{stats.total === 1 ? '' : 's'} tracked
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Banks created</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
                  <p className="mt-1 text-sm text-slate-300">Current overview of all visible and owned banks.</p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Your banks</p>
                  <p className="mt-2 text-2xl font-semibold">{stats.mine}</p>
                  <p className="mt-1 text-sm text-slate-300">Banks created under your teacher profile.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Total banks</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Your banks</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.mine}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Shared with school</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.shared}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Subject/class links</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.subjectClasses}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-lg">Bank registry</CardTitle>
                <CardDescription>
                  Search by title or subject/class, then create a new bank when you need a fresh container.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setIsBankModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New bank
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  placeholder="Search banks, descriptions, or linked subjects..."
                />
              </div>
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <select
                  value={filterVisibility}
                  onChange={(e) => setFilterVisibility(e.target.value as FilterVisibility)}
                  className="h-10 w-full rounded-md border border-input bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="all">All visibility</option>
                  <option value="private">Private only</option>
                  <option value="public_school">Shared only</option>
                </select>
              </div>
              <div className="relative">
                <select
                  value={bankSubjectClassId}
                  onChange={(e) => setBankSubjectClassId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Default subject/class</option>
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
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  {banks.length === 0 ? 'No question banks yet' : 'No banks match your filters'}
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                  Start by creating a bank for a subject/class combination. That gives you a clean container before
                  questions are added later.
                </p>
                <Button className="mt-6 gap-2" onClick={() => setIsBankModalOpen(true)}>
                  <Plus className="h-4 w-4" /> Create a bank
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredBanks.map((bank) => {
                  const visibilityMeta = getVisibilityMeta(bank.visibility);
                  const VisibilityIcon = visibilityMeta.icon;
                  const subjectClassLabel = subjectClassLabelMap.get(bank.subject_class_id) || 'Unknown subject/class';

                  return (
                    <Card key={bank.id} className="border-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <CardTitle className="text-base leading-snug">{bank.title}</CardTitle>
                            <CardDescription className="text-sm">{subjectClassLabel}</CardDescription>
                          </div>
                          <Badge variant="outline" className={`shrink-0 gap-1.5 ${visibilityMeta.className}`}>
                            <VisibilityIcon className="h-3.5 w-3.5" />
                            {visibilityMeta.label}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pb-5">
                        <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                          {bank.description || 'No description was added for this bank yet.'}
                        </p>

                        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Created</span>
                            <span className="font-medium text-slate-900">{formatDate(bank.created_at)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Updated</span>
                            <span className="font-medium text-slate-900">{formatDate(bank.updated_at || bank.created_at)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Bank ID</span>
                            <span className="max-w-[10rem] truncate font-mono text-xs text-slate-900">{bank.id}</span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => router.push(`/teacher/question-bank/${bank.id}`)}
                        >
                          Open properties
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

      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create question bank</DialogTitle>
            <DialogDescription>
              Set up the bank shell first. You can add and manage questions after the structure is in place.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="bank-title">Bank title</Label>
              <Input
                id="bank-title"
                value={bankTitle}
                onChange={(e) => setBankTitle(e.target.value)}
                placeholder="e.g. JSS2 Mathematics Term 3"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank-description">
                Description <span className="font-normal text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id="bank-description"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                placeholder="Explain what this bank will be used for."
                rows={3}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Subject & class</Label>
                <select
                  value={bankSubjectClassId}
                  onChange={(e) => setBankSubjectClassId(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Select subject/class</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {subjectClassLabelMap.get(item.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <select
                  value={bankVisibility}
                  onChange={(e) => setBankVisibility(e.target.value as 'private' | 'public_school')}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="private">Private - only me</option>
                  <option value="public_school">Shared with school</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBankModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBank} disabled={isCreatingBank}>
              {isCreatingBank ? 'Creating...' : 'Create bank'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}