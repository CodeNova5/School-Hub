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
  Sparkles, Plus, Copy, Pencil, Trash2, Save, X,
  FolderOpen, BookOpen, Layers, ChevronDown, ChevronUp,
  Eye, EyeOff, HelpCircle, CheckCircle2, Lock, Globe2
} from 'lucide-react';

type SubjectClassItem = {
  id: string;
  subjects?: { id: string; name: string } | null;
  classes?: { id: string; name: string } | null;
};

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
  visibility: 'private' | 'public_school';
  created_by_teacher_id: string;
};

type QuestionItem = {
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
};

type ContextPayload = {
  teacherId: string;
  subjectClasses: SubjectClassItem[];
  topicSets: TopicSet[];
  banks: QuestionBank[];
};

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const QUESTION_TYPES = ['objective', 'theory'] as const;

const difficultyStyles = {
  hard: 'border-red-200 text-red-700 bg-red-50',
  medium: 'border-amber-200 text-amber-700 bg-amber-50',
  easy: 'border-emerald-200 text-emerald-700 bg-emerald-50',
};

export default function TeacherQuestionBankPage() {
  // Global View States
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingTopicSet, setIsSavingTopicSet] = useState(false);
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGenPanelOpen, setIsGenPanelOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);

  // Context Data
  const [teacherId, setTeacherId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [topicSets, setTopicSets] = useState<TopicSet[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  // Mutation Form States: New Bank
  const [bankTitle, setBankTitle] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [bankSubjectClassId, setBankSubjectClassId] = useState('');
  const [bankVisibility, setBankVisibility] = useState<'private' | 'public_school'>('private');

  // Mutation Form States: New Topic Set
  const [topicSetName, setTopicSetName] = useState('');
  const [topicSetSubjectClassId, setTopicSetSubjectClassId] = useState('');
  const [manualTopicsText, setManualTopicsText] = useState('');

  // AI Generation Config Form States
  const [generateSubjectClassId, setGenerateSubjectClassId] = useState('');
  const [generateTopicSetId, setGenerateTopicSetId] = useState('');
  const [generateTopicsText, setGenerateTopicsText] = useState('');
  const [generateDifficulty, setGenerateDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [generateQuestionType, setGenerateQuestionType] = useState<'objective' | 'theory'>('objective');
  const [generateCount, setGenerateCount] = useState(5);
  const [generateVisibility, setGenerateVisibility] = useState<'private' | 'public_school'>('private');

  // Inline Question Editing Target States
  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [editingDraft, setEditingDraft] = useState<Partial<QuestionItem>>({});

  // Memoized Selectors
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
    }
  }, [selectedBankId]);

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
    const targetBankId = myBanks[0]?.id;
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
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-4">
            <div className="h-10 w-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
            <p className="text-sm text-gray-500 font-medium">Loading your question banks…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto min-h-screen pb-16 px-1">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5">
              <Layers className="h-6 w-6 text-blue-600 shrink-0" />
              Question Banks
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Generate, review, and manage exam questions with AI assistance.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* New Bank Dialog */}
            <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 shadow-sm">
                  <Plus className="h-4 w-4" /> New Bank
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                  <DialogTitle>Create Question Bank</DialogTitle>
                  <DialogDescription>
                    A bank holds questions for a specific subject and class.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="bankTitle">Bank name</Label>
                    <Input
                      id="bankTitle"
                      value={bankTitle}
                      onChange={(e) => setBankTitle(e.target.value)}
                      placeholder="e.g., JSS2 Mathematics – Term 3 Mock"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bankDesc">
                      Description <span className="text-gray-400 font-normal">(optional)</span>
                    </Label>
                    <Textarea
                      id="bankDesc"
                      value={bankDescription}
                      onChange={(e) => setBankDescription(e.target.value)}
                      rows={2}
                      placeholder="Briefly describe the purpose of this bank…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Subject & class</Label>
                      <select
                        className="w-full border border-input rounded-md px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                        className="w-full border border-input rounded-md px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        value={bankVisibility}
                        onChange={(e) => setBankVisibility(e.target.value as any)}
                      >
                        <option value="private">Private – only me</option>
                        <option value="public_school">Shared with school</option>
                      </select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBankModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateBank} disabled={isCreatingBank}>
                    {isCreatingBank ? 'Creating…' : 'Create bank'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Save Topic Set Dialog */}
            <Dialog open={isTopicModalOpen} onOpenChange={setIsTopicModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-gray-200 shadow-sm">
                  <BookOpen className="h-4 w-4" /> Save Topics
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Save Topic Set</DialogTitle>
                  <DialogDescription>
                    Create a reusable collection of topics for faster question generation.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Set name</Label>
                    <Input
                      value={topicSetName}
                      onChange={(e) => setTopicSetName(e.target.value)}
                      placeholder="e.g., Weeks 1–6 Calculus Intro"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Subject & class</Label>
                    <select
                      className="w-full border border-input rounded-md px-3 h-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      value={topicSetSubjectClassId}
                      onChange={(e) => setTopicSetSubjectClassId(e.target.value)}
                    >
                      {subjectClasses.map((item) => (
                        <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Topics</Label>
                      <button
                        onClick={handleGenerateTopics}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Suggest with AI
                      </button>
                    </div>
                    <Textarea
                      rows={5}
                      value={manualTopicsText}
                      onChange={(e) => setManualTopicsText(e.target.value)}
                      placeholder="Enter one topic per line, or separate with commas…"
                    />
                    <p className="text-xs text-gray-400">Each line or comma-separated value becomes one topic.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTopicModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveTopicSet} disabled={isSavingTopicSet}>
                    {isSavingTopicSet ? 'Saving…' : 'Save topic set'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── Sidebar: Bank List ── */}
          <div className="lg:col-span-4 xl:col-span-3">
            <Card className="border-gray-200 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="h-3.5 w-3.5" /> Your Banks
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                {banks.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <FolderOpen className="h-8 w-8 text-gray-300 mx-auto mb-2 stroke-1" />
                    <p className="text-sm text-gray-500 font-medium">No banks yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click "New Bank" above to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 max-h-[620px] overflow-y-auto">
                    {banks.map((bank) => {
                      const isActive = selectedBankId === bank.id;
                      const isMine = bank.created_by_teacher_id === teacherId;
                      return (
                        <button
                          key={bank.id}
                          onClick={() => setSelectedBankId(bank.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex flex-col gap-0.5 ${
                            isActive
                              ? 'bg-blue-50 border border-blue-200 shadow-sm'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`font-medium text-sm line-clamp-2 leading-snug ${isActive ? 'text-blue-900' : 'text-gray-800'}`}>
                              {bank.title}
                            </span>
                            <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${
                              bank.visibility === 'public_school'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {bank.visibility === 'public_school'
                                ? <Globe2 className="h-2.5 w-2.5" />
                                : <Lock className="h-2.5 w-2.5" />}
                              {bank.visibility === 'public_school' ? 'Shared' : 'Private'}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 truncate">{getSubjectClassLabel(bank.subject_class_id)}</span>
                          {isMine && (
                            <span className="text-[10px] text-blue-500 font-medium mt-0.5">My bank</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Main Panel ── */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-5">

            {/* ── AI Generate Panel ── */}
            {selectedBank ? (
              <Card className="border-blue-200/80 overflow-hidden shadow-sm">
                <button
                  onClick={() => setIsGenPanelOpen(!isGenPanelOpen)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-50/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600 shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Generate questions with AI</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Adding to <span className="text-blue-700 font-medium">{selectedBank.title}</span>
                      </p>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 transition-colors shrink-0">
                    {isGenPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isGenPanelOpen && (
                  <>
                    <Separator className="bg-blue-100" />
                    <CardContent className="p-5 space-y-4 bg-blue-50/20">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">Subject & class</Label>
                          <select
                            className="w-full border border-input rounded-md px-2.5 h-9 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            value={generateSubjectClassId}
                            onChange={(e) => setGenerateSubjectClassId(e.target.value)}
                          >
                            {subjectClasses.map((item) => (
                              <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">Topic set</Label>
                          <select
                            className="w-full border border-input rounded-md px-2.5 h-9 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
                          <Label className="text-xs text-gray-500">Difficulty</Label>
                          <select
                            className="w-full border border-input rounded-md px-2.5 h-9 text-xs bg-white capitalize focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            value={generateDifficulty}
                            onChange={(e) => setGenerateDifficulty(e.target.value as any)}
                          >
                            {DIFFICULTIES.map((lvl) => (
                              <option key={lvl} value={lvl} className="capitalize">{lvl}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">Question type</Label>
                          <select
                            className="w-full border border-input rounded-md px-2.5 h-9 text-xs bg-white capitalize focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            value={generateQuestionType}
                            onChange={(e) => setGenerateQuestionType(e.target.value as any)}
                          >
                            {QUESTION_TYPES.map((ty) => (
                              <option key={ty} value={ty} className="capitalize">{ty}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div className="md:col-span-3 space-y-1.5">
                          <Label className="text-xs text-gray-500">
                            Topics <span className="text-gray-400">(comma or line-separated — ignored if topic set selected)</span>
                          </Label>
                          <Input
                            value={generateTopicsText}
                            onChange={(e) => setGenerateTopicsText(e.target.value)}
                            placeholder="e.g., Quadratic equations, factorisation, number bases…"
                            disabled={!!generateTopicSetId}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-500">How many to generate</Label>
                          <Input
                            type="number"
                            min={1}
                            max={30}
                            value={generateCount}
                            onChange={(e) => setGenerateCount(Number(e.target.value))}
                            className="h-9 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-blue-100/60">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-500 whitespace-nowrap">Generated questions visible to:</Label>
                          <select
                            className="border border-input rounded-md px-2 h-8 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                            value={generateVisibility}
                            onChange={(e) => setGenerateVisibility(e.target.value as any)}
                          >
                            <option value="private">Only me</option>
                            <option value="public_school">Whole school</option>
                          </select>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleGenerateQuestions}
                          disabled={isGenerating}
                          className="bg-blue-600 hover:bg-blue-700 shadow-sm gap-2 px-5"
                        >
                          {isGenerating ? (
                            <>
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              Generating…
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

            {/* ── Questions List ── */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <CardTitle className="text-base font-bold text-gray-900">
                    {selectedBank ? selectedBank.title : 'Select a bank'}
                  </CardTitle>
                  {selectedBank?.description && (
                    <CardDescription className="mt-0.5 text-xs">{selectedBank.description}</CardDescription>
                  )}
                </div>
                {questions.length > 0 && (
                  <Badge variant="outline" className="font-mono text-xs bg-gray-50 text-gray-600 shrink-0">
                    {questions.length} question{questions.length === 1 ? '' : 's'}
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {isLoadingQuestions ? (
                  <div className="space-y-3 py-4">
                    {[1, 2].map((n) => (
                      <div key={n} className="space-y-2 animate-pulse">
                        <div className="h-4 bg-gray-100 rounded w-1/3" />
                        <div className="h-16 bg-gray-100 rounded" />
                      </div>
                    ))}
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/40">
                    <HelpCircle className="h-9 w-9 text-gray-300 mx-auto mb-3 stroke-1" />
                    <p className="text-sm font-semibold text-gray-700">No questions in this bank yet</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                      Use the AI generator above to add questions instantly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questions.map((question, idx) => {
                      const isMine = question.created_by_teacher_id === teacherId;
                      const isEditing = editingQuestionId === question.id;

                      return (
                        <div
                          key={question.id}
                          className="border border-gray-200 rounded-xl bg-white hover:border-gray-300 hover:shadow-sm transition-all group"
                        >
                          <div className="p-5">
                            {/* Question Meta Row */}
                            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                              <span className="text-xs text-gray-400 font-mono mr-1">#{idx + 1}</span>

                              <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border ${difficultyStyles[question.difficulty]}`}>
                                {question.difficulty}
                              </span>

                              <Badge variant="secondary" className="text-[10px] uppercase font-semibold tracking-wide bg-gray-100 text-gray-600 border-0">
                                {question.question_type}
                              </Badge>

                              <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 font-normal">
                                {question.topic}
                              </Badge>

                              <span className="ml-auto flex items-center gap-1 text-gray-400 text-xs">
                                {question.visibility === 'public_school'
                                  ? <Eye className="h-3.5 w-3.5" />
                                  : <EyeOff className="h-3.5 w-3.5" />}
                                <span className="hidden sm:inline text-[11px]">
                                  {question.visibility === 'public_school' ? 'Shared' : 'Private'}
                                </span>
                              </span>
                            </div>

                            {/* Edit Form or Display */}
                            {isEditing ? (
                              <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200 mt-2">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Topic</Label>
                                    <Input
                                      value={editingDraft.topic || ''}
                                      onChange={(e) => setEditingDraft((p) => ({ ...p, topic: e.target.value }))}
                                      className="h-8 bg-white text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Difficulty</Label>
                                    <select
                                      className="w-full border border-input rounded-md px-2 h-8 text-xs bg-white"
                                      value={editingDraft.difficulty}
                                      onChange={(e) => setEditingDraft((p) => ({ ...p, difficulty: e.target.value as any }))}
                                    >
                                      {DIFFICULTIES.map((l) => (
                                        <option key={l} value={l} className="capitalize">{l}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Question text</Label>
                                  <Textarea
                                    rows={3}
                                    value={editingDraft.question_text || ''}
                                    onChange={(e) => setEditingDraft((p) => ({ ...p, question_text: e.target.value }))}
                                    className="bg-white"
                                  />
                                </div>

                                {question.question_type === 'objective' && (
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Answer options <span className="text-gray-400">(one per line)</span></Label>
                                    <Textarea
                                      rows={4}
                                      value={(editingDraft.options || []).join('\n')}
                                      onChange={(e) =>
                                        setEditingDraft((p) => ({ ...p, options: parseTopicsFromText(e.target.value) }))
                                      }
                                      placeholder="Option A&#10;Option B"
                                      className="bg-white"
                                    />
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Correct answer</Label>
                                    <Input
                                      value={editingDraft.correct_answer || ''}
                                      onChange={(e) => setEditingDraft((p) => ({ ...p, correct_answer: e.target.value }))}
                                      className="h-8 bg-white text-sm"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-gray-500">Visibility</Label>
                                    <select
                                      className="w-full border border-input rounded-md px-2 h-8 text-xs bg-white"
                                      value={editingDraft.visibility}
                                      onChange={(e) => setEditingDraft((p) => ({ ...p, visibility: e.target.value as any }))}
                                    >
                                      <option value="private">Private – only me</option>
                                      <option value="public_school">Shared with school</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Explanation / marking notes</Label>
                                  <Textarea
                                    rows={2}
                                    value={editingDraft.explanation || ''}
                                    onChange={(e) => setEditingDraft((p) => ({ ...p, explanation: e.target.value }))}
                                    className="bg-white"
                                  />
                                </div>

                                <div className="flex justify-end gap-2 pt-1">
                                  <Button size="sm" variant="outline" onClick={cancelEditQuestion} className="h-8 text-xs gap-1">
                                    <X className="h-3.5 w-3.5" /> Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => void saveQuestionEdit(question.id)}
                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                                  >
                                    <Save className="h-3.5 w-3.5" /> Save changes
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-gray-900 font-medium text-[15px] leading-relaxed">
                                  {question.question_text}
                                </p>

                                {question.question_type === 'objective' &&
                                  Array.isArray(question.options) &&
                                  question.options.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                                      {question.options.map((option, index) => {
                                        const isCorrect =
                                          question.correct_answer?.trim().toLowerCase() ===
                                          option.trim().toLowerCase();
                                        return (
                                          <div
                                            key={index}
                                            className={`flex items-start gap-2 p-2.5 rounded-lg text-sm border transition-all ${
                                              isCorrect
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                                : 'bg-gray-50 border-gray-100 text-gray-600'
                                            }`}
                                          >
                                            <span className="text-[11px] font-bold shrink-0 mt-0.5 uppercase opacity-50 tracking-wider">
                                              {String.fromCharCode(65 + index)}.
                                            </span>
                                            <span className={isCorrect ? 'font-medium' : ''}>{option}</span>
                                            {isCorrect && (
                                              <CheckCircle2 className="h-3.5 w-3.5 ml-auto shrink-0 text-emerald-600 mt-0.5" />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                {question.question_type !== 'objective' && question.correct_answer && (
                                  <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-sm">
                                    <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                                      Model answer
                                    </p>
                                    <p className="text-emerald-900">{question.correct_answer}</p>
                                  </div>
                                )}

                                {question.explanation && (
                                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                      Explanation
                                    </p>
                                    <p className="text-gray-600 text-xs leading-relaxed">{question.explanation}</p>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-gray-100 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                  {isMine ? (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => startEditQuestion(question)}
                                        className="h-8 text-xs text-gray-600 hover:bg-gray-100 gap-1"
                                      >
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void deleteQuestion(question.id)}
                                        className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void duplicateQuestion(question.id)}
                                      className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 gap-1"
                                    >
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

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}