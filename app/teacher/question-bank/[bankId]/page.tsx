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
import { ArrowLeft, BookOpen, FolderKanban, Globe2, Lock, Save, Search, Settings2, Sparkles, X, AlertCircle, CheckCircle, PencilLine, Trash2, Plus } from 'lucide-react';
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
  term?: '1' | '2' | '3';
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

function inferTopicGroupTerm(group: TopicGroupRecord) {
  if (group.term) return group.term;

  const label = group.title.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';

  return undefined;
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
  const [groupTopicsInput, setGroupTopicsInput] = useState('');
  const [isQuestionGroupsModalOpen, setIsQuestionGroupsModalOpen] = useState(false);
  const [isBankSettingsModalOpen, setIsBankSettingsModalOpen] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [questionsError, setQuestionsError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectClassId, setSubjectClassId] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public_school'>('private');
  
  // Filters
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'all' | '1' | '2' | '3'>('all');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'objective' | 'theory'>('all');
  
  // Generator State
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

  const termTopics = useMemo(() => {
    if (selectedTerm === 'all') return [];
    return topicGroups
      .filter((g) => inferTopicGroupTerm(g) === selectedTerm)
      .flatMap((g) => g.topics)
      .map((t) => t.trim().toLowerCase());
  }, [topicGroups, selectedTerm]);

  const groupTopicPreview = useMemo(() => {
    return groupTopicsInput
      .split(',')
      .map((topic) => topic.trim())
      .filter(Boolean);
  }, [groupTopicsInput]);

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
      const matchesTerm = 
        selectedTerm === 'all' || termTopics.includes(question.topic.trim().toLowerCase());
        
      return matchesSearch && matchesDifficulty && matchesType && matchesTerm;
    });
  }, [questionDifficultyFilter, questionSearch, questionTypeFilter, selectedTerm, termTopics, questions]);

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
    setManualTopicInput('');
    
    // Auto-load topics if a specific term is selected
    if (selectedTerm !== 'all') {
      const termSpecificTopics = topicGroups
        .filter((g) => inferTopicGroupTerm(g) === selectedTerm)
        .flatMap((g) => g.topics);
      setSelectedGenerateTopics(Array.from(new Set(termSpecificTopics)));
    } else {
      setSelectedGenerateTopics([]);
    }
    
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

  function applyTopicGroup(group: TopicGroupRecord) {
    const nextTopics = (group.topics || []).map((topic) => topic.trim()).filter(Boolean);
    if (nextTopics.length === 0) {
      toast.error('This group does not have any topics yet');
      return;
    }

    setSelectedGenerateTopics(nextTopics);
    toast.success(`Loaded ${group.title}`);
  }

  function getDifficultyStyles(difficulty: QuestionRecord['difficulty']) {
    switch (difficulty) {
      case 'easy':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'hard':
        return 'bg-red-50 text-red-700 border-red-200';
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

    if (topics.length === 0) {
      toast.error('Add at least one topic to the group');
      return;
    }

    setTopicGroupsLoading(true);
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
    } finally {
      setTopicGroupsLoading(false);
    }
  }

  async function handleDeleteTopicGroup(id: string) {
    if (!isEditable) {
      toast.error('You can only manage topic groups for banks you created');
      return;
    }

    if (!confirm('Delete this topic group? This action cannot be undone.')) return;

    setTopicGroupsLoading(true);
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
    } finally {
      setTopicGroupsLoading(false);
    }
  }

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Loading your question bank...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!bank) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <Card className="w-full max-w-md border-gray-200 shadow-sm text-center p-8 space-y-4">
            <div className="flex justify-center">
              <BookOpen className="h-12 w-12 text-gray-300" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-gray-900">Question bank not found</h1>
              <p className="text-sm text-gray-500">This bank may have been removed or you may lack access permissions.</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/teacher/question-bank')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to overview
            </Button>
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
    { step: 4, title: 'Format' },
    { step: 5, title: 'Review' },
  ];

  const hasQuestionGroups = topicGroups.length > 0;

  return (
    <DashboardLayout role="teacher">
      <div className="w-full space-y-8 pb-16">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-gray-500 hover:text-gray-900"
              onClick={() => router.push('/teacher/question-bank')}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="space-y-2 flex-1">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900">{bank.title}</h1>
                {bank.description && (
                  <p className="text-gray-600 text-lg max-w-2xl">{bank.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="h-fit">
                  {visibility === 'public_school' ? (
                    <>
                      <Globe2 className="h-3 w-3 mr-1" />
                      Shared
                    </>
                  ) : (
                    <>
                      <Lock className="h-3 w-3 mr-1" />
                      Private
                    </>
                  )}
                </Badge>
                <Badge variant="outline" className="h-fit">
                  {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                </Badge>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          {isEditable && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                  <Sparkles className="h-4 w-4" />
                  Expand your question bank with AI
                </div>
                <p className="text-sm text-blue-700">Generate questions tailored to specific topics and difficulty levels</p>
              </div>
              <Button
                onClick={handleOpenGenerateModal}
                disabled={!canGenerateQuestions}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200"
                onClick={() => router.push(`/teacher/question-bank/${bankId}/groups`)}
              >
                <FolderKanban className="h-4 w-4 mr-2" />
                Manage Groups
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200"
                onClick={() => setIsBankSettingsModalOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Bank Settings
              </Button>
            </div>
          )}
        </div>


        {/* Main Content */}
        <div className="space-y-6">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 pb-4">
              <div className="space-y-4">
                <div>
                  <CardTitle>Questions Catalog</CardTitle>
                  <CardDescription>
                    {filteredQuestions.length} of {questions.length} question{questions.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>

                {/* Search and Filters */}
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="relative sm:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="pl-9 h-10 text-sm"
                      placeholder="Search questions..."
                    />
                  </div>
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value as any)}
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All Terms</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                  <select
                    value={questionDifficultyFilter}
                    onChange={(e) => setQuestionDifficultyFilter(e.target.value as any)}
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All difficulties</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                  <select
                    value={questionTypeFilter}
                    onChange={(e) => setQuestionTypeFilter(e.target.value as any)}
                    className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All types</option>
                    <option value="objective">Objective</option>
                    <option value="theory">Theory</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {questionsError && (
                <div className="flex gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  {questionsError}
                </div>
              )}

              {filteredQuestions.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <BookOpen className="mx-auto h-8 w-8 text-gray-300" />
                  <div>
                    <p className="text-base font-medium text-gray-700">No matching questions found</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {questions.length === 0 
                        ? "Get started by generating questions with AI above"
                        : "Try adjusting your filters"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredQuestions.map((question, index) => (
                    <div key={question.id} className="pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                      {/* Question Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="bg-gray-50 border-gray-200">
                            {question.topic}
                          </Badge>
                          <Badge variant="outline" className={`${getDifficultyStyles(question.difficulty)} border`}>
                            {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                            {question.question_type === 'objective' ? 'Multiple Choice' : 'Essay'}
                          </Badge>
                        </div>
                        <span className="text-xs font-semibold text-gray-400">#{index + 1}</span>
                      </div>

                      {/* Question Text */}
                      <p className="text-base text-gray-900 font-medium mb-4 leading-relaxed">
                        {question.question_text}
                      </p>

                      {/* Options for Objective Questions */}
                      {question.question_type === 'objective' && question.options.length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2 mb-4 pl-4">
                          {question.options.map((option, idx) => (
                            <div
                              key={idx}
                              className="text-sm text-gray-700 border border-gray-200 bg-white px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              <span className="font-semibold text-gray-400 mr-2">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              {option}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Answer and Explanation */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3 text-sm">
                        <div className="flex gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-semibold text-gray-700">Correct Answer</div>
                            <div className="text-gray-600 mt-1">{question.correct_answer || 'Not specified'}</div>
                          </div>
                        </div>
                        {question.explanation && (
                          <div className="border-t border-blue-200 pt-3">
                            <div className="font-semibold text-gray-700 mb-1">Explanation</div>
                            <div className="text-gray-600">{question.explanation}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Settings Modal (Unchanged internals, omitted standard length dialog code here visually but included below) */}
      <Dialog open={isBankSettingsModalOpen} onOpenChange={setIsBankSettingsModalOpen}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[90vh] overflow-y-auto p-0 sm:w-full">
          <DialogHeader className="space-y-2 border-b border-slate-200/80 bg-slate-50/80 px-6 py-5 sm:px-7">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-950">Bank Settings</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
              Update the title, description, subject/class, and visibility for this question bank.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6 sm:px-7">
            {!isEditable && (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>You can view this bank, but only the creator can edit its settings.</div>
              </div>
            )}

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Bank Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Mathematics"
                  className="h-11 border-slate-200 bg-white text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Add a description..."
                  rows={4}
                  className="resize-none border-slate-200 bg-white text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Subject & Class</Label>
                <select
                  value={subjectClassId}
                  onChange={(e) => setSubjectClassId(e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
                >
                  <option value="">Select subject & class</option>
                  {subjectClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {subjectClassLabelMap.get(item.id)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Visibility</Label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  disabled={!isEditable}
                  className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="public_school">Shared with School</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row">
              <Button
                onClick={handleSave}
                disabled={isSaving || !isEditable}
                className="flex-1 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsBankSettingsModalOpen(false)}
                className="flex-1 border-slate-200"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuestionGroupsModalOpen} onOpenChange={setIsQuestionGroupsModalOpen}>
        <DialogContent className="w-[96vw] max-w-5xl max-h-[90vh] overflow-y-auto p-0 sm:w-full">
          <DialogHeader className="space-y-2 border-b border-slate-200/80 bg-slate-50/80 px-6 py-5 sm:px-7">
            <DialogTitle className="text-xl font-bold tracking-tight text-slate-950">Question Groups</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-slate-600">
              Create reusable topic collections, then apply them directly to AI generation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6 sm:px-7">
            {!isEditable && (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>You can view saved groups here, but only the bank owner can create or edit them.</div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
              <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50 p-5 shadow-sm sm:p-6">
                <div className="space-y-1.5 border-b border-slate-200/60 pb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {editingGroupId ? 'Edit Group' : 'Create New Group'}
                  </p>
                  <h3 className="text-lg font-semibold text-slate-950">
                    {editingGroupId ? 'Edit Group' : 'Create New Group'}
                  </h3>
                  <p className="text-sm leading-6 text-slate-500">Save frequently used topic combinations for faster generation.</p>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">Group Title</Label>
                    <Input
                      value={groupTitleInput}
                      onChange={(e) => setGroupTitleInput(e.target.value)}
                      disabled={!isEditable || topicGroupsLoading}
                      placeholder="e.g. Fractions revision set"
                      className="h-11 border-slate-200 bg-white text-sm shadow-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-slate-700">Topics</Label>
                    <Textarea
                      value={groupTopicsInput}
                      onChange={(e) => setGroupTopicsInput(e.target.value)}
                      disabled={!isEditable || topicGroupsLoading}
                      placeholder="Fractions, decimals, ratios"
                      rows={4}
                      className="resize-none border-slate-200 bg-white text-sm shadow-sm"
                    />
                    <p className="text-xs text-slate-500">
                      Separate topics with commas. These labels are reused during AI generation.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
                      <span>Live preview</span>
                      <span>{groupTopicPreview.length} topics</span>
                    </div>
                    <div className="mt-3 flex min-h-12 flex-wrap gap-2">
                      {groupTopicPreview.length > 0 ? (
                        groupTopicPreview.map((topic) => (
                          <span
                            key={topic}
                            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 shadow-sm"
                          >
                            {topic}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">Start typing topics to preview the chips.</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="sm"
                      onClick={handleSaveTopicGroup}
                      disabled={!isEditable || topicGroupsLoading}
                      className="flex-1 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {topicGroupsLoading ? 'Saving...' : editingGroupId ? 'Update Group' : 'Create Group'}
                    </Button>
                    {editingGroupId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditGroup}
                        disabled={topicGroupsLoading}
                        className="flex-1 border-slate-200 bg-white"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-end justify-between gap-4 border-b border-slate-200/60 pb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saved groups</p>
                    <p className="mt-1 text-sm text-slate-500">Use, edit, or delete existing topic collections.</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                    {topicGroups.length} total
                  </Badge>
                </div>

                {hasQuestionGroups ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                    {topicGroups.map((group) => {
                      const topicCount = (group.topics || []).length;

                      return (
                        <div
                          key={group.id}
                          className="group flex h-full flex-col rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/70"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                                <FolderKanban className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 space-y-1">
                                <p className="truncate font-semibold text-slate-950">{group.title}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span>
                                    {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
                                  </span>
                                  <span>•</span>
                                  <span>Created {formatDate(group.created_at)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEditGroup(group)}
                                disabled={topicGroupsLoading || !isEditable}
                                className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                                aria-label={`Edit ${group.title}`}
                              >
                                <PencilLine className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteTopicGroup(group.id)}
                                disabled={topicGroupsLoading || !isEditable}
                                className="h-8 w-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Delete ${group.title}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {topicCount > 0 ? (
                              group.topics.map((topic) => (
                                <Badge
                                  key={`${group.id}-${topic}`}
                                  variant="secondary"
                                  className="rounded-full border border-indigo-100 bg-indigo-50/90 text-indigo-700 shadow-sm"
                                >
                                  {topic}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">No topics defined</span>
                            )}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-5 w-full border-slate-200 bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800 hover:text-white"
                            onClick={() => applyTopicGroup(group)}
                          >
                            Use Group
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                      <FolderKanban className="h-7 w-7 text-slate-400" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-900">No Question Groups Yet</h3>
                    <p className="mt-2 text-sm text-slate-500">Create your first reusable topic collection.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generation Modal */}
      <Dialog open={isGenerateModalOpen} onOpenChange={handleCloseGenerateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col w-[95vw] mx-auto overflow-x-hidden">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 flex-shrink-0">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold">Generate Questions with AI</DialogTitle>
              <DialogDescription className="text-sm">Step {generateStep} of 5 — Configure your generation settings</DialogDescription>
            </div>
            <button
              onClick={handleCloseGenerateModal}
              disabled={isGenerating}
              className="rounded-lg p-1 hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex gap-2 px-6 py-4 bg-gray-50 -mx-6 flex-shrink-0">
            {generateStepLabels.map((item) => (
              <div key={item.step} className="flex-1">
                <button
                  className={`w-full text-xs font-medium px-3 py-2 rounded-lg transition-all ${
                    generateStep === item.step
                      ? 'bg-blue-600 text-white shadow-sm'
                      : generateStep > item.step
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-white text-gray-500 border border-gray-200'
                  }`}
                >
                  {item.step}. {item.title}
                </button>
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {generateStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <Label className="text-sm font-semibold text-gray-900">How many questions to generate?</Label>
                  <p className="text-xs text-gray-600 mt-1">Choose between 1 and 30 questions</p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={generateCount}
                  onChange={(e) => setGenerateCount(e.target.value)}
                  disabled={isGenerating}
                  className="h-11 text-base"
                  placeholder="Enter number"
                />
                <div className="flex gap-2 text-xs">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => setGenerateCount(num.toString())}
                      className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generateStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <Label className="text-sm font-semibold text-gray-900">Select Topics</Label>
                  <p className="text-xs text-gray-600 mt-1">Choose from existing topics or add custom ones</p>
                </div>
                {topicGroups.length > 0 && (
                  <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Saved question groups</p>
                      <span className="text-[11px] text-blue-700">Click to load a group</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {topicGroups.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => applyTopicGroup(group)}
                          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-800 shadow-sm transition-colors hover:bg-blue-50"
                        >
                          <span>{group.title}</span>
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {(group.topics || []).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Selected topics</p>
                      <p className="text-[11px] text-gray-500">
                        {effectiveGenerateTopics.length > 0
                          ? `${effectiveGenerateTopics.length} topic${effectiveGenerateTopics.length === 1 ? '' : 's'} selected`
                          : 'No topics selected yet'}
                      </p>
                    </div>
                    {effectiveGenerateTopics.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedGenerateTopics([])}
                        disabled={isGenerating}
                        className="h-8 px-2 text-xs text-gray-500 hover:bg-white hover:text-gray-900"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>

                  <div className="flex min-h-[88px] flex-wrap gap-2">
                    {effectiveGenerateTopics.length > 0 ? (
                      effectiveGenerateTopics.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => removeGenerateTopic(topic)}
                          disabled={isGenerating}
                          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-800 shadow-sm transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Remove topic ${topic}`}
                        >
                          <span>{topic}</span>
                          <X className="h-3 w-3" />
                        </button>
                      ))
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-center text-xs text-gray-500">
                        Pick a saved group or add custom topics to see them here.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={manualTopicInput}
                    onChange={(e) => setManualTopicInput(e.target.value)}
                    placeholder="Add custom topic..."
                    className="h-10 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addManualTopic()}
                  />
                  <Button size="sm" variant="outline" onClick={addManualTopic} className="h-10 px-4">
                    Add
                  </Button>
                </div>
              </div>
            )}

            {generateStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <Label className="text-sm font-semibold text-gray-900">Difficulty Level</Label>
                  <p className="text-xs text-gray-600 mt-1">Select the complexity level for questions</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map((level) => {
                    const icons = { easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' };
                    const colors = {
                      easy: 'emerald',
                      medium: 'amber',
                      hard: 'red',
                    };
                    const color = colors[level];
                    const isSelected = generateDifficulty === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setGenerateDifficulty(level)}
                        className={`py-4 text-sm font-semibold border-2 rounded-lg transition-all ${
                          isSelected
                            ? `bg-${color}-50 border-${color}-500 text-${color}-700`
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="text-xl mb-2">{icons[level]}</div>
                        <div className="capitalize">{level}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {generateStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <Label className="text-sm font-semibold text-gray-900">Question Format</Label>
                  <p className="text-xs text-gray-600 mt-1">Choose the type of questions to generate</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['objective', 'theory'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setGenerateQuestionType(type)}
                      className={`py-4 text-sm font-semibold border-2 rounded-lg transition-all ${
                        generateQuestionType === type
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-xl mb-2">{type === 'objective' ? '🎯' : '✍️'}</div>
                      <div>{type === 'objective' ? 'Multiple Choice' : 'Essay'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generateStep === 5 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
                  <div className="font-semibold text-blue-900 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Review Your Settings
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-gray-700">Questions to Generate</span>
                      <span className="font-semibold text-blue-700">{generateCount}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-gray-700">Difficulty Level</span>
                      <span className="font-semibold text-blue-700 capitalize">{generateDifficulty}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-gray-700">Question Format</span>
                      <span className="font-semibold text-blue-700">
                        {generateQuestionType === 'objective' ? 'Multiple Choice' : 'Essay'}
                      </span>
                    </div>
                    <div className="bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-gray-700 block mb-2">Topics</span>
                      <div className="flex flex-wrap gap-2">
                        {effectiveGenerateTopics.map((topic, idx) => (
                          <span key={idx} className="bg-blue-200 text-blue-900 px-3 py-1 rounded text-xs font-medium">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg text-sm text-emerald-800 flex gap-3">
                  <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>Ready to generate! Click the button below to create your questions.</div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 border-t border-gray-200 pt-4 flex-shrink-0 px-6 pb-6">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setGenerateStep((prev) => Math.max(prev - 1, 1))}
              disabled={isGenerating || generateStep === 1}
              className="flex-1 h-11"
            >
              ← Back
            </Button>
            {generateStep < 5 ? (
              <Button
                size="sm"
                onClick={() => setGenerateStep((prev) => Math.min(prev + 1, 5))}
                disabled={isGenerating || (generateStep === 2 && effectiveGenerateTopics.length === 0)}
                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                Next →
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleGenerateQuestions}
                disabled={isGenerating}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
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