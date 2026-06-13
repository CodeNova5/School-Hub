"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  BookOpen,
  Layers,
  Lock,
  Globe2,
  Search,
  ArrowRight,
  BookMarked,
  Share2,
  ChevronDown,
} from 'lucide-react';
import { useSchoolContext } from '@/hooks/use-school-context';

/* ─────────────────────────────── types ─────────────────────────────── */

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
  created_by_teacher_id?: string | null;
  created_by_admin_id?: string | null;
  created_at: string;
  updated_at?: string;
};

type ContextPayload = {
  userId: string;
  subjectClasses: SubjectClassItem[];
  banks: QuestionBankItem[];
};

type FilterVisibility = 'all' | 'private' | 'public_school';

interface QuestionBankOverviewProps {
  role: 'admin' | 'teacher';
  apiEndpointPrefix: string; // e.g., '/api/teacher/question-bank' or '/api/admin/question-bank'
  routePrefix: string;       // e.g., '/teacher/question-bank' or '/admin/question-bank'
}

/* ─────────────────────────────── helpers ─────────────────────────────── */

function formatDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

/* ─────────────────────────────── sub-components ─────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-stone-900">{value}</p>
    </div>
  );
}

function VisibilityPill({ visibility }: { visibility: QuestionBankItem['visibility'] }) {
  if (visibility === 'public_school') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
        <Globe2 className="h-3 w-3" />
        School
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-[11px] font-semibold text-stone-500">
      <Lock className="h-3 w-3" />
      Private
    </span>
  );
}

function BankCard({
  bank,
  subjectClassLabel,
  onOpen,
}: {
  bank: QuestionBankItem;
  subjectClassLabel: string;
  onOpen: () => void;
}) {
  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-stone-300">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
            <BookMarked className="h-4.5 w-4.5 text-amber-600" />
          </div>
          <VisibilityPill visibility={bank.visibility} />
        </div>

        <div>
          <h3 className="text-[15px] font-bold leading-snug text-stone-900 group-hover:text-amber-700 transition-colors">
            {bank.title}
          </h3>
          <p className="mt-0.5 text-xs font-medium text-stone-400">{subjectClassLabel}</p>
        </div>

        {bank.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-stone-500">{bank.description}</p>
        )}
      </div>

      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3.5 py-2.5 text-xs text-stone-500">
          <span>Updated</span>
          <span className="font-semibold text-stone-700">
            {formatDate(bank.updated_at || bank.created_at)}
          </span>
        </div>

        <button
          onClick={onOpen}
          className="group/btn flex w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
        >
          Open bank
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-8 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-100">
        <BookOpen className="h-7 w-7 text-amber-500" />
      </div>
      <h3 className="text-lg font-bold text-stone-800">No question banks yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500 leading-relaxed">
        Create your first bank to start organising questions by subject and class.
      </p>
      <button
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-stone-800 transition-colors"
      >
        <Plus className="h-4 w-4" />
        Create a bank
      </button>
    </div>
  );
}

function NoResults() {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-200 bg-stone-50/50 px-8 py-16 text-center">
      <Search className="h-8 w-8 text-stone-300 mb-3" />
      <h3 className="text-base font-bold text-stone-700">No banks match your filters</h3>
      <p className="mt-1 text-sm text-stone-400">Try adjusting your search or filter criteria.</p>
    </div>
  );
}

/* ─────────────────────────────── main component ─────────────────────── */

