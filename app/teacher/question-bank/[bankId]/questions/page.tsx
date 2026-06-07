"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolContext } from '@/hooks/use-school-context';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ImagePlus,
  Loader2,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type QuestionRecord = {
  id: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_answer?: string | null;
  explanation?: string | null;
  question_type: 'objective' | 'theory';
  difficulty: 'easy' | 'medium' | 'hard';
  visibility: 'private' | 'public_school';
};

type ContextPayload = {
  teacherId: string;
  subjectClasses: SubjectClassItem[];
};

type BankPayload = {
  bank: BankRecord;
  questionCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_META: Record<
  'easy' | 'medium' | 'hard',
  { label: string; color: string; bg: string; dot: string }
> = {
  easy: {
    label: 'Easy',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  medium: {
    label: 'Medium',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
  },
  hard: {
    label: 'Hard',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    dot: 'bg-red-500',
  },
};

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-3">
      {children}
    </p>
  );
}

function ToggleChip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${active
          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeacherQuestionManualCreatePage() {
  const params = useParams<{ bankId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const bankId =
    typeof params?.bankId === 'string'
      ? params.bankId
      : Array.isArray(params?.bankId)
        ? params.bankId[0]
        : '';
  const questionId = searchParams?.get('questionId') || '';
  const isEditingMode = !!questionId;

  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedTerm, setSelectedTerm] = useState<'1' | '2' | '3'>('1');
  const [topicGroups, setTopicGroups] = useState<
    { id: string; title: string; topics: string[]; term?: number }[]
  >([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'objective' | 'theory'>('objective');
  const [optionCount, setOptionCount] = useState<number>(4);
  const [options, setOptions] = useState<string[]>(['', '', '', '', '', '']);
  const [correctOptionIdx, setCorrectOptionIdx] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [visibility, setVisibility] = useState<'private' | 'public_school'>('private');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null);
  const [questionImagePreview, setQuestionImagePreview] = useState('');

  const activeOptions = useMemo(() => options.slice(0, optionCount), [options, optionCount]);

  const subjectClassLabelMap = useMemo(
    () =>
      new Map(
        subjectClasses.map((item) => [
          item.id,
          `${item.subjects?.name || 'Subject'} — ${item.classes?.name || 'Class'}`,
        ])
      ),
    [subjectClasses]
  );

  const selectedSubjectClassLabel = bank
    ? subjectClassLabelMap.get(bank.subject_class_id) || 'Selected class'
    : 'Selected class';

  useEffect(() => {
    if (schoolId && bankId) void loadPage();
  }, [schoolId, bankId, questionId]);

  useEffect(() => {
    const topics = topicGroups
      .filter((g) => String(g.term ?? 1) === selectedTerm)
      .flatMap((g) => g.topics || []);
    setAvailableTopics(topics);
  }, [topicGroups, selectedTerm]);

  useEffect(() => {
    if (correctOptionIdx !== null && correctOptionIdx >= optionCount) {
      setCorrectOptionIdx(null);
    }
  }, [optionCount, correctOptionIdx]);

  useEffect(() => {
    if (!questionImageFile) {
      setQuestionImagePreview('');
      return;
    }
    const previewUrl = URL.createObjectURL(questionImageFile);
    setQuestionImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [questionImageFile]);

  function handleOptionChange(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  }

  async function loadPage() {
    setIsLoading(true);
    try {
      const promises: [
        Promise<Response>,
        Promise<Response>,
        Promise<Response>,
        Promise<Response>?,
      ] = [
          fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
          fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
          fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
        ];

      if (questionId) {
        promises.push(
          fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, { cache: 'no-store' })
        );
      }

      const [contextResponse, bankResponse, groupsResponse, questionsResponse] =
        await Promise.all(promises);

      const contextPayload = (await contextResponse.json()) as ContextPayload | { error: string };
      const bankPayload = (await bankResponse.json()) as BankPayload | { error: string };
      const groupsPayload = (await groupsResponse.json()) as
        | { groups?: { id: string; title: string; topics: string[]; term?: number }[] }
        | { error: string };

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

      const groups =
        !groupsResponse.ok || 'error' in groupsPayload ? [] : groupsPayload.groups || [];
      setTopicGroups(groups);
      setVisibility(bankPayload.bank?.visibility || 'private');

      if (questionId && questionsResponse && questionsResponse.ok) {
        const questionsPayload = await questionsResponse.json();
        const existingQuestion = (questionsPayload.questions || []).find(
          (q: QuestionRecord) => q.id === questionId
        ) as QuestionRecord;

        if (existingQuestion) {
          setQuestionText(existingQuestion.question_text);
          setQuestionType(existingQuestion.question_type);
          setDifficulty(existingQuestion.difficulty);
          setVisibility(existingQuestion.visibility);
          setExplanation(existingQuestion.explanation || '');

          const matchingGroup = groups.find((g) => g.topics?.includes(existingQuestion.topic));
          if (matchingGroup && matchingGroup.term) {
            setSelectedTerm(String(matchingGroup.term) as '1' | '2' | '3');
          }
          setSelectedTopic(existingQuestion.topic);

          if (existingQuestion.question_type === 'objective' && existingQuestion.options) {
            const fetchedOpts = existingQuestion.options;
            setOptionCount(fetchedOpts.length);
            const extendedOpts = ['', '', '', '', '', ''];
            fetchedOpts.forEach((val, idx) => {
              extendedOpts[idx] = val;
            });
            setOptions(extendedOpts);

            const savedAnswer = existingQuestion.correct_answer;
            if (savedAnswer && /^[A-H]$/i.test(savedAnswer)) {
              const correctIdx = savedAnswer.toUpperCase().charCodeAt(0) - 65;
              if (correctIdx >= 0 && correctIdx < fetchedOpts.length) {
                setCorrectOptionIdx(correctIdx);
              }
            }
          } else {
            setCorrectAnswer(existingQuestion.correct_answer || '');
          }
        } else {
          toast.error('Question not found in this bank');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load question bank data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!bank || bank.created_by_teacher_id !== teacherId) {
      toast.error('You lack proper author permissions for this question bank');
      return;
    }

    const trimmedTopic = selectedTopic.trim();
    const trimmedQuestionText = questionText.trim();
    const trimmedExplanation = explanation.trim();
    const trimmedCorrectAnswer = correctAnswer.trim();
    let payloadOptions: string[] = [];
    let payloadCorrectAnswer = trimmedCorrectAnswer;

    if (!trimmedTopic || !trimmedQuestionText) {
      toast.error('Select a topic and add question text');
      return;
    }

    if (questionType === 'objective') {
      const cleanedOptions = activeOptions.map((opt) => opt.trim());
      if (cleanedOptions.some((opt) => !opt)) {
        toast.error(`Please fill out all ${optionCount} options before saving.`);
        return;
      }
      if (correctOptionIdx === null) {
        toast.error('Please mark one of the options as the correct answer.');
        return;
      }
      payloadOptions = cleanedOptions;
      payloadCorrectAnswer = payloadOptions[correctOptionIdx];
    } else {
      payloadOptions = [];
    }

    setIsSaving(true);
    try {
      const hasQuestionImage = Boolean(questionImageFile);
      const requestBody = hasQuestionImage ? new FormData() : null;

      if (requestBody) {
        requestBody.append('topic', trimmedTopic);
        requestBody.append('questionText', trimmedQuestionText);
        requestBody.append('questionType', questionType);
        requestBody.append('difficulty', difficulty);
        requestBody.append('visibility', visibility);
        requestBody.append('options', JSON.stringify(payloadOptions));
        requestBody.append('correctAnswer', payloadCorrectAnswer);
        requestBody.append('explanation', trimmedExplanation);
        if (questionImageFile) requestBody.append('imageFile', questionImageFile);
      }

      const url = isEditingMode
        ? `/api/teacher/question-bank/questions/${questionId}`
        : `/api/teacher/question-bank/banks/${bankId}/questions`;

      const method = isEditingMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: requestBody ? undefined : { 'Content-Type': 'application/json' },
        body:
          requestBody ||
          JSON.stringify({
            topic: trimmedTopic,
            questionText: trimmedQuestionText,
            questionType,
            difficulty,
            visibility,
            options: payloadOptions,
            correctAnswer: payloadCorrectAnswer,
            explanation: trimmedExplanation,
          }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || `Failed to ${isEditingMode ? 'update' : 'create'} question`);
        return;
      }

      toast.success(isEditingMode ? 'Question updated' : 'Question added');
      router.push(`/teacher/question-bank/${bankId}`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to ${isEditingMode ? 'update' : 'create'} question`);
    } finally {
      setIsSaving(false);
    }
  }

  function handleQuestionImageChange(file: File | null) {
    if (!file) {
      setQuestionImageFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    setQuestionImageFile(file);
  }

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center space-y-4">
            <div className="mx-auto h-10 w-10 rounded-full border-2 border-gray-100 border-t-slate-700 animate-spin" />
            <p className="text-sm text-gray-500">Loading question form…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─── Bank not found state ────────────────────────────────────────────────────

  if (!bank) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <Card className="w-full max-w-sm text-center shadow-sm">
            <CardContent className="pt-10 pb-8 px-8 space-y-5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                <BookOpen className="h-6 w-6 text-gray-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-gray-900">Bank not found</h2>
                <p className="text-sm text-gray-500 leading-relaxed">
                  This bank may have been removed or you may not have access.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/teacher/question-bank')}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to overview
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const isEditable = bank.created_by_teacher_id === teacherId;
  const diffMeta = DIFFICULTY_META[difficulty];

  // ─── Main render ─────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="teacher">
      <div className="mx-auto max-w-3xl w-full space-y-8 pb-20 px-4 sm:px-6">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 pt-2">
          <button
            onClick={() => router.push('/teacher/question-bank')}
            className="hover:text-gray-900 transition-colors"
          >
            Question banks
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <button
            onClick={() => router.push(`/teacher/question-bank/${bankId}`)}
            className="hover:text-gray-900 transition-colors truncate max-w-[160px]"
          >
            {bank.title}
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-900 font-medium">
            {isEditingMode ? 'Edit question' : 'New question'}
          </span>
        </div>

        {/* ── Page header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {isEditingMode ? 'Editing' : 'Manual entry'}
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {isEditingMode ? 'Edit question' : 'Add a question'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isEditingMode
                ? 'Update the fields below — changes save immediately.'
                : `Adding to ${bank.title}.`}
            </p>
          </div>
          <Badge
            variant="outline"
            className="h-fit self-start whitespace-nowrap text-xs font-medium"
          >
            {selectedSubjectClassLabel}
          </Badge>
        </div>

        {/* ── Read-only banner ── */}
        {!isEditable && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>You can view this bank, but only the creator can edit its questions.</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            SECTION 1 — CONTEXT
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-5">
          <SectionLabel>1 — Context</SectionLabel>

          <div className="grid gap-5 sm:grid-cols-2">
            {/* Term selector + topic */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-gray-700">Term</Label>
              <div className="flex gap-2">
                {(['1', '2', '3'] as const).map((t) => (
                  <ToggleChip
                    key={t}
                    active={selectedTerm === t}
                    onClick={() => setSelectedTerm(t)}
                    disabled={!isEditable}
                  >
                    Term {t}
                  </ToggleChip>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Topic</Label>
                <select
                  value={selectedTopic}
                  disabled={!isEditable}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition disabled:opacity-50"
                >
                  <option value="">— Select a topic —</option>
                  {availableTopics.map((topic, idx) => (
                    <option key={idx} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type + Difficulty */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Question type</Label>
                <div className="flex gap-2">
                  <ToggleChip
                    active={questionType === 'objective'}
                    onClick={() => setQuestionType('objective')}
                    disabled={!isEditable}
                  >
                    Multiple choice
                  </ToggleChip>
                  <ToggleChip
                    active={questionType === 'theory'}
                    onClick={() => setQuestionType('theory')}
                    disabled={!isEditable}
                  >
                    Theory / Essay
                  </ToggleChip>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Difficulty</Label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map((d) => {
                    const meta = DIFFICULTY_META[d];
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!isEditable}
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-all ${difficulty === d
                            ? `${meta.bg} ${meta.color} border-current`
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {difficulty === d && (
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        )}
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Visibility</Label>
                <div className="flex gap-2">
                  <ToggleChip
                    active={visibility === 'private'}
                    onClick={() => setVisibility('private')}
                    disabled={!isEditable}
                  >
                    Private
                  </ToggleChip>
                  <ToggleChip
                    active={visibility === 'public_school'}
                    onClick={() => setVisibility('public_school')}
                    disabled={!isEditable}
                  >
                    School-wide
                  </ToggleChip>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 2 — QUESTION
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-5 border-t border-gray-100 pt-7">
          <SectionLabel>2 — Question</SectionLabel>

          {/* Question text */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Question prompt</Label>
            <Textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              disabled={!isEditable || isSaving}
              placeholder="Type the full question here…"
              rows={4}
              className="resize-none rounded-lg border-gray-200 focus:border-slate-400 focus:ring-slate-900/20 text-sm leading-relaxed"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Question image{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </Label>

            {questionImagePreview ? (
              <div className="relative w-fit">
                <img
                  src={questionImagePreview}
                  alt="Question preview"
                  className="max-h-40 rounded-lg border border-gray-200 object-contain"
                />
                <button
                  type="button"
                  onClick={() => handleQuestionImageChange(null)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 hover:border-gray-300 transition-colors ${!isEditable ? 'pointer-events-none opacity-50' : ''
                  }`}
              >
                <ImagePlus className="h-5 w-5 text-gray-400" />
                <span className="text-xs text-gray-500">Click to attach an image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={!isEditable}
                  onChange={(e) => handleQuestionImageChange(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 3 — ANSWERS
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-5 border-t border-gray-100 pt-7">
          <div className="flex items-center justify-between">
            <SectionLabel>3 — {questionType === 'objective' ? 'Options' : 'Model answer'}</SectionLabel>
            {questionType === 'objective' && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">Number of options</span>
                <select
                  value={optionCount}
                  disabled={!isEditable}
                  onChange={(e) => setOptionCount(Number(e.target.value))}
                  className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
                >
                  {[2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {questionType === 'objective' ? (
            <div className="space-y-3">
              {Array.from({ length: optionCount }).map((_, idx) => {
                const isCorrect = correctOptionIdx === idx;
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${isCorrect
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    {/* Option label badge */}
                    <div
                      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors ${isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                      {OPTION_LABELS[idx]}
                    </div>

                    {/* Input */}
                    <Input
                      value={options[idx] || ''}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                      disabled={!isEditable || isSaving}
                      placeholder={`Enter option ${OPTION_LABELS[idx]}…`}
                      className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-gray-400"
                    />

                    {/* Mark correct button */}
                    <button
                      type="button"
                      disabled={!isEditable}
                      onClick={() => setCorrectOptionIdx(idx)}
                      className={`flex-shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {isCorrect ? 'Correct' : 'Mark correct'}
                    </button>
                  </div>
                );
              })}

              {correctOptionIdx === null && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5 pt-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Select the correct answer above before saving.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Sample answer / rubric guidelines
              </Label>
              <Textarea
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                disabled={!isEditable || isSaving}
                placeholder="Provide a model solution or marking criteria…"
                rows={4}
                className="resize-none rounded-lg border-gray-200 text-sm leading-relaxed"
              />
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 4 — EXPLANATION
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-3 border-t border-gray-100 pt-7">
          <SectionLabel>4 — Explanation</SectionLabel>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              Rationale or marking notes{' '}
              <span className="font-normal text-gray-400">(optional)</span>
            </Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              disabled={!isEditable || isSaving}
              placeholder="Explain why the answer is correct, or add notes for graders…"
              rows={3}
              className="resize-none rounded-lg border-gray-200 text-sm leading-relaxed"
            />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            FOOTER — ACTIONS
        ════════════════════════════════════════════════════════════════ */}
        <div className="border-t border-gray-100 pt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              onClick={handleSubmit}
              disabled={!isEditable || isSaving || !selectedTopic}
              className="flex-1 bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 h-11 text-sm font-semibold rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditingMode ? 'Updating…' : 'Saving…'}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditingMode ? 'Update question' : 'Save question'}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/teacher/question-bank/${bankId}`)}
              className="flex-1 h-11 rounded-xl text-sm"
            >
              Cancel
            </Button>
          </div>

          {/* Confirmation note */}
          {isEditable && (
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                {isEditingMode
                  ? 'Updates will overwrite the existing question record immediately.'
                  : `This question will appear in ${bank.title} right after saving.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}