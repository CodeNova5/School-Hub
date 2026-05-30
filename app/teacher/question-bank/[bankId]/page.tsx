"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolContext } from '@/hooks/use-school-context';
import { ArrowLeft, BookOpen, Globe2, Layers, Lock, Save, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
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

type TopicGroupRecord = {
  id: string;
  title: string;
  topics: string[];
  created_by_teacher_id: string;
  created_at: string;
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
  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);
  const [topicGroupsLoading, setTopicGroupsLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [groupTopicsInput, setGroupTopicsInput] = useState(''); // comma separated
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
  const [selectedGenerateTopics, setSelectedGenerateTopics] = useState<string[]>([]);
  const [manualTopicInput, setManualTopicInput] = useState('');
  const [generateStep, setGenerateStep] = useState(1);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
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
    return topicValues.length > 0 ? topicValues.slice(0, 8) : [selectedSubjectClassLabel];
  }, [questions, selectedSubjectClassLabel]);

  const effectiveGenerateTopics = useMemo(() => {
    const combined = [...selectedGenerateTopics];
    const seen = new Set<string>();
    return combined.filter((topic) => {
      const normalized = topic.trim().toLowerCase();
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }, [selectedGenerateTopics]);

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
      const [contextResponse, bankResponse, questionsResponse, groupsResponse] = await Promise.all([
        fetch('/api/teacher/question-bank/context', { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}`, { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}/questions`, { cache: 'no-store' }),
        fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
      ]);

      const contextPayload = (await contextResponse.json()) as ContextPayload | { error: string };
      const bankPayload = (await bankResponse.json()) as BankPayload | { error: string };
      const questionsPayload = (await questionsResponse.json()) as QuestionsPayload | { error: string };
      const groupsPayload = (await groupsResponse.json()) as { groups?: TopicGroupRecord[] } | { error: string };

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
        setQuestionsError('error' in questionsPayload ? questionsPayload.error : 'Failed to load questions');
      } else {
        setQuestions(questionsPayload.questions || []);
      }

      if (!groupsResponse.ok || 'error' in groupsPayload) {
        // non-fatal: just show none
        setTopicGroups([]);
      } else {
        setTopicGroups(groupsPayload.groups || []);
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

    const parsedCount = Number(generateCount);
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      toast.error('Enter a valid number of questions between 1 and 30');
      return;
    }

    const count = Math.min(Math.max(Math.floor(parsedCount), 1), 30);
    const topics = effectiveGenerateTopics.length > 0 ? effectiveGenerateTopics : [selectedSubjectClassLabel];

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
      setGenerateStep(1);
      setIsGenerateModalOpen(false);
      toast.success(`Generated ${generatedQuestions.length} question${generatedQuestions.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleOpenGenerateModal() {
    setGenerateStep(1);
    const initialTopics = generatedTopicHints.length > 0 ? generatedTopicHints : [selectedSubjectClassLabel];
    setSelectedGenerateTopics(initialTopics);
    setManualTopicInput('');
    setIsGenerateModalOpen(true);
  }

  function handleCloseGenerateModal() {
    if (!isGenerating) {
      setGenerateStep(1);
      setManualTopicInput('');
      setIsGenerateModalOpen(false);
    }
  }

  function toggleGenerateTopic(topic: string) {
    const value = topic.trim();
    if (!value) return;

    setSelectedGenerateTopics((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === value.toLowerCase());
      if (exists) return prev.filter((item) => item.toLowerCase() !== value.toLowerCase());
      return [...prev, value];
    });
  }

  /****************************************************************************
   * Content / Actions Array Helpers
   ****************************************************************************/
  function addManualTopic() {
    const value = manualTopicInput.trim();
    if (!value) return;

    setSelectedGenerateTopics((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === value.toLowerCase());
      if (exists) return prev;
      return [...prev, value];
    });
    setManualTopicInput('');
  }

  function removeGenerateTopic(topic: string) {
    setSelectedGenerateTopics((prev) => prev.filter((item) => item.toLowerCase() !== topic.toLowerCase()));
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

  /****************************************************************************
   * Topic Groups Management
   ****************************************************************************/
  function startEditGroup(group: TopicGroupRecord) {
    setEditingGroupId(group.id);
    setGroupTitleInput(group.title || '');
    setGroupTopicsInput((group.topics || []).join(', '));
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setGroupTitleInput('');
    setGroupTopicsInput('');
  }

  async function handleSaveTopicGroup() {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }

    const title = groupTitleInput.trim();
    const topics = groupTopicsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (!title) {
      toast.error('Provide a title for the topic group');
      return;
    }

    try {
      const method = editingGroupId ? 'PATCH' : 'POST';
      const url = editingGroupId
        ? `/api/teacher/question-bank/banks/${bankId}/topic-groups/${editingGroupId}`
        : `/api/teacher/question-bank/banks/${bankId}/topic-groups`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, topics }),
      });

      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error || 'Failed to save topic group');
        return;
      }

      const savedGroup = payload.group as TopicGroupRecord;
      if (editingGroupId) {
        setTopicGroups((prev) => prev.map((g) => (g.id === savedGroup.id ? savedGroup : g)));
        toast.success('Topic group updated');
      } else {
        setTopicGroups((prev) => [savedGroup, ...prev]);
        toast.success('Topic group created');
      }

      cancelEditGroup();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save topic group');
    }
  }

  async function handleDeleteTopicGroup(id: string) {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }

    if (!confirm('Delete this topic group? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const payload = await res.json();
        toast.error(payload?.error || 'Failed to delete topic group');
        return;
      }
      setTopicGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success('Topic group deleted');
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete topic group');
    }
  }

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-2">
            <div className="mx-auto h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-xs text-gray-500">Loading bank...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!bank) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <Card className="w-full max-w-md border-slate-200 shadow-sm text-center p-6 space-y-4">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <div className="space-y-1">
              <h1 className="text-lg font-medium text-slate-900">Question bank not found</h1>
              <p className="text-sm text-slate-500">This bank may have been removed or you may lack access permissions.</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/teacher/question-bank')}>Back to overview</Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const canGenerateQuestions = isEditable && !!bank && !!subjectClassId;
  const generateStepLabels = [
    { step: 1, title: 'Amount' },
    { step: 2, title: 'Topics' },
    { step: 3, title: 'Difficulty' },
    { step: 4, title: 'Type' },
    { step: 5, title: 'Review' },
  ];

  return (
    <DashboardLayout role="teacher">
      <div className="max-w-7xl mx-auto space-y-8 pb-16">
        {/* Simplified Header / Hero Section with Integrated AI Trigger */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-white shadow-sm space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <Button
                variant="link"
                className="h-auto p-0 text-xs text-slate-400 hover:text-white gap-1"
                onClick={() => router.push('/teacher/question-bank')}
              >
                <ArrowLeft className="h-3 w-3" /> Back to overview
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">{bank.title}</h1>
              {bank.description && <p className="text-sm text-slate-400 max-w-xl">{bank.description}</p>}
            </div>
            <div className="flex flex-wrap gap-2 sm:self-start">
              <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-800 gap-1">
                {visibility === 'public_school' ? <Globe2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                {visibility === 'public_school' ? 'Shared' : 'Private'}
              </Badge>
              <Badge variant="outline" className="bg-slate-900 text-white border-slate-800">
                {questionCount} question{questionCount === 1 ? '' : 's'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                Need more questions?
              </div>
              <p className="text-xs text-slate-400">Expand this bank instantly using targeted AI generation filters.</p>
            </div>
            <Button
              onClick={handleOpenGenerateModal}
              disabled={!canGenerateQuestions}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-sm w-full sm:w-auto"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate with AI
            </Button>
          </div>
        </section>

        {/* Primary Questions Block */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Questions catalog</CardTitle>
                <CardDescription className="text-xs">Manage current compiled problems inside this bank index.</CardDescription>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="pl-9 text-xs h-9"
                  placeholder="Search topic or text..."
                />
              </div>
              <select
                value={questionDifficultyFilter}
                onChange={(e) => setQuestionDifficultyFilter(e.target.value as any)}
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                value={questionTypeFilter}
                onChange={(e) => setQuestionTypeFilter(e.target.value as any)}
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">All types</option>
                <option value="objective">Objective</option>
                <option value="theory">Theory</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {questionsError && <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg mb-4">{questionsError}</div>}

            {filteredQuestions.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <BookOpen className="mx-auto h-6 w-6 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No matching questions found</p>
                <p className="text-xs text-slate-400">Clear your filter configurations or initiate the AI helper above.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 space-y-6">
                {filteredQuestions.map((question, index) => (
                  <div key={question.id} className={`space-y-3 ${index > 0 ? 'pt-6' : ''}`}>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-xs font-semibold text-slate-400 mr-1">#{index + 1}</span>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-2 py-0.5">
                        {question.topic}
                      </Badge>
                      <Badge variant="outline" className={`${getDifficultyStyles(question.difficulty)} text-[10px] px-2 py-0.5`}>
                        {question.difficulty}
                      </Badge>
                      <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-[10px] px-2 py-0.5">
                        {question.question_type === 'objective' ? 'Objective' : 'Theory'}
                      </Badge>
                    </div>

                    <p className="text-sm font-medium text-slate-900 leading-relaxed">{question.question_text}</p>

                    {question.question_type === 'objective' && question.options.length > 0 && (
                      <div className="grid gap-1.5 sm:grid-cols-2 ml-4">
                        {question.options.map((option, idx) => (
                          <div key={idx} className="text-xs text-slate-600 border border-slate-100 bg-slate-50/50 px-3 py-1.5 rounded-lg">
                            <span className="font-medium text-slate-400 mr-1">{String.fromCharCode(65 + idx)}.</span> {option}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-slate-50/60 p-3 rounded-lg text-xs space-y-1.5 border border-slate-100">
                      <div><span className="text-slate-400 font-medium">Correct Answer:</span> <span className="text-slate-800">{question.correct_answer || 'None'}</span></div>
                      {question.explanation && <div><span className="text-slate-400 font-medium">Explanation:</span> <span className="text-slate-700">{question.explanation}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Topic Groups Management */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Topic groups</CardTitle>
                <CardDescription className="text-xs">Create and manage reusable topic groups for this bank</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-4">
            {!isEditable && <div className="p-2.5 text-xs text-amber-800 bg-amber-50 border border-amber-200/60 rounded-md">🔒 View-only topic groups</div>}

            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs">Group title</Label>
                  <Input value={groupTitleInput} onChange={(e) => setGroupTitleInput(e.target.value)} disabled={!isEditable} className="h-9 text-sm" placeholder="e.g. Algebra topics" />
                </div>

                <div>
                  <Label className="text-xs">Topics (comma separated)</Label>
                  <Input value={groupTopicsInput} onChange={(e) => setGroupTopicsInput(e.target.value)} disabled={!isEditable} className="h-9 text-sm" placeholder="fractions, equations, graphs" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                {editingGroupId ? (
                  <>
                    <Button size="sm" variant="outline" onClick={cancelEditGroup} disabled={!isEditable}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveTopicGroup} disabled={!isEditable}>Save group</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={handleSaveTopicGroup} disabled={!isEditable}>Create group</Button>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                {topicGroups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">No topic groups defined for this bank yet.</div>
                ) : (
                  <div className="space-y-3">
                    {topicGroups.map((group) => (
                      <div key={group.id} className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-100 bg-white">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-slate-500" />
                            <div className="font-semibold text-sm text-slate-800">{group.title}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {group.topics.map((t, idx) => (
                              <Badge key={idx} variant="outline" className="text-[11px] px-2 py-0.5">{t}</Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEditGroup(group)} disabled={!isEditable}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteTopicGroup(group.id)} disabled={!isEditable}><X className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Core Profile Parameters / Settings Block */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-base font-medium">Bank properties configuration</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {!isEditable && <div className="p-2.5 text-xs text-amber-800 bg-amber-50 border border-amber-200/60 rounded-md">🔒 View-only schema entry</div>}
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="bank-title" className="text-xs">Bank title</Label>
                <Input id="bank-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isEditable} placeholder="e.g. Mathematics" className="h-9 text-sm" />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label htmlFor="bank-description" className="text-xs">Description</Label>
                <Textarea id="bank-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isEditable} placeholder="Enter description details..." rows={2} className="text-sm resize-none" />
              </div>

              <div className="space-y-1">
                <Label htmlFor="subject-class" className="text-xs">Subject affiliation</Label>
                <select id="subject-class" value={subjectClassId} onChange={(e) => setSubjectClassId(e.target.value)} disabled={!isEditable} className="h-9 w-full rounded-md border border-input bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-slate-50" >
                  <option value="">Select configuration match</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>{subjectClassLabelMap.get(item.id)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="visibility-select" className="text-xs">Visibility control</Label>
                <select id="visibility-select" value={visibility} onChange={(e) => setVisibility(e.target.value as any)} disabled={!isEditable} className="h-9 w-full rounded-md border border-input bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-slate-50" >
                  <option value="private">Private (Only Me)</option>
                  <option value="public_school">Shared with School Network</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-100 justify-end">
              <Button size="sm" onClick={handleSave} disabled={!isEditable || isSaving}>
                <Save className="h-3.5 w-3.5 mr-1" /> {isSaving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation Wizard Modal */}
      <Dialog open={isGenerateModalOpen} onOpenChange={handleCloseGenerateModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-x-hidden w-full mx-4 md:mx-0">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 flex-shrink-0">
            <div>
              <DialogTitle className="text-lg font-semibold">Generate with AI</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">Configure your question generation parameters</DialogDescription>
            </div>
            <button onClick={handleCloseGenerateModal} disabled={isGenerating} className="rounded-md p-1 hover:bg-slate-100 transition-colors"><X className="h-4 w-4 text-slate-500" /></button>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-y-auto flex-grow pb-6">
            <div className="flex flex-wrap gap-2 bg-gradient-to-r from-slate-50 to-slate-100 p-3 rounded-lg border border-slate-200 flex-shrink-0">
              {generateStepLabels.map((item) => (
                <div
                  key={item.step}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${generateStep === item.step ? 'bg-violet-600 text-white shadow-md' : generateStep > item.step ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-white text-slate-500 border border-slate-200'}`}
                >
                  {item.step}. {item.title}
                </div>
              ))}
            </div>

            <div className="min-h-[200px] space-y-4">
              {generateStep === 1 && (
                <div className="space-y-3 animate-fade-in">
                  <Label className="text-sm font-semibold text-slate-900">How many questions would you like to generate?</Label>
                  <div className="space-y-2">
                    <Input type="number" min={1} max={30} value={generateCount} onChange={(e) => setGenerateCount(e.target.value)} disabled={isGenerating} className="h-10 text-sm" placeholder="Enter number (1-30)" />
                    <p className="text-xs text-slate-500">Generate between 1 and 30 questions at a time.</p>
                  </div>
                </div>
              )}

              {generateStep === 2 && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <Label className="text-sm font-semibold text-slate-900">Select Topics for Generation</Label>
                    <p className="text-xs text-slate-500 mt-1">Choose topics from your existing questions or add custom ones</p>
                  </div>
                  <div className="flex flex-wrap gap-2 border-2 border-slate-200 p-4 rounded-lg bg-slate-50/30 min-h-32">
                    {generatedTopicHints.length > 0 ? (
                      generatedTopicHints.map((topic) => {
                        const selected = selectedGenerateTopics.some((item) => item.toLowerCase() === topic.toLowerCase());
                        return (
                          <button key={topic} type="button" onClick={() => toggleGenerateTopic(topic)} className={`text-sm px-3 py-2 border rounded-lg font-medium transition-all ${selected ? 'bg-violet-600 text-white border-violet-600 shadow-md' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}>
                            {topic}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-slate-500 w-full text-center py-6">No topics found. Add a custom topic below.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input value={manualTopicInput} onChange={(e) => setManualTopicInput(e.target.value)} placeholder="Type a custom topic..." className="h-10 text-sm" />
                    <Button size="sm" type="button" variant="outline" onClick={addManualTopic} className="h-10 text-sm px-4">Add</Button>
                  </div>
                </div>
              )}

              {generateStep === 3 && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <Label className="text-sm font-semibold text-slate-900">Select Difficulty Level</Label>
                    <p className="text-xs text-slate-500 mt-1">Choose the complexity level for generated questions</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(['easy', 'medium', 'hard'] as const).map((level) => {
                      const icons = { easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' };
                      return (
                        <button key={level} type="button" onClick={() => setGenerateDifficulty(level)} className={`py-3 text-sm font-semibold border-2 rounded-lg capitalize transition-all ${generateDifficulty === level ? (level === 'easy' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : level === 'medium' ? 'bg-amber-50 border-amber-500 text-amber-700' : 'bg-rose-50 border-rose-500 text-rose-700') : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                          <div className="text-lg mb-1">{icons[level as keyof typeof icons]}</div>
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {generateStep === 4 && (
                <div className="space-y-3 animate-fade-in">
                  <div>
                    <Label className="text-sm font-semibold text-slate-900">Choose Question Format</Label>
                    <p className="text-xs text-slate-500 mt-1">Select the type of questions to generate</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['objective', 'theory'] as const).map((type) => (
                      <button key={type} type="button" onClick={() => setGenerateQuestionType(type)} className={`py-3 text-sm font-semibold border-2 rounded-lg transition-all ${generateQuestionType === type ? 'bg-violet-50 border-violet-500 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <div className="text-lg mb-1">{type === 'objective' ? '🎯' : '✍️'}</div>
                        {type === 'objective' ? 'Multiple Choice' : 'Written Theory'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {generateStep === 5 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="bg-gradient-to-br from-violet-50 to-violet-100/50 p-5 rounded-lg border-2 border-violet-200">
                    <div className="font-semibold text-slate-900 pb-4 flex items-center gap-2">
                      <span className="text-lg">✓</span>
                      Review Your Settings
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between bg-white/60 px-3 py-2.5 rounded-md">
                        <span className="text-slate-600">Questions to Generate:</span>
                        <span className="font-semibold text-violet-700 text-base">{generateCount}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 px-3 py-2.5 rounded-md">
                        <span className="text-slate-600">Difficulty Level:</span>
                        <span className="font-semibold text-violet-700 capitalize">{generateDifficulty === 'easy' ? '⭐ Easy' : generateDifficulty === 'medium' ? '⭐⭐ Medium' : '⭐⭐⭐ Hard'}</span>
                      </div>
                      <div className="flex items-center justify-between bg-white/60 px-3 py-2.5 rounded-md">
                        <span className="text-slate-600">Question Type:</span>
                        <span className="font-semibold text-violet-700">{generateQuestionType === 'objective' ? '🎯 Multiple Choice' : '✍️ Written Theory'}</span>
                      </div>
                      <div className="bg-white/60 px-3 py-3 rounded-md">
                        <span className="text-slate-600 block mb-2">Topics:</span>
                        <div className="flex flex-wrap gap-2">
                          {effectiveGenerateTopics.map((topic, idx) => (
                            <span key={idx} className="bg-violet-200 text-violet-900 px-2 py-1 rounded text-xs font-medium break-words max-w-full">{topic}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-md">💡 Click "Compile Execution" to generate your questions with AI</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 border-t border-slate-200 pt-4 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => setGenerateStep((prev) => Math.max(prev - 1, 1))} disabled={isGenerating || generateStep === 1} className="flex-1 h-10">
              ← Back
            </Button>
            {generateStep < 5 ? (
              <Button size="sm" onClick={() => setGenerateStep((prev) => Math.min(prev + 1, 5))} disabled={isGenerating || (generateStep === 2 && effectiveGenerateTopics.length === 0)} className="flex-1 h-10 bg-violet-600 hover:bg-violet-700 text-white font-medium">
                Next →
              </Button>
            ) : (
              <Button size="sm" onClick={handleGenerateQuestions} disabled={isGenerating} className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Questions'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}