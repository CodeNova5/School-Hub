"use client";

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Sparkles,
  Plus,
  Copy,
  Pencil,
  Trash2,
  Save,
  X,
  FolderOpen,
  BookOpen,
  Layers,
  Eye,
  EyeOff,
  HelpCircle,
  CheckCircle2,
  Lock,
  Globe2,
  Search,
} from 'lucide-react';

type SubjectClassItem = {
  id: string;
  subjects?: { id: string; name: string } | null;
  classes?: { id: string; name: string } | null;
};

type Visibility = 'private' | 'public_school';
type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionType = 'objective' | 'theory';

type TopicSet = {
  id: string;
  name: string;
  topics: string[];
  subject_class_id: string;
};

type QuestionBank = {
  id: string;
  title: string;
  description?: string | null;
  subject_class_id: string;
  visibility: Visibility;
  created_by_teacher_id: string;
};

type QuestionItem = {
  id: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_answer?: string | null;
  explanation?: string | null;
  question_type: QuestionType;
  difficulty: Difficulty;
  visibility: Visibility;
  created_by_teacher_id: string;
};

type ContextPayload = {
  teacherId: string;
  subjectClasses: SubjectClassItem[];
  topicSets: TopicSet[];
  banks: QuestionBank[];
};

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const QUESTION_TYPES = ['objective', 'theory'] as const;

const difficultyStyles: Record<Difficulty, string> = {
  hard: 'border-red-200 text-red-700 bg-red-50',
  medium: 'border-amber-200 text-amber-700 bg-amber-50',
  easy: 'border-emerald-200 text-emerald-700 bg-emerald-50',
};

