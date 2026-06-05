"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
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
  Link2,
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
      <div
        className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}
      >
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
      {/* top */}
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

      {/* bottom */}
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

/* ─────────────────────────────── page ─────────────────────────────── */

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
    const mine = banks.filter((b) => b.created_by_teacher_id === teacherId);
    const shared = banks.filter((b) => b.visibility === 'public_school');
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
        toast.error(response.status === 401 ? 'Please log in to continue' : 'Failed to load question bank overview');
        return;
      }
      setTeacherId(payload.teacherId ?? '');
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
      router.push(`/teacher/question-bank/${createdBank.id}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create question bank');
    } finally {
      setIsCreatingBank(false);
    }
  }

  /* ── loading ── */
  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto h-9 w-9 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            <p className="text-sm text-stone-500 font-medium">Loading your question banks…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  /* ── page ── */
  return (
    <DashboardLayout role="teacher">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600;700&display=swap');
        .font-display { font-family: 'Instrument Serif', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        * { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div className="space-y-8 pb-16 font-body">

        {/* ── Hero header ── */}
        <header className="relative overflow-hidden rounded-3xl bg-stone-950 px-7 py-9 text-white shadow-2xl lg:px-10 lg:py-11">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 right-32 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto]">
            {/* left copy */}
            <div className="space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-stone-300">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                Question Banks
              </span>

              <h1 className="font-display text-3xl italic leading-tight text-white sm:text-4xl">
                Organise your questions,{' '}
                <span className="not-italic text-amber-400">one bank at a time.</span>
              </h1>

              <p className="max-w-lg text-sm leading-7 text-stone-400">
                Each bank is a container linked to a subject and class. Set it up here — then fill it with questions later.
              </p>

              <button
                onClick={() => setIsBankModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                New question bank
              </button>
            </div>

            {/* right — inline stat pills */}
            <div className="flex flex-row items-start gap-3 lg:flex-col lg:items-end lg:justify-center">
              {[
                { label: 'Total banks', value: stats.total },
                { label: 'Shared', value: stats.shared },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center backdrop-blur-sm"
                >
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-stone-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* ── Stats row ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={BookOpen} label="Total banks" value={stats.total} accent="bg-amber-50 text-amber-600 border border-amber-100" />
          <StatCard icon={BookMarked} label="Your banks" value={stats.mine} accent="bg-violet-50 text-violet-600 border border-violet-100" />
          <StatCard icon={Share2} label="Shared with school" value={stats.shared} accent="bg-sky-50 text-sky-600 border border-sky-100" />
          <StatCard icon={Link2} label="Subject/class links" value={stats.subjectClasses} accent="bg-emerald-50 text-emerald-600 border border-emerald-100" />
        </div>

        {/* ── Bank registry ── */}
        <section className="space-y-5">
          {/* toolbar */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-stone-900">Bank registry</h2>
              <p className="text-sm text-stone-400">
                {filteredBanks.length} of {banks.length} bank{banks.length !== 1 ? 's' : ''} shown
              </p>
            </div>

            <button
              onClick={() => setIsBankModalOpen(true)}
              className="inline-flex items-center gap-2 self-start rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 md:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              New bank
            </button>
          </div>

          {/* filters */}
          <div className="grid gap-3 rounded-2xl border border-stone-100 bg-stone-50 p-4 sm:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-stone-200 bg-white pl-9 text-sm placeholder:text-stone-400 focus-visible:ring-amber-400/40"
                placeholder="Search by title, subject, or description…"
              />
            </div>

            <div className="relative">
              <select
                value={filterVisibility}
                onChange={(e) => setFilterVisibility(e.target.value as FilterVisibility)}
                className="h-10 w-full appearance-none rounded-xl border border-stone-200 bg-white px-3.5 pr-8 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              >
                <option value="all">All visibility</option>
                <option value="private">Private only</option>
                <option value="public_school">Shared only</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            </div>
          </div>

          {/* grid */}
          {banks.length === 0 ? (
            <EmptyState onCreateClick={() => setIsBankModalOpen(true)} />
          ) : filteredBanks.length === 0 ? (
            <NoResults />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredBanks.map((bank) => (
                <BankCard
                  key={bank.id}
                  bank={bank}
                  subjectClassLabel={subjectClassLabelMap.get(bank.subject_class_id) ?? 'Unknown subject/class'}
                  onOpen={() => router.push(`/teacher/question-bank/${bank.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Create bank modal ── */}
      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="gap-0 overflow-hidden rounded-2xl border-stone-200 p-0 sm:max-w-[500px]">
          {/* modal header strip */}
          <div className="border-b border-stone-100 bg-stone-50 px-6 py-5">
            <DialogHeader>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 border border-amber-100 mb-3">
                <BookMarked className="h-4.5 w-4.5 text-amber-600" />
              </div>
              <DialogTitle className="text-base font-bold text-stone-900">
                Create question bank
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-500">
                Set up the bank shell first. You can add and manage questions after.
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* form body */}
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="bank-title" className="text-sm font-semibold text-stone-700">
                Bank title
              </Label>
              <Input
                id="bank-title"
                value={bankTitle}
                onChange={(e) => setBankTitle(e.target.value)}
                placeholder="e.g. JSS2 Mathematics Term 3"
                className="rounded-xl border-stone-200 focus-visible:ring-amber-400/40"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank-description" className="text-sm font-semibold text-stone-700">
                Description{' '}
                <span className="font-normal text-stone-400">(optional)</span>
              </Label>
              <Textarea
                id="bank-description"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                placeholder="Explain what this bank will be used for."
                rows={3}
                className="rounded-xl border-stone-200 resize-none focus-visible:ring-amber-400/40"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-stone-700">Subject & class</Label>
                <div className="relative">
                  <select
                    value={bankSubjectClassId}
                    onChange={(e) => setBankSubjectClassId(e.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-stone-200 bg-white px-3.5 pr-8 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  >
                    <option value="">Select subject/class</option>
                    {subjectClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {subjectClassLabelMap.get(item.id)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-stone-700">Visibility</Label>
                <div className="relative">
                  <select
                    value={bankVisibility}
                    onChange={(e) =>
                      setBankVisibility(e.target.value as 'private' | 'public_school')
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-stone-200 bg-white px-3.5 pr-8 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  >
                    <option value="private">Private — only me</option>
                    <option value="public_school">Shared with school</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                </div>
              </div>
            </div>
          </div>

          {/* footer */}
          <DialogFooter className="border-t border-stone-100 bg-stone-50 px-6 py-4">
            <Button
              variant="ghost"
              onClick={() => setIsBankModalOpen(false)}
              className="rounded-xl text-stone-600 hover:bg-stone-100 hover:text-stone-800"
            >
              Cancel
            </Button>
            <button
              onClick={handleCreateBank}
              disabled={isCreatingBank}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isCreatingBank ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Create bank
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
} 