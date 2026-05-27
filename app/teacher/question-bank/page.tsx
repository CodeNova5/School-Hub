"use client";

import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Sparkles, Plus, Copy, Pencil, Trash2, Save, X } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingTopicSet, setIsSavingTopicSet] = useState(false);
  const [isCreatingBank, setIsCreatingBank] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [teacherId, setTeacherId] = useState('');

  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [topicSets, setTopicSets] = useState<TopicSet[]>([]);
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  const [bankTitle, setBankTitle] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [bankSubjectClassId, setBankSubjectClassId] = useState('');
  const [bankVisibility, setBankVisibility] = useState<'private' | 'public_school'>('private');

  const [topicSetName, setTopicSetName] = useState('');
  const [topicSetSubjectClassId, setTopicSetSubjectClassId] = useState('');
  const [manualTopicsText, setManualTopicsText] = useState('');

  const [generateSubjectClassId, setGenerateSubjectClassId] = useState('');
  const [generateBankId, setGenerateBankId] = useState('');
  const [generateTopicSetId, setGenerateTopicSetId] = useState('');
  const [generateTopicsText, setGenerateTopicsText] = useState('');
  const [generateDifficulty, setGenerateDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [generateQuestionType, setGenerateQuestionType] = useState<'objective' | 'theory'>('objective');
  const [generateCount, setGenerateCount] = useState(5);
  const [generateVisibility, setGenerateVisibility] = useState<'private' | 'public_school'>('private');

  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [editingDraft, setEditingDraft] = useState<Partial<QuestionItem>>({});

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
        setBankSubjectClassId((prev) => prev || fallbackSubjectClass);
        setTopicSetSubjectClassId((prev) => prev || fallbackSubjectClass);
        setGenerateSubjectClassId((prev) => prev || fallbackSubjectClass);
      }

      if (payload.banks?.length > 0) {
        setSelectedBankId((prev) => prev || payload.banks[0].id);
        setGenerateBankId((prev) => prev || payload.banks[0].id);
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
    if (!item) {
      return 'Unknown subject/class';
    }
    return `${item.subjects?.name || 'Subject'} - ${item.classes?.name || 'Class'}`;
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
      setGenerateBankId(createdBank.id);
      setBankTitle('');
      setBankDescription('');
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
      toast.success('AI topics generated');
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

    if (!generateBankId || !generateSubjectClassId) {
      toast.error('Select a bank and subject/class first');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/teacher/question-bank/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId: generateBankId,
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

      toast.success(`Generated ${payload.generatedCount || 0} question(s)`);
      setSelectedBankId(generateBankId);
      await loadBankQuestions(generateBankId);
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
      toast.success('Question duplicated to your bank');
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
        <div className="h-96 flex items-center justify-center text-gray-500">Loading question bank...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">AI Question Bank</h1>
          <p className="text-gray-600 mt-1">Generate, save, share, and customize class-ready questions.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create Question Bank</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Bank Title</Label>
                <Input value={bankTitle} onChange={(e) => setBankTitle(e.target.value)} placeholder="e.g. JSS2 Mathematics Weekly Bank" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={bankDescription} onChange={(e) => setBankDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1">
                <Label>Subject/Class</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={bankSubjectClassId}
                  onChange={(e) => setBankSubjectClassId(e.target.value)}
                >
                  <option value="">Select subject/class</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getSubjectClassLabel(item.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Visibility</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={bankVisibility}
                  onChange={(e) => setBankVisibility(e.target.value as 'private' | 'public_school')}
                >
                  <option value="private">Private</option>
                  <option value="public_school">Share with school</option>
                </select>
              </div>
              <Button onClick={handleCreateBank} disabled={isCreatingBank} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {isCreatingBank ? 'Creating...' : 'Create Bank'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topic Lists (Reusable)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Topic Set Name</Label>
                <Input value={topicSetName} onChange={(e) => setTopicSetName(e.target.value)} placeholder="e.g. First Term Core Topics" />
              </div>
              <div className="space-y-1">
                <Label>Subject/Class</Label>
                <select
                  className="w-full border rounded-md px-3 py-2"
                  value={topicSetSubjectClassId}
                  onChange={(e) => setTopicSetSubjectClassId(e.target.value)}
                >
                  <option value="">Select subject/class</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getSubjectClassLabel(item.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label>Topics (one per line or comma-separated)</Label>
                  <Button variant="outline" size="sm" onClick={handleGenerateTopics}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Suggest
                  </Button>
                </div>
                <Textarea rows={6} value={manualTopicsText} onChange={(e) => setManualTopicsText(e.target.value)} />
              </div>
              <Button onClick={handleSaveTopicSet} disabled={isSavingTopicSet} className="w-full">
                {isSavingTopicSet ? 'Saving...' : 'Save Topic Set'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate Questions with AI</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label>Target Bank</Label>
              <select className="w-full border rounded-md px-3 py-2" value={generateBankId} onChange={(e) => setGenerateBankId(e.target.value)}>
                <option value="">Select bank</option>
                {myBanks.map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Subject/Class</Label>
              <select className="w-full border rounded-md px-3 py-2" value={generateSubjectClassId} onChange={(e) => setGenerateSubjectClassId(e.target.value)}>
                <option value="">Select subject/class</option>
                {subjectClasses.map((item) => (
                  <option key={item.id} value={item.id}>{getSubjectClassLabel(item.id)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Topic Set (optional)</Label>
              <select className="w-full border rounded-md px-3 py-2" value={generateTopicSetId} onChange={(e) => setGenerateTopicSetId(e.target.value)}>
                <option value="">Use manual topics below</option>
                {selectedSubjectClassTopics.map((set) => (
                  <option key={set.id} value={set.id}>{set.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Difficulty</Label>
              <select className="w-full border rounded-md px-3 py-2" value={generateDifficulty} onChange={(e) => setGenerateDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}>
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Question Type</Label>
              <select className="w-full border rounded-md px-3 py-2" value={generateQuestionType} onChange={(e) => setGenerateQuestionType(e.target.value as 'objective' | 'theory')}>
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>How many?</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value || 1))}
              />
            </div>

            <div className="space-y-1 lg:col-span-3">
              <Label>Manual Topics (used when no topic set is selected)</Label>
              <Textarea
                rows={4}
                value={generateTopicsText}
                onChange={(e) => setGenerateTopicsText(e.target.value)}
                placeholder="Fractions, Algebraic expressions, Ratio..."
              />
            </div>

            <div className="space-y-1 lg:col-span-1">
              <Label>Generated Question Visibility</Label>
              <select className="w-full border rounded-md px-3 py-2" value={generateVisibility} onChange={(e) => setGenerateVisibility(e.target.value as 'private' | 'public_school')}>
                <option value="private">Private</option>
                <option value="public_school">Share with school</option>
              </select>
            </div>

            <div className="lg:col-span-2 flex items-end">
              <Button onClick={handleGenerateQuestions} disabled={isGenerating} className="w-full md:w-auto">
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate and Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Question Banks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {banks.length === 0 ? (
              <p className="text-sm text-gray-500">No banks yet. Create one to start generating questions.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {banks.map((bank) => {
                  const isMine = bank.created_by_teacher_id === teacherId;
                  return (
                    <button
                      type="button"
                      key={bank.id}
                      onClick={() => setSelectedBankId(bank.id)}
                      className={`text-left border rounded-lg p-4 transition ${selectedBankId === bank.id ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-sm">{bank.title}</h3>
                        <Badge variant={bank.visibility === 'public_school' ? 'default' : 'secondary'}>
                          {bank.visibility === 'public_school' ? 'Shared' : 'Private'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">{getSubjectClassLabel(bank.subject_class_id)}</p>
                      <p className="text-xs text-gray-500">{isMine ? 'Owned by you' : 'Shared by another teacher'}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Questions {selectedBank ? `- ${selectedBank.title}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingQuestions ? (
              <p className="text-gray-500">Loading questions...</p>
            ) : questions.length === 0 ? (
              <p className="text-sm text-gray-500">No questions in this bank yet.</p>
            ) : (
              questions.map((question) => {
                const isMine = question.created_by_teacher_id === teacherId;
                const isEditing = editingQuestionId === question.id;

                return (
                  <div key={question.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{question.question_type}</Badge>
                      <Badge variant="outline">{question.difficulty}</Badge>
                      <Badge variant={question.visibility === 'public_school' ? 'default' : 'secondary'}>
                        {question.visibility === 'public_school' ? 'Shared' : 'Private'}
                      </Badge>
                      <Badge variant="secondary">{question.topic}</Badge>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={editingDraft.topic || ''}
                          onChange={(e) => setEditingDraft((prev) => ({ ...prev, topic: e.target.value }))}
                          placeholder="Topic"
                        />
                        <Textarea
                          rows={3}
                          value={editingDraft.question_text || ''}
                          onChange={(e) => setEditingDraft((prev) => ({ ...prev, question_text: e.target.value }))}
                        />
                        {question.question_type === 'objective' && (
                          <Textarea
                            rows={4}
                            value={(editingDraft.options || []).join('\n')}
                            onChange={(e) => setEditingDraft((prev) => ({ ...prev, options: parseTopicsFromText(e.target.value) }))}
                            placeholder="One option per line"
                          />
                        )}
                        <Input
                          value={editingDraft.correct_answer || ''}
                          onChange={(e) => setEditingDraft((prev) => ({ ...prev, correct_answer: e.target.value }))}
                          placeholder="Correct answer"
                        />
                        <Textarea
                          rows={2}
                          value={editingDraft.explanation || ''}
                          onChange={(e) => setEditingDraft((prev) => ({ ...prev, explanation: e.target.value }))}
                          placeholder="Explanation or marking guide"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void saveQuestionEdit(question.id)}>
                            <Save className="h-4 w-4 mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditQuestion}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium">{question.question_text}</p>
                        {question.question_type === 'objective' && Array.isArray(question.options) && question.options.length > 0 && (
                          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                            {question.options.map((option, index) => (
                              <li key={`${question.id}-opt-${index}`}>{option}</li>
                            ))}
                          </ul>
                        )}
                        {question.correct_answer && (
                          <p className="text-sm"><span className="font-semibold">Answer:</span> {question.correct_answer}</p>
                        )}
                        {question.explanation && (
                          <p className="text-sm text-gray-600"><span className="font-semibold">Explanation:</span> {question.explanation}</p>
                        )}
                        <Separator />
                        <div className="flex flex-wrap gap-2">
                          {isMine ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => startEditQuestion(question)}>
                                <Pencil className="h-4 w-4 mr-1" /> Edit
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => void deleteQuestion(question.id)}>
                                <Trash2 className="h-4 w-4 mr-1" /> Delete
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => void duplicateQuestion(question.id)}>
                              <Copy className="h-4 w-4 mr-1" /> Bring to my space
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
