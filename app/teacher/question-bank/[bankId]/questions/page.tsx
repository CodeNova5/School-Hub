"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
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

// Added structure matching page.tsx for editing initialization
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

export default function TeacherQuestionManualCreatePage() {
  const params = useParams<{ bankId: string }>();
  const searchParams = useSearchParams(); // Hook to fetch ?questionId=
  const router = useRouter();

  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';
  const questionId = searchParams?.get('questionId') || ''; // Identify if we are editing
  const isEditingMode = !!questionId;

  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
  const [questionImageFile, setQuestionImageFile] = useState<File | null>(null);
  const [questionImagePreview, setQuestionImagePreview] = useState('');

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
  }, [schoolId, bankId, questionId]); // Reload page if questionId changes

  useEffect(() => {
    const topics = topicGroups.filter((g) => String(g.term ?? 1) === selectedTerm).flatMap((g) => g.topics || []);
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
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  }

  async function loadPage() {
    setIsLoading(true);
    try {
      // Build baseline promises
      const promises: [Promise<Response>, Promise<Response>, Promise<Response>, Promise<Response>?] = [
        fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
      ];

      // If we are in editing mode, fetch the complete question records to prefill the state
      if (questionId) {
        promises.push(fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, { cache: 'no-store' }));
      }

      const [contextResponse, bankResponse, groupsResponse, questionsResponse] = await Promise.all(promises);

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

      const groups = (!groupsResponse.ok || 'error' in groupsPayload) ? [] : (groupsPayload.groups || []);
      setTopicGroups(groups);

      // Setup default visibility values
      setVisibility(bankPayload.bank?.visibility || 'private');

      // Edit Mode Setup logic:
      if (questionId && questionsResponse && questionsResponse.ok) {
        const questionsPayload = await questionsResponse.json();
        const existingQuestion = (questionsPayload.questions || []).find((q: QuestionRecord) => q.id === questionId) as QuestionRecord;

        if (existingQuestion) {
          setQuestionText(existingQuestion.question_text);
          setQuestionType(existingQuestion.question_type);
          setDifficulty(existingQuestion.difficulty);
          setVisibility(existingQuestion.visibility);
          setExplanation(existingQuestion.explanation || '');

          // Infer active term based on where this topic belongs
          const matchingGroup = groups.find(g => g.topics?.includes(existingQuestion.topic));
          if (matchingGroup && matchingGroup.term) {
            setSelectedTerm(String(matchingGroup.term) as '1' | '2' | '3');
          }

          setSelectedTopic(existingQuestion.topic);

          // Find where you handle objective options inside: if (existingQuestion.question_type === 'objective' && existingQuestion.options)
          if (existingQuestion.question_type === 'objective' && existingQuestion.options) {
            const fetchedOpts = existingQuestion.options;
            setOptionCount(fetchedOpts.length);
            const extendedOpts = ['', '', '', '', '', ''];
            fetchedOpts.forEach((val, idx) => { extendedOpts[idx] = val; });
            setOptions(extendedOpts);

            // FIX: Read the single-letter choice from the DB, convert it to an index, and set it
            const savedAnswer = existingQuestion.correct_answer; // e.g., "C"
            if (savedAnswer && /^[A-H]$/i.test(savedAnswer)) {
              const correctIdx = savedAnswer.toUpperCase().charCodeAt(0) - 65; // 'C' becomes 2
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
        if (questionImageFile) {
          requestBody.append('imageFile', questionImageFile);
        }
      }

      // Dynamically alternate endpoint method URL structure
      const url = isEditingMode
        ? `/api/teacher/question-bank/questions/${questionId}` // Edit route
        : `/api/teacher/question-bank/banks/${bankId}/questions`;             // Create route

      const method = isEditingMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: requestBody ? undefined : { 'Content-Type': 'application/json' },
        body: requestBody || JSON.stringify({
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
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to overview
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
            <Button variant="ghost" size="sm" className="h-auto p-0 text-gray-500 hover:text-gray-900" onClick={() => router.push(`/teacher/question-bank/${bankId}`)} >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to bank
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {isEditingMode ? 'Question Editor' : 'Manual question entry'}
                </p>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                  {isEditingMode ? 'Edit question' : 'Add a new question'}
                </h1>
                <p className="max-w-2xl text-lg text-gray-600">
                  {isEditingMode ? 'Modify your question parameters and save updates live.' : `Create a question for ${bank.title} manually, without using AI generation.`}
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
              <div>You can view this bank, but only the creator can alter questions in it.</div>
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
                      disabled={!isEditable}
                      onClick={() => setSelectedTerm(t)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${selectedTerm === t
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      Term {t}
                    </button>
                  ))}
                </div>

                <select
                  value={selectedTopic}
                  disabled={!isEditable}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 dynamic-select"
                >
                  <option value="">-- Select Topic --</option>
                  {availableTopics.map((topic, idx) => (
                    <option key={idx} value={topic}>{topic}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Type</Label>
                  <select
                    value={questionType}
                    disabled={!isEditable}
                    onChange={(e) => setQuestionType(e.target.value as any)}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none"
                  >
                    <option value="objective">Multiple Choice</option>
                    <option value="theory">Theory / Essay</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Difficulty</Label>
                  <select
                    value={difficulty}
                    disabled={!isEditable}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Question Text</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                disabled={!isEditable || isSaving}
                placeholder="Type the question prompt here..."
                rows={4}
              />
            </div>

            {/* Objective Options Structure renders dynamically */}
            {questionType === 'objective' && (
              <div className="space-y-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-900">Options Configuration</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Count:</span>
                    <select
                      value={optionCount}
                      disabled={!isEditable}
                      onChange={(e) => setOptionCount(Number(e.target.value))}
                      className="h-8 rounded border border-gray-300 px-2 text-xs focus:outline-none"
                    >
                      {[2, 3, 4, 5, 6].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: optionCount }).map((_, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400">Option {String.fromCharCode(65 + idx)}</span>
                        <button
                          type="button"
                          disabled={!isEditable}
                          onClick={() => setCorrectOptionIdx(idx)}
                          className={`text-xs px-2 py-0.5 rounded transition-colors ${correctOptionIdx === idx
                            ? 'bg-emerald-600 text-white font-medium'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                          {correctOptionIdx === idx ? '✓ Correct Answer' : 'Mark Correct'}
                        </button>
                      </div>
                      <Input
                        value={options[idx] || ''}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        disabled={!isEditable || isSaving}
                        placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Theory Correct Answer Setup */}
            {questionType === 'theory' && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <Label className="text-sm font-medium text-gray-700">Sample Correct Answer / Rubric Guidelines</Label>
                <Textarea
                  value={correctAnswer}
                  onChange={(e) => setCorrectAnswer(e.target.value)}
                  disabled={!isEditable || isSaving}
                  placeholder="Provide sample model solution text or evaluation guide..."
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2 border-t border-gray-100 pt-4">
              <Label className="text-sm font-medium text-gray-700">Explanation & Rationale</Label>
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
                {isSaving ? 'Saving...' : isEditingMode ? 'Update Question' : 'Save Question'}
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
              <p>
                {isEditingMode
                  ? "Changes made to the current question structure will overwrite the specific records in this bank instantly."
                  : `The question will be added directly to ${bank.title} and appear in the bank list immediately after save.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}