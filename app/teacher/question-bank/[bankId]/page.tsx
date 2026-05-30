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
import { ArrowLeft, BookOpen, Globe2, Layers, Lock, Save, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
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
  created_by_teacher_id: string;
  source_question_id?: string | null;
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

type QuestionsPayload = {
  bank: BankRecord;
  questions: QuestionRecord[];
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
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsError, setQuestionsError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectClassId, setSubjectClassId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public_school'>('private');
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'objective' | 'theory'>('all');
  const [generateCount, setGenerateCount] = useState('5');
  const [generateDifficulty, setGenerateDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [generateQuestionType, setGenerateQuestionType] = useState<'objective' | 'theory'>('objective');
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

  const selectedSubjectClassLabel = subjectClassLabelMap.get(subjectClassId) || bank?.title || 'General topic';

  const generatedTopicHints = useMemo(() => {
    const topics = new Map<string, string>();

    questions.forEach((question) => {
      const topic = question.topic.trim();
      if (topic && !topics.has(topic.toLowerCase())) {
        topics.set(topic.toLowerCase(), topic);
      }
    });

    const topicValues = Array.from(topics.values()).filter(Boolean);

    if (topicValues.length > 0) {
      return topicValues.slice(0, 8);
    }

    return [selectedSubjectClassLabel];
  }, [questions, selectedSubjectClassLabel]);

  const filteredQuestions = useMemo(() => {
    const query = questionSearch.trim().toLowerCase();

    return questions.filter((question) => {
      const matchesSearch =
        !query ||
        question.topic.toLowerCase().includes(query) ||
        question.question_text.toLowerCase().includes(query) ||
        (question.correct_answer || '').toLowerCase().includes(query);

      const matchesDifficulty =
        questionDifficultyFilter === 'all' || question.difficulty === questionDifficultyFilter;

      const matchesType = questionTypeFilter === 'all' || question.question_type === questionTypeFilter;

      return matchesSearch && matchesDifficulty && matchesType;
    });
  }, [questionDifficultyFilter, questionSearch, questionTypeFilter, questions]);

  const isEditable = bank ? bank.created_by_teacher_id === teacherId : false;

  async function loadPage() {
    setIsLoading(true);
    setQuestionsError('');
    try {
      const [contextResponse, bankResponse, questionsResponse] = await Promise.all([
        fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, { cache: 'no-store' }),
      ]);

      const contextPayload = (await contextResponse.json()) as ContextPayload | { error: string };
      const bankPayload = (await bankResponse.json()) as BankPayload | { error: string };
      const questionsPayload = (await questionsResponse.json()) as QuestionsPayload | { error: string };

      if (!contextResponse.ok || 'error' in contextPayload) {
        toast.error('Failed to load question bank data');
        return;
      }

      if (!bankResponse.ok || 'error' in bankPayload) {
        toast.error((bankPayload as { error?: string })?.error || 'Question bank not found');
        router.push('/teacher/question-bank');
        return;
      }

      if (!questionsResponse.ok || 'error' in questionsPayload) {
        const questionsErrorMessage = 'error' in questionsPayload
          ? (questionsPayload as { error: string }).error
          : 'Failed to load questions';
        setQuestionsError(questionsErrorMessage);
      } else {
        setQuestions(questionsPayload.questions || []);
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

  async function handleGenerateQuestions() {
    if (!isEditable) {
      toast.error('You can only generate questions for banks you created');
      return;
    }

    const count = Math.min(Math.max(Number(generateCount) || 5, 1), 30);
    const topics = generatedTopicHints.length > 0 ? generatedTopicHints : [selectedSubjectClassLabel];

    setIsGenerating(true);
    try {
      const response = await fetch('/api/teacher/question-bank/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          subjectClassId,
          difficulty: generateDifficulty,
          questionType: generateQuestionType,
          count,
          topics,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to generate questions');
        return;
      }

      const generatedQuestions = (payload.questions || []) as QuestionRecord[];
      if (generatedQuestions.length === 0) {
        toast.error('AI returned no valid questions');
        return;
      }

      setQuestions((prev) => [...generatedQuestions, ...prev]);
      setQuestionCount((prev) => prev + generatedQuestions.length);
      toast.success(`Generated ${generatedQuestions.length} question${generatedQuestions.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  }

  function getDifficultyStyles(difficulty: QuestionRecord['difficulty']) {
    switch (difficulty) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'hard':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  }

  function getQuestionTypeLabel(questionType: QuestionRecord['question_type']) {
    return questionType === 'objective' ? 'Objective' : 'Theory';
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

  const canGenerateQuestions = isEditable && !!bank && !!subjectClassId;

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

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Questions in this bank</CardTitle>
                  <CardDescription>
                    View every question already stored in this bank.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="w-fit">
                  {filteredQuestions.length} shown / {questions.length} total
                </Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="pl-10"
                    placeholder="Search topic, question, or answer..."
                  />
                </div>
                <div className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <select
                    value={questionDifficultyFilter}
                    onChange={(e) => setQuestionDifficultyFilter(e.target.value as 'all' | 'easy' | 'medium' | 'hard')}
                    className="h-10 w-full rounded-md border border-input bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="relative">
                  <select
                    value={questionTypeFilter}
                    onChange={(e) => setQuestionTypeFilter(e.target.value as 'all' | 'objective' | 'theory')}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All types</option>
                    <option value="objective">Objective</option>
                    <option value="theory">Theory</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              {questionsError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {questionsError}
                </div>
              ) : null}

              {filteredQuestions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                  <BookOpen className="mx-auto h-10 w-10 text-slate-300" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-900">
                    {questions.length === 0 ? 'No questions in this bank yet' : 'No questions match your filters'}
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                    Use the AI generator on the right to add questions based on the topics already in this bank.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredQuestions.map((question) => (
                    <Card key={question.id} className="border-slate-200">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                {question.topic}
                              </Badge>
                              <Badge variant="outline" className={getDifficultyStyles(question.difficulty)}>
                                {question.difficulty}
                              </Badge>
                              <Badge variant="outline" className="bg-white text-slate-700 border-slate-200">
                                {getQuestionTypeLabel(question.question_type)}
                              </Badge>
                              <Badge variant="outline" className="bg-white text-slate-700 border-slate-200">
                                {question.visibility === 'public_school' ? 'School shared' : 'Private'}
                              </Badge>
                            </div>
                            <p className="text-base font-medium leading-7 text-slate-900">{question.question_text}</p>
                          </div>
                        </div>

                        {question.question_type === 'objective' && question.options.length > 0 && (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {question.options.map((option, index) => (
                              <div key={`${question.id}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                {String.fromCharCode(65 + index)}. {option}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
                          <div>
                            <p className="text-slate-500">Answer</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {question.correct_answer || 'No answer stored'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Explanation</p>
                            <p className="mt-1 font-medium text-slate-900">
                              {question.explanation || 'No explanation added'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Created</p>
                            <p className="mt-1 font-medium text-slate-900">{formatDate(question.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Question ID</p>
                            <p className="mt-1 truncate font-mono text-xs text-slate-900">{question.id}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="space-y-2 border-b border-slate-100 bg-slate-50/60">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Generate with AI
              </CardTitle>
              <CardDescription>
                Add more questions using the topics already present in this bank, or fall back to the subject/class label.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {!isEditable && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  AI generation is available only for banks you created.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <div className="space-y-1.5">
                  <Label>Amount</Label>
                  <select
                    value={generateCount}
                    onChange={(e) => setGenerateCount(e.target.value)}
                    disabled={!canGenerateQuestions}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="1">1</option>
                    <option value="3">3</option>
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <select
                    value={generateDifficulty}
                    onChange={(e) => setGenerateDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                    disabled={!canGenerateQuestions}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={generateQuestionType}
                    onChange={(e) => setGenerateQuestionType(e.target.value as 'objective' | 'theory')}
                    disabled={!canGenerateQuestions}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="objective">Objective</option>
                    <option value="theory">Theory</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Topic hints used by AI</p>
                <div className="flex flex-wrap gap-2">
                  {generatedTopicHints.map((topic) => (
                    <Badge key={topic} variant="outline" className="bg-white text-slate-700 border-slate-200">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerateQuestions} disabled={!canGenerateQuestions || isGenerating} className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                {isGenerating ? 'Generating...' : 'Generate questions'}
              </Button>
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