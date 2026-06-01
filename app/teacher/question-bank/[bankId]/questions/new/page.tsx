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

function splitOptions(value: string) {
  return value
    .split('\n')
    .flatMap((line) => line.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

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

  const [topic, setTopic] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'1' | '2' | '3' | ''>('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'objective' | 'theory'>('objective');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [visibility, setVisibility] = useState<'private' | 'public_school'>('private');
  const [optionsInput, setOptionsInput] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');

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

    if (!selectedTerm) {
      toast.error('Select a term before saving');
      return;
    }

    const trimmedTopic = topic.trim();
    const trimmedQuestionText = questionText.trim();
    const trimmedCorrectAnswer = correctAnswer.trim();
    const trimmedExplanation = explanation.trim();
    const options = splitOptions(optionsInput);

    if (!trimmedTopic || !trimmedQuestionText) {
      toast.error('Add a topic and question text');
      return;
    }

    if (questionType === 'objective') {
      if (options.length < 2) {
        toast.error('Objective questions need at least two options');
        return;
      }

      if (!trimmedCorrectAnswer) {
        toast.error('Objective questions need a correct answer');
        return;
      }

      const hasMatchingAnswer = options.some((option) => option.toLowerCase() === trimmedCorrectAnswer.toLowerCase());
      if (!hasMatchingAnswer) {
        toast.error('Correct answer must match one of the options');
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: selectedTerm,
          topic: trimmedTopic,
          questionText: trimmedQuestionText,
          questionType,
          difficulty,
          visibility,
          options,
          correctAnswer: trimmedCorrectAnswer,
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
                  <Label className="text-sm font-medium text-gray-700">Term</Label>
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value as any)}
                    disabled={!isEditable || isSaving}
                    className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
                  >
                    <option value="">Select term</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>

                  <div className="mt-3">
                    <Label className="text-sm font-medium text-gray-700">Topic</Label>
                    <div className="flex gap-2">
                      <Input
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={!isEditable || isSaving || !selectedTerm}
                        placeholder="e.g. Fractions"
                      />
                      <Button
                        type="button"
                        onClick={() => {
                          if (!selectedTerm) return toast.error('Select a term first');
                          setTopic(`${bank?.title || 'Topic'} — Term ${selectedTerm}`);
                        }}
                        disabled={!isEditable || isSaving || !selectedTerm}
                      >
                        Init topic
                      </Button>
                    </div>
                    {!selectedTerm && <p className="mt-1 text-xs text-gray-500">Please select a term before adding a topic.</p>}
                  </div>
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Options</Label>
                  <Textarea
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    disabled={!isEditable || isSaving}
                    placeholder="Enter each option on a new line, or separate with commas"
                    rows={5}
                  />
                  <p className="text-xs text-gray-500">The first two options are enough to save, but four are recommended.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Correct answer</Label>
                  <Input
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    disabled={!isEditable || isSaving}
                    placeholder="Enter the exact correct option"
                  />
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    <Sparkles className="mb-2 h-4 w-4" />
                    The answer must match one of the options exactly.
                  </div>
                </div>
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
                disabled={!isEditable || isSaving || !selectedTerm || !topic.trim()}
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