export default function TeacherQuestionBankPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingTopicSet, setIsSavingTopicSet] = useState(false);
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [isCreatingQuestion, setIsCreatingQuestion] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGenPanelOpen, setIsGenPanelOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [topicSets, setTopicSets] = useState<TopicSet[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [bankSearch, setBankSearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | QuestionType>('all');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState<'all' | Difficulty>('all');
  const [questionVisibilityFilter, setQuestionVisibilityFilter] = useState<'all' | Visibility>('all');

  const [bankTitle, setBankTitle] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [bankSubjectClassId, setBankSubjectClassId] = useState('');
  const [bankVisibility, setBankVisibility] = useState<Visibility>('private');

  const [topicSetName, setTopicSetName] = useState('');
  const [topicSetSubjectClassId, setTopicSetSubjectClassId] = useState('');
  const [manualTopicsText, setManualTopicsText] = useState('');

  const [generateSubjectClassId, setGenerateSubjectClassId] = useState('');
  const [generateTopicSetId, setGenerateTopicSetId] = useState('');
  const [generateTopicsText, setGenerateTopicsText] = useState('');
  const [generateDifficulty, setGenerateDifficulty] = useState<Difficulty>('medium');
  const [generateQuestionType, setGenerateQuestionType] = useState<QuestionType>('objective');
  const [generateCount, setGenerateCount] = useState(5);
  const [generateVisibility, setGenerateVisibility] = useState<Visibility>('private');

  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [editingDraft, setEditingDraft] = useState<Partial<QuestionItem>>({});

  const [manualQuestionTopic, setManualQuestionTopic] = useState('');
  const [manualQuestionText, setManualQuestionText] = useState('');
  const [manualQuestionOptionsText, setManualQuestionOptionsText] = useState('');
  const [manualQuestionCorrectAnswer, setManualQuestionCorrectAnswer] = useState('');
  const [manualQuestionExplanation, setManualQuestionExplanation] = useState('');
  const [manualQuestionDifficulty, setManualQuestionDifficulty] = useState<Difficulty>('medium');
  const [manualQuestionType, setManualQuestionType] = useState<QuestionType>('objective');
  const [manualQuestionVisibility, setManualQuestionVisibility] = useState<Visibility>('private');

  const myBanks = useMemo(
    () => banks.filter((bank) => bank.created_by_teacher_id === teacherId),
    [banks, teacherId]
  );

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === selectedBankId) || null,
    [banks, selectedBankId]
  );

  const selectedSubjectClassTopics = useMemo(
    () => topicSets.filter((set) => set.subject_class_id === generateSubjectClassId),
    [topicSets, generateSubjectClassId]
  );

  const visibleBanks = useMemo(() => {
    const search = bankSearch.trim().toLowerCase();
    if (!search) return banks;

    return banks.filter((bank) => {
      const label = getSubjectClassLabel(bank.subject_class_id).toLowerCase();
      return (
        bank.title.toLowerCase().includes(search) ||
        (bank.description || '').toLowerCase().includes(search) ||
        label.includes(search)
      );
    });
  }, [banks, bankSearch, subjectClasses]);

  const filteredQuestions = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();

    return questions.filter((question) => {
      const matchesSearch = !search
        || question.topic.toLowerCase().includes(search)
        || question.question_text.toLowerCase().includes(search)
        || (question.explanation || '').toLowerCase().includes(search)
        || (question.correct_answer || '').toLowerCase().includes(search);

      const matchesType = questionTypeFilter === 'all' || question.question_type === questionTypeFilter;
      const matchesDifficulty = questionDifficultyFilter === 'all' || question.difficulty === questionDifficultyFilter;
      const matchesVisibility = questionVisibilityFilter === 'all' || question.visibility === questionVisibilityFilter;

      return matchesSearch && matchesType && matchesDifficulty && matchesVisibility;
    });
  }, [questions, questionSearch, questionTypeFilter, questionDifficultyFilter, questionVisibilityFilter]);

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    if (selectedBankId) {
      void loadBankQuestions(selectedBankId);
    }
  }, [selectedBankId]);

  useEffect(() => {
    if (selectedBank) {
      setGenerateSubjectClassId(selectedBank.subject_class_id);
      setGenerateVisibility(selectedBank.visibility);
    }
  }, [selectedBank]);

  useEffect(() => {
    if (!generateTopicSetId) return;
    const topicSetStillValid = selectedSubjectClassTopics.some((set) => set.id === generateTopicSetId);
    if (!topicSetStillValid) {
      setGenerateTopicSetId('');
    }
  }, [generateSubjectClassId, generateTopicSetId, selectedSubjectClassTopics]);

  async function loadContext() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/teacher/question-bank/context', { cache: 'no-store' });
      const payload = (await response.json()) as ContextPayload | { error: string };

      if (!response.ok || 'error' in payload) {
        toast.error('Failed to load question bank context');
        return;
      }

      setTeacherId(payload.teacherId);
      setSubjectClasses(payload.subjectClasses || []);
      setTopicSets(payload.topicSets || []);
      setBanks(payload.banks || []);

      if (payload.subjectClasses?.length > 0) {
        const fallbackSubjectClass = payload.subjectClasses[0].id;
        setBankSubjectClassId(fallbackSubjectClass);
        setTopicSetSubjectClassId(fallbackSubjectClass);
        setGenerateSubjectClassId(fallbackSubjectClass);
      }

      if (payload.banks?.length > 0) {
        setSelectedBankId(payload.banks[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load question bank context');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadBankQuestions(bankId: string) {
    setIsLoadingQuestions(true);
    try {
      const response = await fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to load questions');
        return;
      }
      setQuestions(payload.questions || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  }

  function parseTopicsFromText(input: string): string[] {
    return input
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function getSubjectClassLabel(subjectClassId: string): string {
    const item = subjectClasses.find((entry) => entry.id === subjectClassId);
    if (!item) return 'Unknown subject/class';
    return `${item.subjects?.name || 'Subject'} — ${item.classes?.name || 'Class'}`;
  }

  function openManualQuestionComposer() {
    if (!selectedBank) {
      toast.error('Select a bank first');
      return;
    }

    setManualQuestionTopic('');
    setManualQuestionText('');
    setManualQuestionOptionsText('');
    setManualQuestionCorrectAnswer('');
    setManualQuestionExplanation('');
    setManualQuestionDifficulty('medium');
    setManualQuestionType('objective');
    setManualQuestionVisibility(selectedBank.visibility);
    setIsQuestionModalOpen(true);
  }

  async function handleCreateBank() {
    if (!bankTitle.trim() || !bankSubjectClassId) {
      toast.error('Enter a title and select subject/class');
      return;
    }

    setIsCreatingBank(true);
    try {
      const response = await fetch('/api/teacher/question-bank/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bankTitle,
          description: bankDescription,
          subjectClassId: bankSubjectClassId,
          visibility: bankVisibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to create bank');
        return;
      }

      const createdBank = payload.bank as QuestionBank;
      setBanks((prev) => [createdBank, ...prev]);
      setSelectedBankId(createdBank.id);
      setBankTitle('');
      setBankDescription('');
      setIsBankModalOpen(false);
      toast.success('Question bank created');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create bank');
    } finally {
      setIsCreatingBank(false);
    }
  }

  async function handleGenerateTopics() {
    if (!topicSetSubjectClassId) {
      toast.error('Select a subject/class first');
      return;
    }

    try {
      const response = await fetch('/api/teacher/question-bank/topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectClassId: topicSetSubjectClassId, count: 12 }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to generate topics');
        return;
      }

      const topics = Array.isArray(payload.topics) ? payload.topics : [];
      setManualTopicsText(topics.join('\n'));
      toast.success('AI suggestions added');
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate topics');
    }
  }

  async function handleSaveTopicSet() {
    const topics = parseTopicsFromText(manualTopicsText);
    if (!topicSetName.trim() || !topicSetSubjectClassId || topics.length === 0) {
      toast.error('Name, subject/class, and at least one topic are required');
      return;
    }

    setIsSavingTopicSet(true);
    try {
      const response = await fetch('/api/teacher/question-bank/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: topicSetName, subjectClassId: topicSetSubjectClassId, topics }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to save topic set');
        return;
      }

      const createdTopicSet = payload.topicSet as TopicSet;
      setTopicSets((prev) => [createdTopicSet, ...prev]);
      setGenerateTopicSetId(createdTopicSet.id);
      setTopicSetName('');
      setManualTopicsText('');
      setIsTopicModalOpen(false);
      toast.success('Topic set saved');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save topic set');
    } finally {
      setIsSavingTopicSet(false);
    }
  }

  async function handleGenerateQuestions() {
    const fallbackTopics = parseTopicsFromText(generateTopicsText);
    if (!selectedBankId || !generateSubjectClassId) {
      toast.error('Select a bank and subject/class first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/teacher/question-bank/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId: selectedBankId,
          subjectClassId: generateSubjectClassId,
          topicSetId: generateTopicSetId || null,
          topics: fallbackTopics,
          difficulty: generateDifficulty,
          questionType: generateQuestionType,
          count: generateCount,
          visibility: generateVisibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Generation failed');
        return;
      }

      toast.success(`${payload.generatedCount || 0} question(s) added to bank`);
      setIsGenPanelOpen(false);
      setGenerateTopicsText('');
      await loadBankQuestions(selectedBankId);
    } catch (error) {
      console.error(error);
      toast.error('Question generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  function startEditQuestion(question: QuestionItem) {
    setEditingQuestionId(question.id);
    setEditingDraft({ ...question });
  }

  function cancelEditQuestion() {
    setEditingQuestionId('');
    setEditingDraft({});
  }

  async function handleCreateManualQuestion() {
    if (!selectedBank) {
      toast.error('Select a bank first');
      return;
    }

    const options = parseTopicsFromText(manualQuestionOptionsText);

    if (!manualQuestionTopic.trim() || !manualQuestionText.trim()) {
      toast.error('Topic and question text are required');
      return;
    }

    if (manualQuestionType === 'objective' && options.length < 2) {
      toast.error('Add at least two answer options for an objective question');
      return;
    }

    if (manualQuestionType === 'objective' && !manualQuestionCorrectAnswer.trim()) {
      toast.error('Add the correct answer for an objective question');
      return;
    }

    setIsCreatingQuestion(true);
    try {
      const response = await fetch('/api/teacher/question-bank/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId: selectedBank.id,
          subjectClassId: selectedBank.subject_class_id,
          topic: manualQuestionTopic,
          questionText: manualQuestionText,
          options,
          correctAnswer: manualQuestionCorrectAnswer,
          explanation: manualQuestionExplanation,
          questionType: manualQuestionType,
          difficulty: manualQuestionDifficulty,
          visibility: manualQuestionVisibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to create question');
        return;
      }

      setQuestions((prev) => [payload.question, ...prev]);
      setIsQuestionModalOpen(false);
      toast.success('Question added to bank');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create question');
    } finally {
      setIsCreatingQuestion(false);
    }
  }

  async function saveQuestionEdit(questionId: string) {
    try {
      const response = await fetch(`/api/teacher/question-bank/questions/${questionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: editingDraft.topic,
          questionText: editingDraft.question_text,
          options: editingDraft.options,
          correctAnswer: editingDraft.correct_answer,
          explanation: editingDraft.explanation,
          difficulty: editingDraft.difficulty,
          visibility: editingDraft.visibility,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to update question');
        return;
      }

      setQuestions((prev) => prev.map((q) => (q.id === questionId ? payload.question : q)));
      cancelEditQuestion();
      toast.success('Question updated');
    } catch (error) {
      console.error(error);
      toast.error('Failed to update question');
    }
  }

  async function deleteQuestion(questionId: string) {
    try {
      const response = await fetch(`/api/teacher/question-bank/questions/${questionId}`, {
        method: 'DELETE',
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to delete question');
        return;
      }

      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      toast.success('Question deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete question');
    }
  }

  async function duplicateQuestion(questionId: string) {
    const targetBankId = selectedBank?.created_by_teacher_id === teacherId ? selectedBank.id : myBanks[0]?.id;
    if (!targetBankId) {
      toast.error('Create your own bank before copying shared questions');
      return;
    }

    try {
      const response = await fetch(`/api/teacher/question-bank/questions/${questionId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankId: targetBankId, visibility: 'private' }),
      });

      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to copy question');
        return;
      }

      toast.success('Question copied to your bank');
      if (selectedBankId === targetBankId) {
        await loadBankQuestions(targetBankId);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to copy question');
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
            <div className="question-bank-spinner mx-auto h-10 w-10 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-4 text-sm font-medium text-slate-500">Loading your question banks...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="min-h-screen bg-slate-50/70 px-3 pb-16 pt-2">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.4fr_0.9fr]">
              <div className="relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-slate-50" />
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-2xl" />
                <div className="absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-sky-100/60 blur-3xl" />
                <div className="relative space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
                    <Layers className="h-3.5 w-3.5" />
                    Question Bank Workspace
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Manage question banks without the clutter.</h1>
                    <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                      Build banks, generate questions from selected topics, add manual questions, edit existing ones, and keep everything organised for later export.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
                      <DialogTrigger asChild>
                        <Button className="gap-2 bg-blue-600 shadow-sm hover:bg-blue-700">
                          <Plus className="h-4 w-4" /> New bank
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[460px]">
                        <DialogHeader>
                          <DialogTitle>Create Question Bank</DialogTitle>
                          <DialogDescription>A bank holds questions for a specific subject and class.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="bankTitle">Bank name</Label>
                            <Input
                              id="bankTitle"
                              value={bankTitle}
                              onChange={(e) => setBankTitle(e.target.value)}
                              placeholder="e.g., JSS2 Mathematics - Term 3 Mock"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="bankDesc">
                              Description <span className="font-normal text-slate-400">(optional)</span>
                            </Label>
                            <Textarea
                              id="bankDesc"
                              value={bankDescription}
                              onChange={(e) => setBankDescription(e.target.value)}
                              rows={2}
                              placeholder="Briefly describe the purpose of this bank..."
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label>Subject & class</Label>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                value={bankSubjectClassId}
                                onChange={(e) => setBankSubjectClassId(e.target.value)}
                              >
                                {subjectClasses.map((item) => (
                                  <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Visibility</Label>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                value={bankVisibility}
                                onChange={(e) => setBankVisibility(e.target.value as Visibility)}
                              >
                                <option value="private">Private - only me</option>
                                <option value="public_school">Shared with school</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsBankModalOpen(false)}>Cancel</Button>
                          <Button onClick={handleCreateBank} disabled={isCreatingBank}>{isCreatingBank ? 'Creating...' : 'Create bank'}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isTopicModalOpen} onOpenChange={setIsTopicModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="gap-2 border-slate-200 bg-white shadow-sm hover:bg-slate-50">
                          <BookOpen className="h-4 w-4" /> Save topics
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                          <DialogTitle>Save Topic Set</DialogTitle>
                          <DialogDescription>Create a reusable collection of topics for faster question generation.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="space-y-1.5">
                            <Label>Set name</Label>
                            <Input
                              value={topicSetName}
                              onChange={(e) => setTopicSetName(e.target.value)}
                              placeholder="e.g., Weeks 1-6 Calculus Intro"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Subject & class</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              value={topicSetSubjectClassId}
                              onChange={(e) => setTopicSetSubjectClassId(e.target.value)}
                            >
                              {subjectClasses.map((item) => (
                                <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label>Topics</Label>
                              <button onClick={handleGenerateTopics} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                                <Sparkles className="h-3.5 w-3.5" /> Suggest with AI
                              </button>
                            </div>
                            <Textarea
                              rows={5}
                              value={manualTopicsText}
                              onChange={(e) => setManualTopicsText(e.target.value)}
                              placeholder="Enter one topic per line, or separate with commas..."
                            />
                            <p className="text-xs text-slate-400">Each line or comma-separated value becomes one topic.</p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsTopicModalOpen(false)}>Cancel</Button>
                          <Button onClick={handleSaveTopicSet} disabled={isSavingTopicSet}>{isSavingTopicSet ? 'Saving...' : 'Save topic set'}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      className="gap-2 border-slate-200 bg-white shadow-sm hover:bg-slate-50"
                      onClick={openManualQuestionComposer}
                      disabled={!selectedBank}
                    >
                      <Plus className="h-4 w-4" /> Manual question
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 border-t border-slate-200 bg-slate-50/80 p-6 sm:grid-cols-2 lg:border-l lg:border-t-0 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Banks</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{banks.length}</p>
                  <p className="text-sm text-slate-500">All banks in this workspace</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Mine</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{myBanks.length}</p>
                  <p className="text-sm text-slate-500">Banks you created</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Questions</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{questions.length}</p>
                  <p className="text-sm text-slate-500">In the selected bank</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Filtered</p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{filteredQuestions.length}</p>
                  <p className="text-sm text-slate-500">Matching your filters</p>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4 xl:col-span-3">
              <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <FolderOpen className="h-3.5 w-3.5" /> Bank library
                  </CardTitle>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 shadow-none placeholder:text-slate-400"
                      placeholder="Search banks or classes"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  {visibleBanks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-12 text-center">
                      <FolderOpen className="mx-auto mb-3 h-8 w-8 stroke-1 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No matching banks</p>
                      <p className="mt-1 text-xs text-slate-400">Try a different search or create a new bank.</p>
                    </div>
                  ) : (
                    <div className="max-h-[620px] space-y-2 overflow-y-auto p-1">
                      {visibleBanks.map((bank) => {
                        const isActive = selectedBankId === bank.id;
                        const isMine = bank.created_by_teacher_id === teacherId;

                        return (
                          <button
                            key={bank.id}
                            onClick={() => setSelectedBankId(bank.id)}
                            className={`question-bank-card group w-full rounded-2xl border px-3 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${
                              isActive
                                ? 'border-blue-200 bg-blue-50 shadow-sm'
                                : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-sm font-semibold leading-snug ${isActive ? 'text-blue-900' : 'text-slate-900'}`}>
                                {bank.title}
                              </span>
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                bank.visibility === 'public_school'
                                  ? 'bg-sky-100 text-sky-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {bank.visibility === 'public_school' ? <Globe2 className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                                {bank.visibility === 'public_school' ? 'Shared' : 'Private'}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                              <span className="truncate">{getSubjectClassLabel(bank.subject_class_id)}</span>
                              {isMine && <span className="font-medium text-blue-600">My bank</span>}
                            </div>
                            {bank.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{bank.description}</p>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </aside>

            <main className="space-y-6 lg:col-span-8 xl:col-span-9">
              {selectedBank ? (
                <Card className="overflow-hidden rounded-3xl border-blue-200/70 shadow-sm">
                  <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-sky-500 px-6 py-5 text-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] backdrop-blur">
                          Selected bank
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold tracking-tight">{selectedBank.title}</h2>
                          <p className="mt-1 max-w-3xl text-sm text-white/85">{selectedBank.description || 'No description provided for this bank yet.'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
                          <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{getSubjectClassLabel(selectedBank.subject_class_id)}</span>
                          <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">
                            {selectedBank.visibility === 'public_school' ? 'Shared with school' : 'Private bank'}
                          </span>
                          <span className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{questions.length} questions</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" className="gap-2 bg-white text-blue-700 hover:bg-blue-50" onClick={openManualQuestionComposer}>
                          <Plus className="h-4 w-4" /> Add question
                        </Button>
                        <Button size="sm" variant="secondary" className="gap-2 bg-white text-blue-700 hover:bg-blue-50" onClick={() => setIsGenPanelOpen((prev) => !prev)}>
                          <Sparkles className="h-4 w-4" /> AI generator
                        </Button>
                      </div>
                    </div>
                  </div>

                  {isGenPanelOpen && (
                    <>
                      <Separator className="bg-blue-100" />
                      <CardContent className="space-y-4 bg-blue-50/25 p-6">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Subject & class</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              value={generateSubjectClassId}
                              onChange={(e) => setGenerateSubjectClassId(e.target.value)}
                            >
                              {subjectClasses.map((item) => (
                                <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Topic set</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              value={generateTopicSetId}
                              onChange={(e) => setGenerateTopicSetId(e.target.value)}
                            >
                              <option value="">Enter topics manually</option>
                              {selectedSubjectClassTopics.map((set) => (
                                <option key={set.id} value={set.id}>{set.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Difficulty</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              value={generateDifficulty}
                              onChange={(e) => setGenerateDifficulty(e.target.value as Difficulty)}
                            >
                              {DIFFICULTIES.map((lvl) => (
                                <option key={lvl} value={lvl}>{lvl}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">Question type</Label>
                            <select
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              value={generateQuestionType}
                              onChange={(e) => setGenerateQuestionType(e.target.value as QuestionType)}
                            >
                              {QUESTION_TYPES.map((ty) => (
                                <option key={ty} value={ty}>{ty}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4 items-end">
                          <div className="md:col-span-3 space-y-1.5">
                            <Label className="text-xs text-slate-500">Topics <span className="text-slate-400">(comma or line-separated - ignored if topic set selected)</span></Label>
                            <Input
                              value={generateTopicsText}
                              onChange={(e) => setGenerateTopicsText(e.target.value)}
                              placeholder="e.g., Quadratic equations, factorisation, number bases..."
                              disabled={!!generateTopicSetId}
                              className="h-10 text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500">How many</Label>
                            <Input type="number" min={1} max={30} value={generateCount} onChange={(e) => setGenerateCount(Number(e.target.value))} className="h-10 text-sm" />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100/70 pt-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-slate-500 whitespace-nowrap">Visible to:</Label>
                            <select
                              className="h-9 rounded-md border border-input bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                              value={generateVisibility}
                              onChange={(e) => setGenerateVisibility(e.target.value as Visibility)}
                            >
                              <option value="private">Only me</option>
                              <option value="public_school">Whole school</option>
                            </select>
                          </div>
                          <Button size="sm" onClick={handleGenerateQuestions} disabled={isGenerating} className="gap-2 bg-blue-600 px-5 shadow-sm hover:bg-blue-700">
                            {isGenerating ? (
                              <>
                                <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                Generate questions
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </>
                  )}
                </Card>
              ) : null}

              <Card className="rounded-3xl border-slate-200 shadow-sm">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-950">
                        {selectedBank ? 'Questions in this bank' : 'Select a bank'}
                      </CardTitle>
                      <CardDescription className="mt-1 text-sm">
                        {selectedBank
                          ? 'Search, filter, edit, and duplicate questions from the selected bank.'
                          : 'Choose a bank from the left rail to manage its questions.'}
                      </CardDescription>
                    </div>
                    {selectedBank && (
                      <Badge variant="outline" className="self-start border-slate-200 bg-slate-50 font-mono text-xs text-slate-600">
                        {filteredQuestions.length} shown / {questions.length} total
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 p-5 sm:p-6">
                  {selectedBank && (
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="relative md:col-span-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={questionSearch}
                          onChange={(e) => setQuestionSearch(e.target.value)}
                          className="h-10 rounded-xl border-slate-200 bg-slate-50 pl-10 shadow-none"
                          placeholder="Search questions, topics, or answers"
                        />
                      </div>
                      <select
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                        value={questionTypeFilter}
                        onChange={(e) => setQuestionTypeFilter(e.target.value as 'all' | QuestionType)}
                      >
                        <option value="all">All types</option>
                        {QUESTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                      <select
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                        value={questionDifficultyFilter}
                        onChange={(e) => setQuestionDifficultyFilter(e.target.value as 'all' | Difficulty)}
                      >
                        <option value="all">All difficulties</option>
                        {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                      </select>
                      <select
                        className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                        value={questionVisibilityFilter}
                        onChange={(e) => setQuestionVisibilityFilter(e.target.value as 'all' | Visibility)}
                      >
                        <option value="all">All visibility</option>
                        <option value="private">Private</option>
                        <option value="public_school">Shared</option>
                      </select>
                    </div>
                  )}

                  {isLoadingQuestions ? (
                    <div className="space-y-3 py-4">
                      {[1, 2].map((n) => (
                        <div key={n} className="space-y-2 animate-pulse">
                          <div className="h-4 w-1/3 rounded bg-slate-100" />
                          <div className="h-24 rounded-2xl bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : !selectedBank ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 py-20 text-center">
                      <HelpCircle className="mx-auto mb-3 h-10 w-10 stroke-1 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No bank selected</p>
                      <p className="mt-1 text-xs text-slate-400">Choose a bank from the left rail to begin.</p>
                    </div>
                  ) : filteredQuestions.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 py-20 text-center">
                      <HelpCircle className="mx-auto mb-3 h-10 w-10 stroke-1 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">
                        {questions.length === 0 ? 'No questions in this bank yet' : 'No questions match these filters'}
                      </p>
                      <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">
                        {questions.length === 0
                          ? 'Use the AI generator or manual composer to add the first question.'
                          : 'Clear the filters or try a broader search.'}
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <Button variant="outline" onClick={openManualQuestionComposer} className="gap-2">
                          <Plus className="h-4 w-4" /> Add question
                        </Button>
                        <Button variant="outline" onClick={() => setIsGenPanelOpen(true)} className="gap-2">
                          <Sparkles className="h-4 w-4" /> Generate with AI
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredQuestions.map((question, idx) => {
                        const isMine = question.created_by_teacher_id === teacherId;
                        const isEditing = editingQuestionId === question.id;

                        return (
                          <div key={question.id} className="question-bank-card group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                            <div className="border-b border-slate-100 px-5 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${difficultyStyles[question.difficulty]}`}>
                                  {question.difficulty}
                                </span>
                                <Badge variant="secondary" className="border-0 bg-slate-100 text-[10px] uppercase font-semibold tracking-wide text-slate-600">
                                  {question.question_type}
                                </Badge>
                                <Badge variant="secondary" className="border border-blue-100 bg-blue-50 text-[10px] font-normal text-blue-700">
                                  {question.topic}
                                </Badge>
                                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-400">
                                  {question.visibility === 'public_school' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                  {question.visibility === 'public_school' ? 'Shared' : 'Private'}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-4 px-5 py-5">
                              {isEditing ? (
                                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500">Topic</Label>
                                      <Input
                                        value={editingDraft.topic || ''}
                                        onChange={(e) => setEditingDraft((p) => ({ ...p, topic: e.target.value }))}
                                        className="h-10 bg-white text-sm"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500">Difficulty</Label>
                                      <select
                                        className="h-10 w-full rounded-md border border-input bg-white px-3 text-xs outline-none"
                                        value={editingDraft.difficulty}
                                        onChange={(e) => setEditingDraft((p) => ({ ...p, difficulty: e.target.value as Difficulty }))}
                                      >
                                        {DIFFICULTIES.map((l) => <option key={l} value={l}>{l}</option>)}
                                      </select>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500">Question text</Label>
                                    <Textarea
                                      rows={3}
                                      value={editingDraft.question_text || ''}
                                      onChange={(e) => setEditingDraft((p) => ({ ...p, question_text: e.target.value }))}
                                      className="bg-white"
                                    />
                                  </div>

                                  {question.question_type === 'objective' && (
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500">Answer options <span className="text-slate-400">(one per line)</span></Label>
                                      <Textarea
                                        rows={4}
                                        value={(editingDraft.options || []).join('\n')}
                                        onChange={(e) => setEditingDraft((p) => ({ ...p, options: parseTopicsFromText(e.target.value) }))}
                                        placeholder="Option A\nOption B"
                                        className="bg-white"
                                      />
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500">Correct answer</Label>
                                      <Input
                                        value={editingDraft.correct_answer || ''}
                                        onChange={(e) => setEditingDraft((p) => ({ ...p, correct_answer: e.target.value }))}
                                        className="h-10 bg-white text-sm"
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-slate-500">Visibility</Label>
                                      <select
                                        className="h-10 w-full rounded-md border border-input bg-white px-3 text-xs outline-none"
                                        value={editingDraft.visibility}
                                        onChange={(e) => setEditingDraft((p) => ({ ...p, visibility: e.target.value as Visibility }))}
                                      >
                                        <option value="private">Private - only me</option>
                                        <option value="public_school">Shared with school</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500">Explanation / marking notes</Label>
                                    <Textarea
                                      rows={2}
                                      value={editingDraft.explanation || ''}
                                      onChange={(e) => setEditingDraft((p) => ({ ...p, explanation: e.target.value }))}
                                      className="bg-white"
                                    />
                                  </div>

                                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                                    <Button size="sm" variant="outline" onClick={cancelEditQuestion} className="h-9 gap-1.5 text-xs">
                                      <X className="h-3.5 w-3.5" /> Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => void saveQuestionEdit(question.id)} className="h-9 gap-1.5 bg-emerald-600 text-xs hover:bg-emerald-700">
                                      <Save className="h-3.5 w-3.5" /> Save changes
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-[15px] font-medium leading-relaxed text-slate-900">{question.question_text}</p>

                                  {question.question_type === 'objective' && Array.isArray(question.options) && question.options.length > 0 && (
                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                      {question.options.map((option, index) => {
                                        const isCorrect = question.correct_answer?.trim().toLowerCase() === option.trim().toLowerCase();
                                        return (
                                          <div
                                            key={index}
                                            className={`flex items-start gap-2 rounded-2xl border p-3 text-sm transition-all ${
                                              isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-100 bg-slate-50 text-slate-600'
                                            }`}
                                          >
                                            <span className="mt-0.5 shrink-0 text-[11px] font-bold uppercase tracking-wider opacity-50">{String.fromCharCode(65 + index)}.</span>
                                            <span className={isCorrect ? 'font-medium' : ''}>{option}</span>
                                            {isCorrect && <CheckCircle2 className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {question.question_type !== 'objective' && question.correct_answer && (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Model answer</p>
                                      <p className="text-emerald-900">{question.correct_answer}</p>
                                    </div>
                                  )}

                                  {question.explanation && (
                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm">
                                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Explanation</p>
                                      <p className="text-xs leading-relaxed text-slate-600">{question.explanation}</p>
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-4">
                                    {isMine ? (
                                      <>
                                        <Button variant="ghost" size="sm" onClick={() => startEditQuestion(question)} className="h-9 gap-1.5 text-xs text-slate-600 hover:bg-slate-100">
                                          <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => void deleteQuestion(question.id)} className="h-9 gap-1.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700">
                                          <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </Button>
                                      </>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => void duplicateQuestion(question.id)} className="h-9 gap-1.5 border-blue-200 text-xs text-blue-600 hover:bg-blue-50">
                                        <Copy className="h-3.5 w-3.5" /> Copy to my bank
                                      </Button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </main>
          </div>
        </div>

        <Dialog open={isQuestionModalOpen} onOpenChange={setIsQuestionModalOpen}>
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle>Manual Question Composer</DialogTitle>
              <DialogDescription>Add a new question directly to {selectedBank?.title || 'the selected bank'}.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Topic</Label>
                  <Input value={manualQuestionTopic} onChange={(e) => setManualQuestionTopic(e.target.value)} placeholder="e.g., Quadratic equations" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={manualQuestionType} onChange={(e) => setManualQuestionType(e.target.value as QuestionType)}>
                      {QUESTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Difficulty</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={manualQuestionDifficulty} onChange={(e) => setManualQuestionDifficulty(e.target.value as Difficulty)}>
                      {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Question text</Label>
                <Textarea
                  rows={4}
                  value={manualQuestionText}
                  onChange={(e) => setManualQuestionText(e.target.value)}
                  placeholder="Write the question exactly as students will see it..."
                />
              </div>

              {manualQuestionType === 'objective' && (
                <div className="space-y-1.5">
                  <Label>Answer options</Label>
                  <Textarea rows={4} value={manualQuestionOptionsText} onChange={(e) => setManualQuestionOptionsText(e.target.value)} placeholder="One option per line" />
                  <p className="text-xs text-slate-400">Use one line per answer option.</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Correct answer</Label>
                  <Input value={manualQuestionCorrectAnswer} onChange={(e) => setManualQuestionCorrectAnswer(e.target.value)} placeholder="Correct option or model answer" />
                </div>
                <div className="space-y-1.5">
                  <Label>Visibility</Label>
                  <select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={manualQuestionVisibility} onChange={(e) => setManualQuestionVisibility(e.target.value as Visibility)}>
                    <option value="private">Private - only me</option>
                    <option value="public_school">Shared with school</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Explanation / marking notes</Label>
                <Textarea rows={3} value={manualQuestionExplanation} onChange={(e) => setManualQuestionExplanation(e.target.value)} placeholder="Optional notes, rationale, or marking guidance" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsQuestionModalOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleCreateManualQuestion()} disabled={isCreatingQuestion} className="gap-2">
                {isCreatingQuestion ? (
                  <>
                    <div className="question-bank-spinner h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Save question
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <style jsx global>{`
          @media (prefers-reduced-motion: reduce) {
            .question-bank-card,
            .question-bank-spinner {
              animation: none !important;
              transition: opacity 0.2s ease-out !important;
              transform: none !important;
            }

            .question-bank-card:hover {
              transform: none !important;
            }
          }
        `}</style>
      </div>
    </DashboardLayout>
  );
}