"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolContext } from '@/hooks/use-school-context';
import { ArrowLeft, BookOpen, Globe2, Layers, Lock, Save } from 'lucide-react';
import { toast } from 'sonner';

type SubjectClassItem = {
  id: string;
  subjects?: { id: string; name: string } | null;
  classes?: { id: string; name: string } | null;
};

type BankRecord = {
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
};

type BankPayload = {
  bank: BankRecord;
  questionCount: number;
};

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function TeacherQuestionBankDetailPage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectClassId, setSubjectClassId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public_school'>('private');
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (schoolId && bankId) {
      void loadPage();
    }
  }, [schoolId, bankId]);

  const subjectClassLabelMap = useMemo(() => {
    return new Map(
      subjectClasses.map((item) => [
        item.id,
        `${item.subjects?.name || 'Subject'} — ${item.classes?.name || 'Class'}`,
      ])
    );
  }, [subjectClasses]);

  const isEditable = bank ? bank.created_by_teacher_id === teacherId : false;

  async function loadPage() {
    setIsLoading(true);
    try {
      const [contextResponse, bankResponse] = await Promise.all([
        fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
      ]);

      const contextPayload = (await contextResponse.json()) as ContextPayload | { error: string };
      const bankPayload = (await bankResponse.json()) as BankPayload | { error: string };

      if (!contextResponse.ok || 'error' in contextPayload) {
        toast.error('Failed to load question bank data');
        return;
      }

      if (!bankResponse.ok || 'error' in bankPayload) {
        toast.error((bankPayload as { error?: string })?.error || 'Question bank not found');
        router.push('/teacher/question-bank');
        return;
      }

      setTeacherId(contextPayload.teacherId || '');
      setSubjectClasses(contextPayload.subjectClasses || []);
      setBank(bankPayload.bank || null);
      setQuestionCount(bankPayload.questionCount || 0);

      if (bankPayload.bank) {
        setTitle(bankPayload.bank.title || '');
        setDescription(bankPayload.bank.description || '');
        setSubjectClassId(bankPayload.bank.subject_class_id || '');
        setVisibility(bankPayload.bank.visibility || 'private');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load question bank data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!isEditable) {
      toast.error('You can only edit banks you created');
      return;
    }

    if (!title.trim() || !subjectClassId) {
      toast.error('Add a title and select a subject/class');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/teacher/question-bank/banks/${bankId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          subjectClassId,
          visibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to update question bank');
        return;
      }

      setBank(payload.bank as BankRecord);
      toast.success('Question bank updated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update question bank');
    } finally {
      setIsSaving(false);
    }
  }

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div className="mx-auto h-10 w-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-gray-500">Loading bank properties…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!bank) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardContent className="space-y-4 p-8 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold text-slate-900">Question bank not found</h1>
                <p className="text-sm text-slate-500">This bank may have been removed or you may not have access to it.</p>
              </div>
              <Button onClick={() => router.push('/teacher/question-bank')}>Back to overview</Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const visibilityClassName =
    visibility === 'public_school' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-gray-50 text-gray-700 border-gray-200';
  const VisibilityIcon = visibility === 'public_school' ? Globe2 : Lock;

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8 pb-12">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.75)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.25fr_0.9fr] lg:px-8 lg:py-10">
            <div className="space-y-4">
              <Button
                variant="ghost"
                className="w-fit gap-2 px-0 text-slate-300 hover:bg-transparent hover:text-white"
                onClick={() => router.push('/teacher/question-bank')}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to overview
              </Button>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
                <Layers className="h-3.5 w-3.5" />
                Bank properties
              </div>
              <div className="space-y-3 max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{bank.title}</h1>
                <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                  Manage the bank shell first. Keep the title, subject/class link, visibility, and description tidy before adding questions.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className={`gap-1.5 ${visibilityClassName}`}>
                  <VisibilityIcon className="h-3.5 w-3.5" />
                  {visibility === 'public_school' ? 'Shared with school' : 'Private'}
                </Badge>
                <Badge variant="outline" className="border-white/15 bg-white/5 text-white">
                  {questionCount} question{questionCount === 1 ? '' : 's'} inside
                </Badge>
                {!isEditable && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                    View only
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Created</p>
                  <p className="mt-2 text-2xl font-semibold">{formatDate(bank.created_at)}</p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/5 text-white backdrop-blur-sm">
                <CardContent className="p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Updated</p>
                  <p className="mt-2 text-2xl font-semibold">{formatDate(bank.updated_at || bank.created_at)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Question count</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{questionCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Visibility</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {visibility === 'public_school' ? 'Shared' : 'Private'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-500">Bank ID</p>
              <p className="mt-2 truncate text-sm font-semibold text-gray-900">{bank.id}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/60">
            <CardTitle className="text-lg">Edit bank properties</CardTitle>
            <CardDescription>
              Keep the structure tidy before you begin filling the bank with questions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            {!isEditable && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This bank is shared with you, so the properties are read-only.
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="bank-title">Bank title</Label>
              <Input
                id="bank-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!isEditable}
                placeholder="e.g. JSS2 Mathematics Term 3"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank-description">
                Description <span className="font-normal text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id="bank-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isEditable}
                placeholder="Explain what this bank will be used for."
                rows={4}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Subject & class</Label>
                <select
                  value={subjectClassId}
                  onChange={(e) => setSubjectClassId(e.target.value)}
                  disabled={!isEditable}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'private' | 'public_school')}
                  disabled={!isEditable}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="private">Private - only me</option>
                  <option value="public_school">Shared with school</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={!isEditable || isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save properties'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/teacher/question-bank')}>
                Back to overview
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}