export function QuestionBankOverview({ role, apiEndpointPrefix, routePrefix }: QuestionBankOverviewProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [userId, setUserId] = useState('');
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
    if (schoolId) void loadContext();
  }, [schoolId]);

  const subjectClassLabelMap = useMemo(
    () =>
      new Map(
        subjectClasses.map((item) => [
          item.id,
          `${item.subjects?.name ?? 'Subject'} — ${item.classes?.name ?? 'Class'}`,
        ])
      ),
    [subjectClasses]
  );

  const filteredBanks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return banks.filter((bank) => {
      const matchesSearch =
        !query ||
        bank.title.toLowerCase().includes(query) ||
        (bank.description ?? '').toLowerCase().includes(query) ||
        (subjectClassLabelMap.get(bank.subject_class_id) ?? '').toLowerCase().includes(query);
      const matchesVisibility = filterVisibility === 'all' || bank.visibility === filterVisibility;
      return matchesSearch && matchesVisibility;
    });
  }, [banks, filterVisibility, searchTerm, subjectClassLabelMap]);

  const stats = useMemo(() => {
    const mine = banks.filter((b) => 
      role === 'teacher' ? b.created_by_teacher_id === userId : b.created_by_admin_id === userId
    );
    const shared = banks.filter((b) => b.visibility === 'public_school');
    return {
      total: banks.length,
      mine: mine.length,
      shared: shared.length,
      subjectClasses: subjectClasses.length,
    };
  }, [banks, subjectClasses.length, userId, role]);

  async function loadContext() {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiEndpointPrefix}/context`, { cache: 'no-store' });
      const payload = (await response.json()) as ContextPayload | { error: string };
      if (!response.ok || 'error' in payload) {
        toast.error(response.status === 401 ? 'Please log in to continue' : 'Failed to load question bank overview');
        return;
      }
      setUserId(payload.userId ?? '');
      setSubjectClasses(payload.subjectClasses ?? []);
      setBanks(payload.banks ?? []);
      if ((payload.subjectClasses?.length ?? 0) > 0) {
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
      const response = await fetch(`${apiEndpointPrefix}/banks`, {
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
        toast.error(payload?.error ?? 'Failed to create question bank');
        return;
      }
      const createdBank = payload.bank as QuestionBankItem;
      setBanks((prev) => [createdBank, ...prev]);
      setBankTitle('');
      setBankDescription('');
      setBankVisibility('private');
      setIsBankModalOpen(false);
      toast.success('Question bank created');
      router.push(`${routePrefix}/${createdBank.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create question bank');
    } finally {
      setIsCreatingBank(false);
    }
  }

  if (schoolLoading || isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="mx-auto h-9 w-9 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading question banks…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-50 to-amber-50/30">
      <div className="border-b border-stone-200 bg-white/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-6 sm:py-8">
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-stone-950 tracking-tight">
                  Question Banks
                </h1>
              </div>
              <p className="text-stone-600 text-sm sm:text-base ml-13">
                Organize and manage question collections by subject and class
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={BookMarked} label="Total Banks" value={stats.total} accent="bg-amber-100 text-amber-700" />
              <StatCard icon={BookOpen} label={role === 'admin' ? "Admin Banks" : "My Banks"} value={stats.mine} accent="bg-blue-100 text-blue-700" />
              <StatCard icon={Share2} label="Shared" value={stats.shared} accent="bg-emerald-100 text-emerald-700" />
              <StatCard icon={Layers} label="Subject/Class" value={stats.subjectClasses} accent="bg-purple-100 text-purple-700" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
                <Input
                  placeholder="Search banks by title, subject, or class…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-stone-200 bg-white focus:border-amber-300 focus:ring-amber-100 placeholder:text-stone-400"
                />
              </div>

              <div className="flex gap-3 sm:gap-4">
                <div className="relative group">
                  <button className="h-10 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 flex items-center gap-2 hover:bg-stone-50 hover:border-stone-300 transition-colors">
                    <Lock className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {filterVisibility === 'all'
                        ? 'All Banks'
                        : filterVisibility === 'private'
                          ? 'Private'
                          : 'Shared'}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>

                  <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-stone-200 rounded-lg shadow-lg z-20">
                    {(
                      [
                        { label: 'All Banks', value: 'all' as const },
                        { label: 'Private', value: 'private' as const },
                        { label: 'Shared', value: 'public_school' as const },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFilterVisibility(option.value)}
                        className={`px-4 py-2.5 text-sm text-left font-medium transition-colors first:rounded-t-md last:rounded-b-md ${filterVisibility === option.value
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-stone-700 hover:bg-stone-50'
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setBankTitle('');
                    setBankDescription('');
                    setBankVisibility('private');
                    setIsBankModalOpen(true);
                  }}
                  className="h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-amber-600 hover:to-amber-700 transition-all flex items-center gap-2 hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Bank</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 sm:py-12">
        {banks.length === 0 ? (
          <EmptyState onCreateClick={() => setIsBankModalOpen(true)} />
        ) : filteredBanks.length === 0 ? (
          <NoResults />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 auto-rows-max">
            {filteredBanks.map((bank) => (
              <BankCard
                key={bank.id}
                bank={bank}
                subjectClassLabel={subjectClassLabelMap.get(bank.subject_class_id) ?? 'Subject — Class'}
                onOpen={() => router.push(`${routePrefix}/${bank.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <BookMarked className="h-4 w-4 text-amber-700" />
              </div>
              <DialogTitle className="text-xl">Create a new question bank</DialogTitle>
            </div>
            <DialogDescription>
              Set up a new collection to organize your questions by subject and class.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="bank-title" className="text-sm font-semibold text-stone-900">
                Bank title
              </Label>
              <Input
                id="bank-title"
                placeholder="e.g., Biology Chapter 5 MCQs"
                value={bankTitle}
                onChange={(e) => setBankTitle(e.target.value)}
                className="rounded-lg border-stone-200 focus:border-amber-300 focus:ring-amber-100"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-description" className="text-sm font-semibold text-stone-900">
                Description <span className="font-normal text-stone-500 ml-1">(optional)</span>
              </Label>
              <Textarea
                id="bank-description"
                placeholder="Add notes about this bank's content…"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                className="min-h-20 rounded-lg border-stone-200 focus:border-amber-300 focus:ring-amber-100 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-class" className="text-sm font-semibold text-stone-900">
                Subject & Class
              </Label>
              <select
                id="subject-class"
                value={bankSubjectClassId}
                onChange={(e) => setBankSubjectClassId(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium text-stone-900 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-colors"
              >
                <option value="">Choose a subject & class…</option>
                {subjectClasses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subjects?.name ?? 'Subject'} — {item.classes?.name ?? 'Class'}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 rounded-xl bg-stone-50 p-4">
              <Label className="text-sm font-semibold text-stone-900">Visibility</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={bankVisibility === 'private'}
                    onChange={(e) => setBankVisibility(e.target.value as 'private')}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-900">Private</p>
                    <p className="text-xs text-stone-500">Only you can access</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="visibility"
                    value="public_school"
                    checked={bankVisibility === 'public_school'}
                    onChange={(e) => setBankVisibility(e.target.value as 'public_school')}
                    className="h-4 w-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-900">School</p>
                    <p className="text-xs text-stone-500">Your school can access</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsBankModalOpen(false)}
              className="rounded-lg border-stone-200 text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBank}
              disabled={isCreatingBank}
              className="rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 disabled:opacity-50"
            >
              {isCreatingBank ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-amber-200 border-t-white animate-spin mr-2" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create bank
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}