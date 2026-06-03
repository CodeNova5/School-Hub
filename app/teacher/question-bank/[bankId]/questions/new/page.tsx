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
import { AlertCircle, ArrowLeft, BookOpen, CheckCircle, Save, Sparkles } from 'lucide-react';
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

export default function TeacherQuestionManualCreatePage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Topic selection now requires choosing a term and then a topic from the bank's topic groups
  const [selectedTerm, setSelectedTerm] = useState<'1' | '2' | '3'>('1');
  const [topicGroups, setTopicGroups] = useState<{ id: string; title: string; topics: string[]; term?: number }[]>([]);
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

  const activeOptions = useMemo(() => {
    return options.slice(0, optionCount);
  }, [options, optionCount]);

  const subjectClassLabelMap = useMemo(() => {
    return new Map(
      subjectClasses.map((item) => [
        item.id,
        `${item.subjects?.name || 'Subject'} — ${item.classes?.name || 'Class'}`,
      ])
    );
  }, [subjectClasses]);

  const selectedSubjectClassLabel = bank ? subjectClassLabelMap.get(bank.subject_class_id) || 'Selected class' : 'Selected class';

  useEffect(() => {
    if (schoolId && bankId) {
      void loadPage();
    }
  }, [schoolId, bankId]);

  useEffect(() => {
    // update available topics when groups or term selection changes
    const topics = topicGroups.filter((g) => String(g.term ?? 1) === selectedTerm).flatMap((g) => g.topics || []);
    setAvailableTopics(topics);
    // clear selected topic if it is not in the new list
    if (selectedTopic && !topics.some((t) => t === selectedTopic)) {
      setSelectedTopic('');
    }
  }, [topicGroups, selectedTerm]);

  useEffect(() => {
    if (correctOptionIdx !== null && correctOptionIdx >= optionCount) {
      setCorrectOptionIdx(null);
    }
  }, [optionCount, correctOptionIdx]);

  function handleOptionChange(index: number, value: string) {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  }

  async function loadPage() {
    setIsLoading(true);
    try {
      const [contextResponse, bankResponse, groupsResponse] = await Promise.all([
        fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
      ]);

      const contextPayload = (await contextResponse.json()) as ContextPayload | { error: string };
      const bankPayload = (await bankResponse.json()) as BankPayload | { error: string };
      const groupsPayload = (await groupsResponse.json()) as { groups?: { id: string; title: string; topics: string[]; term?: number }[] } | { error: string };

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

      // groupsResponse may return an error shape; narrow before accessing `groups`
      if (!groupsResponse.ok || 'error' in groupsPayload) {
        setTopicGroups([]);
        setAvailableTopics([]);
      } else {
        const groups = groupsPayload.groups || [];
        setTopicGroups(groups);
        // initialize available topics for default term
        const initial = groups
          .filter((g) => String(g.term ?? 1) === selectedTerm)
          .flatMap((g) => g.topics || []);
        setAvailableTopics(initial);
      }

      setSelectedTopic('');
      setVisibility(bankPayload.bank?.visibility || 'private');
    } catch (error) {
      console.error(error);
      toast.error('Failed to load question bank data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    if (!bank || bank.created_by_teacher_id !== teacherId) {
      toast.error('You can only add questions to banks you created');
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

      if (!payloadOptions[correctOptionIdx]) {
        toast.error('Selected option is invalid');
        return;
      }

      payloadCorrectAnswer = payloadOptions[correctOptionIdx];
    } else {
      payloadOptions = [];
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        toast.error(payload?.error || 'Failed to create question');
        return;
      }

      toast.success('Question added');
      router.push(`/teacher/question-bank/${bankId}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to create question');
    } finally {
      setIsSaving(false);
    }
  }

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-medium text-gray-500">Loading question form...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!bank) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <Card className="w-full max-w-md border-gray-200 p-8 text-center shadow-sm space-y-4">
            <div className="flex justify-center">
              <BookOpen className="h-12 w-12 text-gray-300" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-gray-900">Question bank not found</h1>
              <p className="text-sm text-gray-500">This bank may have been removed or you may lack access permissions.</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/teacher/question-bank')} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to overview
            </Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const isEditable = bank.created_by_teacher_id === teacherId;

  return (
    <DashboardLayout role="teacher">
      <div className="w-full space-y-8 pb-16">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-gray-500 hover:text-gray-900"
              onClick={() => router.push(`/teacher/question-bank/${bankId}`)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to bank
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Manual question entry</p>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">Add a new question</h1>
                <p className="max-w-2xl text-lg text-gray-600">
                  Create a question for {bank.title} manually, without using AI generation.
                </p>
              </div>
              <Badge variant="outline" className="h-fit self-start sm:self-auto">
                {selectedSubjectClassLabel}
              </Badge>
            </div>
          </div>

          {!isEditable && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>You can view this bank, but only the creator can add questions to it.</div>
            </div>
          )}
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
            <CardTitle>Question details</CardTitle>
            <CardDescription>Fill in the question prompt, answer, and supporting details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Term & Topic</Label>
                <div className="flex gap-2 mb-2">
                  {(['1', '2', '3'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTerm(t)}
                      disabled={!isEditable || isSaving}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedTerm === t
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      Term {t}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 items-center">
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    disabled={!isEditable || isSaving || availableTopics.length === 0}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
                  >
                    <option value="">Select a topic for Term {selectedTerm}</option>
                    {availableTopics.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/teacher/question-bank/${bankId}/groups`)}
                    className="flex-shrink-0"
                  >
                    Manage topics
                  </Button>
                </div>

                {availableTopics.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    No topics available for Term {selectedTerm}. Create a topic group in the bank's groups page.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Question type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['objective', 'theory'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setQuestionType(type)}
                      disabled={!isEditable || isSaving}
                      className={`rounded-lg border px-3 py-3 text-sm font-medium transition-colors ${
                        questionType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {type === 'objective' ? 'Multiple Choice' : 'Theory'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Question text</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                disabled={!isEditable || isSaving}
                placeholder="Enter the full question text..."
                rows={5}
              />
            </div>

            {questionType === 'objective' && (
              <div className="space-y-6 border-t border-gray-100 pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-semibold text-gray-900">Configure options</Label>
                    <p className="text-xs text-gray-500">Choose how many choices to render, then fill and select the correct answer.</p>
                  </div>

                  <div className="w-fit rounded-lg bg-gray-100 p-1">
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setOptionCount(count)}
                          disabled={!isEditable || isSaving}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                            optionCount === count
                              ? 'border border-gray-200/50 bg-white text-blue-600 shadow-sm'
                              : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                          }`}
                        >
                          {count} Choices
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {Array.from({ length: optionCount }).map((_, idx) => {
                    const currentLetter = String.fromCharCode(65 + idx);
                    const isCorrect = correctOptionIdx === idx;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${
                          isCorrect
                            ? 'border-emerald-300 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-400/20'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                            isCorrect
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                              : 'border-gray-200 bg-gray-50 text-gray-700'
                          }`}
                        >
                          {currentLetter}
                        </div>

                        <div className="flex-1">
                          <Input
                            value={options[idx] || ''}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            disabled={!isEditable || isSaving}
                            placeholder={`Enter option ${currentLetter}...`}
                            className="h-11 border-gray-200 bg-transparent shadow-none focus-visible:ring-blue-500"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={!isEditable || isSaving}
                          onClick={() => setCorrectOptionIdx(idx)}
                          className={`flex h-11 items-center gap-1.5 rounded-lg border px-4 text-xs font-medium transition-all ${
                            isCorrect
                              ? 'border-emerald-600 bg-emerald-600 font-semibold text-white'
                              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }`}
                        >
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                              isCorrect ? 'border-white bg-white' : 'border-gray-300'
                            }`}
                          >
                            {isCorrect && <div className="h-2 w-2 rounded-full bg-emerald-600" />}
                          </div>
                          <span className="hidden sm:inline">{isCorrect ? 'Correct Answer' : 'Mark Correct'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {correctOptionIdx !== null && (
                  <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-sm text-blue-700">
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />
                    <span>
                      Option <strong>{String.fromCharCode(65 + correctOptionIdx)}</strong> is marked as the correct resolution for this question.
                    </span>
                  </div>
                )}
              </div>
            )}

            {questionType === 'theory' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Theory questions do not require options. You can still include a model answer below.
              </div>
            )}

            {questionType === 'theory' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Model answer / explanation</Label>
                <Textarea
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  disabled={!isEditable || isSaving}
                  placeholder="Enter the suggested answer or marking guide..."
                  rows={4}
                />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Difficulty</Label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                  disabled={!isEditable || isSaving}
                  className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Visibility</Label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'private' | 'public_school')}
                  disabled={!isEditable || isSaving}
                  className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="public_school">Shared with School</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Explanation / notes</Label>
              <Textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                disabled={!isEditable || isSaving}
                placeholder="Optional explanation, rationale, or marking notes..."
                rows={4}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row">
              <Button
                onClick={handleSubmit}
                disabled={!isEditable || isSaving || !selectedTopic}
                className="flex-1 bg-slate-950 text-white hover:bg-slate-800"
              >
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Question'}
              </Button>
              <Button variant="outline" onClick={() => router.push(`/teacher/question-bank/${bankId}`)} className="flex-1">
                Cancel
              </Button>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <CheckCircle className="h-4 w-4" />
                Ready to save
              </div>
              <p>The question will be added directly to {bank.title} and appear in the bank list immediately after save.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
