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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Sparkles, Plus, Copy, Pencil, Trash2, Save, X, 
  FolderOpen, BookOpen, Layers, Settings2, SlidersHorizontal,
  ChevronDown, ChevronUp, Eye, EyeOff, HelpCircle, CheckCircle2
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

  // Sync automatic target values when standard parameters flip
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
      toast.error('Enter bank title and select subject/class');
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
      toast.success('Question bank created successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to create bank');
    } finally {
      setIsCreatingBank(false);
    }
  }

  async function handleGenerateTopics() {
    if (!topicSetSubjectClassId) {
      toast.error('Select subject/class first');
      return;
    }

    try {
      const response = await fetch('/api/teacher/question-bank/topics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectClassId: topicSetSubjectClassId,
          count: 12,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error || 'Failed to generate topics');
        return;
      }
      const topics = Array.isArray(payload.topics) ? payload.topics : [];
      setManualTopicsText(topics.join('\n'));
      toast.success('AI suggestions added to text field');
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
        body: JSON.stringify({
          name: topicSetName,
          subjectClassId: topicSetSubjectClassId,
          topics,
        }),
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
      toast.success('Topic set saved for reuse');
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
      toast.error('Select an active bank and subject/class to target');
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
        toast.error(payload?.error || 'Question generation failed');
        return;
      }

      toast.success(`Generated ${payload.generatedCount || 0} question(s) directly into bank`);
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
      toast.success('Question updated successfully');
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
      toast.success('Question removed');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete question');
    }
  }

  async function duplicateQuestion(questionId: string) {
    const targetBankId = myBanks[0]?.id;
    if (!targetBankId) {
      toast.error('Create your own bank before duplicating shared questions');
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
        toast.error(payload?.error || 'Failed to duplicate question');
        return;
      }
      toast.success('Question duplicated into your personal bank workspace');
      if (selectedBankId === targetBankId) {
        await loadBankQuestions(targetBankId);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to duplicate question');
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="h-screen flex items-center justify-center bg-gray-50/50">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
            <p className="text-sm font-medium text-gray-500">Syncing Question Engine Context...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="flex flex-col space-y-6 max-w-[1600px] mx-auto min-h-screen pb-12">
        
        {/* Top Minimal Action Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <Layers className="h-6 w-6 text-blue-600" /> AI Question Engine
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Generate, audit, curate, and scaffold student-ready assessments instantly.</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Create Bank Dialog Launcher */}
            <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="shadow-sm border-gray-200">
                  <Plus className="h-4 w-4 mr-1.5 text-gray-500" /> New Question Bank
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Create Question Bank Container</DialogTitle>
                  <DialogDescription>Setup a repository to hold target assessment criteria.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <Label htmlFor="bankTitle">Bank Title</Label>
                    <Input id="bankTitle" value={bankTitle} onChange={(e) => setBankTitle(e.target.value)} placeholder="e.g., JSS2 Mathematics Term 3 Mock" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bankDesc">Description (Optional)</Label>
                    <Textarea id="bankDesc" value={bankDescription} onChange={(e) => setBankDescription(e.target.value)} rows={2} placeholder="Briefly describe target testing goals..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Subject/Class Track</Label>
                      <select className="w-full border rounded-md px-3 h-10 text-sm bg-white" value={bankSubjectClassId} onChange={(e) => setBankSubjectClassId(e.target.value)}>
                        {subjectClasses.map((item) => (
                          <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Privacy Guard</Label>
                      <select className="w-full border rounded-md px-3 h-10 text-sm bg-white" value={bankVisibility} onChange={(e) => setBankVisibility(e.target.value as any)}>
                        <option value="private">Private (Only You)</option>
                        <option value="public_school">Shared with School</option>
                      </select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBankModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateBank} disabled={isCreatingBank}>{isCreatingBank ? "Creating..." : "Build Bank"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Create Topic Set Dialog Launcher */}
            <Dialog open={isTopicModalOpen} onOpenChange={setIsTopicModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="shadow-sm border-gray-200">
                  <BookOpen className="h-4 w-4 mr-1.5 text-gray-500" /> Save Topic Group
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Define Reusable Topic Set</DialogTitle>
                  <DialogDescription>Group syllabus structures for recurring assessment generation passes.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <Label>Topic Group Name</Label>
                    <Input value={topicSetName} onChange={(e) => setTopicSetName(e.target.value)} placeholder="e.g., Week 1-6 Calculus Intro" />
                  </div>
                  <div className="space-y-1">
                    <Label>Subject & Target Class Mapping</Label>
                    <select className="w-full border rounded-md px-3 h-10 text-sm bg-white" value={topicSetSubjectClassId} onChange={(e) => setTopicSetSubjectClassId(e.target.value)}>
                      {subjectClasses.map((item) => (
                        <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Scope Breakdown Rules</Label>
                      <Button variant="link" size="sm" onClick={handleGenerateTopics} className="h-auto p-0 text-blue-600 gap-1 text-xs">
                        <Sparkles className="h-3.5 w-3.5" /> Auto-Suggest via AI
                      </Button>
                    </div>
                    <Textarea rows={5} value={manualTopicsText} onChange={(e) => setManualTopicsText(e.target.value)} placeholder="Separate items using commas or lines..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTopicModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleSaveTopicSet} disabled={isSavingTopicSet}>{isSavingTopicSet ? "Saving..." : "Save Configuration"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Dynamic Split Screening Layout Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Navigation Explorer Column */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-5">
            <Card className="shadow-sm border-gray-200/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-gray-400" /> Scope Repositories
                </CardTitle>
                <CardDescription>Select an active bank container to query entries.</CardDescription>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                {banks.length === 0 ? (
                  <div className="text-center p-6 text-gray-400 text-xs">No repositories available. Create one above.</div>
                ) : (
                  <div className="space-y-1 max-h-[640px] overflow-y-auto pr-1">
                    {banks.map((bank) => {
                      const isActive = selectedBankId === bank.id;
                      const isMine = bank.created_by_teacher_id === teacherId;
                      return (
                        <button
                          key={bank.id}
                          onClick={() => setSelectedBankId(bank.id)}
                          className={`w-full text-left p-3 rounded-lg transition-all flex flex-col gap-1 ${
                            isActive 
                              ? 'bg-blue-50/70 border border-blue-200 text-blue-900 shadow-xs' 
                              : 'hover:bg-gray-50 text-gray-700 border border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm line-clamp-2 leading-tight">{bank.title}</span>
                            <Badge variant={bank.visibility === 'public_school' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 scale-90 origin-right shrink-0">
                              {bank.visibility === 'public_school' ? 'Shared' : 'Private'}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-gray-400 mt-1 block truncate">{getSubjectClassLabel(bank.subject_class_id)}</span>
                          <span className="text-[10px] uppercase tracking-wider font-semibold opacity-60">{isMine ? '● Workspace Owner' : '○ Curated Resource'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Canvas Area */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            
            {/* Context-Aware Re-architected Collapsible AI Question Suite */}
            {selectedBank ? (
              <Card className="border-blue-200/70 bg-gradient-to-b from-blue-50/20 to-white overflow-hidden shadow-sm">
                <button 
                  onClick={() => setIsGenPanelOpen(!isGenPanelOpen)}
                  className="w-full flex items-center justify-between p-5 text-left border-none focus:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100/80 rounded-lg text-blue-700">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-gray-900">AI Blueprint Ingestion Pipeline</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Targeting bank: <span className="text-blue-700 font-medium">{selectedBank.title}</span>
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {isGenPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </button>

                {isGenPanelOpen && (
                  <>
                    <Separator className="bg-blue-100/50" />
                    <CardContent className="p-6 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Syllabus Execution Track</Label>
                          <select className="w-full border rounded-md px-3 h-9 text-xs bg-white" value={generateSubjectClassId} onChange={(e) => setGenerateSubjectClassId(e.target.value)}>
                            {subjectClasses.map((item) => (
                              <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Topic Sets Grouping</Label>
                          <select className="w-full border rounded-md px-3 h-9 text-xs bg-white" value={generateTopicSetId} onChange={(e) => setGenerateTopicSetId(e.target.value)}>
                            <option value="">-- Use Explicit Prompting Below --</option>
                            {selectedSubjectClassTopics.map((set) => (
                              <option key={set.id} value={set.id}>{set.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Target Taxonomy Depth</Label>
                          <select className="w-full border rounded-md px-3 h-9 text-xs bg-white" value={generateDifficulty} onChange={(e) => setGenerateDifficulty(e.target.value as any)}>
                            {DIFFICULTIES.map((lvl) => <option key={lvl} value={lvl}>{lvl.toUpperCase()}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Structural Format</Label>
                          <select className="w-full border rounded-md px-3 h-9 text-xs bg-white" value={generateQuestionType} onChange={(e) => setGenerateQuestionType(e.target.value as any)}>
                            {QUESTION_TYPES.map((ty) => <option key={ty} value={ty}>{ty.toUpperCase()}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs text-gray-500">Custom/Fallback Topic Scaffolding Prompt</Label>
                          <Input 
                            value={generateTopicsText} 
                            onChange={(e) => setGenerateTopicsText(e.target.value)}
                            placeholder="e.g., Quadratic equations, factorization parameters..." 
                            disabled={!!generateTopicSetId}
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-gray-500">Batch Run Size</Label>
                          <Input type="number" min={1} max={30} value={generateCount} onChange={(e) => setGenerateCount(Number(e.target.value))} className="h-9 text-xs" />
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-dashed border-gray-100">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-400">Direct Ingestion Visibility:</Label>
                          <select className="border-none text-xs bg-transparent font-medium text-gray-600 focus:ring-0" value={generateVisibility} onChange={(e) => setGenerateVisibility(e.target.value as any)}>
                            <option value="private">Private Draft</option>
                            <option value="public_school">School Library Instance</option>
                          </select>
                        </div>
                        <Button size="sm" onClick={handleGenerateQuestions} disabled={isGenerating} className="bg-blue-600 hover:bg-blue-700 shadow-sm px-4">
                          {isGenerating ? (
                            <>
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2" />
                              Synthesizing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-1.5" /> Execute Generation
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            ) : null}

            {/* Questions Stream Grid */}
            <Card className="shadow-sm border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900">
                    {selectedBank ? selectedBank.title : "Select Container"}
                  </CardTitle>
                  {selectedBank?.description && (
                    <CardDescription className="text-xs mt-0.5">{selectedBank.description}</CardDescription>
                  )}
                </div>
                <Badge variant="outline" className="font-mono text-xs px-2.5 py-1 bg-gray-50 text-gray-600">
                  {questions.length} Question{questions.length === 1 ? '' : 's'} Logged
                </Badge>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                {isLoadingQuestions ? (
                  <div className="space-y-3 py-6">
                    <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                    <div className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                  </div>
                ) : questions.length === 0 ? (
                  <div className="text-center py-16 border border-dashed rounded-xl border-gray-200 bg-gray-50/40">
                    <HelpCircle className="h-10 w-10 text-gray-300 mx-auto stroke-1" />
                    <h3 className="text-sm font-semibold text-gray-700 mt-3">No questions active inside this bank</h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">Trigger the AI generation suite template above to build immediate exam options.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((question, idx) => {
                      const isMine = question.created_by_teacher_id === teacherId;
                      const isEditing = editingQuestionId === question.id;

                      return (
                        <div key={question.id} className="border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-gray-200 transition-all bg-white relative group">
                          
                          {/* Metadata Ribbon */}
                          <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
                            <span className="font-mono font-bold text-gray-300 mr-1">#{idx + 1}</span>
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700 uppercase font-semibold text-[10px] tracking-wider px-2 py-0.5">{question.question_type}</Badge>
                            <Badge variant="outline" className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 ${
                              question.difficulty === 'hard' ? 'border-red-200 text-red-700 bg-red-50/30' :
                              question.difficulty === 'medium' ? 'border-amber-200 text-amber-700 bg-amber-50/30' :
                              'border-emerald-200 text-emerald-700 bg-emerald-50/30'
                            }`}>{question.difficulty}</Badge>
                            <Badge variant="secondary" className="bg-blue-50/50 text-blue-700 border border-blue-100/40 font-normal px-2 py-0.5">{question.topic}</Badge>
                            <div className="ml-auto flex items-center gap-1.5 text-gray-400 text-xs">
                              {question.visibility === 'public_school' ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                              <span className="text-[11px] font-medium hidden sm:inline">{question.visibility === 'public_school' ? 'Shared View' : 'Private Scope'}</span>
                            </div>
                          </div>

                          {/* Dynamic Body State Rendering */}
                          {isEditing ? (
                            <div className="space-y-3 bg-gray-50/50 p-4 rounded-xl border border-gray-200/60 mt-2">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Topic Identifier</Label>
                                  <Input value={editingDraft.topic || ''} onChange={(e) => setEditingDraft(p => ({ ...p, topic: e.target.value }))} className="h-8 bg-white" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Taxonomy Rank</Label>
                                  <select className="w-full border rounded-md px-2 h-8 text-xs bg-white" value={editingDraft.difficulty} onChange={(e) => setEditingDraft(p => ({ ...p, difficulty: e.target.value as any }))}>
                                    {DIFFICULTIES.map((l) => <option key={l} value={l}>{l}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-500">Core Content Question Formula</Label>
                                <Textarea rows={3} value={editingDraft.question_text || ''} onChange={(e) => setEditingDraft(p => ({ ...p, question_text: e.target.value }))} className="bg-white" />
                              </div>
                              
                              {question.question_type === 'objective' && (
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Multiple Choice Matrix (one option per line)</Label>
                                  <Textarea rows={4} value={(editingDraft.options || []).join('\n')} onChange={(e) => setEditingDraft(p => ({ ...p, options: parseTopicsFromText(e.target.value) }))} placeholder="Option A&#10;Option B" className="bg-white" />
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Target Correct Assertion Vector</Label>
                                  <Input value={editingDraft.correct_answer || ''} onChange={(e) => setEditingDraft(p => ({ ...p, correct_answer: e.target.value }))} className="h-8 bg-white" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-500">Visibility Target</Label>
                                  <select className="w-full border rounded-md px-2 h-8 text-xs bg-white" value={editingDraft.visibility} onChange={(e) => setEditingDraft(p => ({ ...p, visibility: e.target.value as any }))}>
                                    <option value="private">Private</option>
                                    <option value="public_school">Public School Sharing</option>
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs text-gray-500">Marking Scheme / Rationale Explanations</Label>
                                <Textarea rows={2} value={editingDraft.explanation || ''} onChange={(e) => setEditingDraft(p => ({ ...p, explanation: e.target.value }))} className="bg-white" />
                              </div>

                              <div className="flex gap-2 justify-end pt-2">
                                <Button size="sm" variant="outline" onClick={cancelEditQuestion} className="h-8 text-xs">Cancel</Button>
                                <Button size="sm" onClick={() => void saveQuestionEdit(question.id)} className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
                                  <Save className="h-3.5 w-3.5 mr-1" /> Commit Changes
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-gray-900 font-medium text-base leading-relaxed mt-1">{question.question_text}</p>
                              
                              {question.question_type === 'objective' && Array.isArray(question.options) && question.options.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 my-4">
                                  {question.options.map((option, index) => {
                                    const isCorrect = question.correct_answer?.trim().toLowerCase() === option.trim().toLowerCase();
                                    return (
                                      <div key={index} className={`p-3 rounded-lg text-sm border transition-all ${
                                        isCorrect 
                                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium' 
                                          : 'bg-gray-50/50 border-gray-100 text-gray-600'
                                      }`}>
                                        <span className="text-xs font-bold mr-2 uppercase tracking-wider opacity-40">{String.fromCharCode(65 + index)}.</span>
                                        {option}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Non-Objective (Theory) Answer View Block */}
                              {question.question_type !== 'objective' && question.correct_answer && (
                                <div className="mt-3 p-3 bg-emerald-50/40 rounded-lg border border-emerald-100/60 text-sm">
                                  <span className="font-semibold text-emerald-800 text-xs uppercase tracking-wider block mb-0.5">Target Evaluation Matrix Benchmark:</span>
                                  <p className="text-emerald-900">{question.correct_answer}</p>
                                </div>
                              )}

                              {question.explanation && (
                                <p className="text-xs text-gray-500 mt-3 bg-gray-50 p-3 rounded-lg border border-gray-100/80">
                                  <span className="font-semibold text-gray-700 block mb-0.5">Pedagogical Justification:</span>
                                  {question.explanation}
                                </p>
                              )}

                              {/* Card Action Rails */}
                              <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-gray-50 opacity-90 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                {isMine ? (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => startEditQuestion(question)} className="h-8 text-xs text-gray-600 hover:bg-gray-50">
                                      <Pencil className="h-3.5 w-3.5 mr-1" /> Modify
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => void deleteQuestion(question.id)} className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700">
                                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Purge
                                    </Button>
                                  </>
                                ) : (
                                  <Button variant="outline" size="sm" onClick={() => void duplicateQuestion(question.id)} className="h-8 text-xs text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Copy className="h-3.5 w-3.5 mr-1" /> Clone into personal space
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
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