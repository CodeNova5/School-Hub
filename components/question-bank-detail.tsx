"use client";

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, BookOpen, FolderKanban, Globe2, Lock, Save, Search, Settings2, Sparkles, X, AlertCircle, CheckCircle, PencilLine, Plus, Printer, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface SmartTextProps {
  content: string;
  containsMath: boolean;
}

function hasMathContent(text: string): boolean {
  return (
    /\$\$[\s\S]+?\$\$/.test(text) ||
    /\$[^$\n]+?\$/.test(text) ||
    /\\\([\s\S]+?\\\)/.test(text) ||
    /\\\[[\s\S]+?\\\]/.test(text) ||
    /\\(frac|sqrt|sum|int|prod|lim|log|sin|cos|tan|le|ge|leq|geq|neq|pm|times|div|cdot|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega|infty|forall|exists|in|notin|subset|cup|cap|mathbb|mathbf|text|left|right|begin|end|rightarrow|leftarrow|rightleftharpoons)\b/.test(text)
  );
}

function sanitizeLatex(text: string): string {
  if (!text) return '';
  let sanitized = text
    .replace(/\x0c/g, '\\f')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  let unescapedDollarCount = 0;
  for (let i = 0; i < sanitized.length; i++) {
    if (sanitized[i] === '$') {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && sanitized[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) {
        unescapedDollarCount++;
      }
    }
  }

  if (unescapedDollarCount % 2 !== 0) {
    sanitized += '$';
  }

  return sanitized;
}

function SmartText({ content, containsMath }: SmartTextProps) {
  const sanitizedContent = sanitizeLatex(content);
  const shouldRenderMath = containsMath || hasMathContent(sanitizedContent);

  if (shouldRenderMath) {
    return (
      <div className="inline-block align-middle prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
          {sanitizedContent}
        </ReactMarkdown>
      </div>
    );
  }

  return <span>{content}</span>;
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Compact Week Card                                                            */
/* ────────────────────────────────────────────────────────────────────────────── */

function CompactWeekCard({ week }: { week: WeekEntry }) {
  if (week.is_break) return null;
  const topicCount = week.topics.length;
  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        topicCount > 0
          ? 'border-stone-200 bg-white hover:border-amber-200 hover:shadow-sm'
          : 'border-dashed border-stone-200 bg-stone-50/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`text-xs font-bold ${topicCount > 0 ? 'text-stone-700' : 'text-stone-400'}`}>
          Wk {week.week_number}
        </span>
        {topicCount > 0 && (
          <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">
            {topicCount}
          </span>
        )}
      </div>
      {topicCount > 0 ? (
        <div className="flex flex-wrap gap-1">
          {week.topics.slice(0, 2).map((topic, i) => (
            <span
              key={i}
              className="text-[10px] text-stone-500 bg-stone-50 rounded px-1.5 py-0.5 truncate max-w-full block leading-tight"
              title={topic}
            >
              {topic}
            </span>
          ))}
          {week.topics.length > 2 && (
            <span className="text-[10px] text-stone-400">+{week.topics.length - 2}</span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-stone-400 italic">No topics</p>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                        */
/* ────────────────────────────────────────────────────────────────────────────── */

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
  created_by_teacher_id?: string | null;
  created_by_admin_id?: string | null;
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
  metadata?: {
    imageUrl?: string;
    imagePath?: string;
    imageName?: string;
    imageMimeType?: string;
    imageSize?: number;
    containsMath?: boolean;
  } | null;
  question_type: 'objective' | 'theory';
  difficulty: 'easy' | 'medium' | 'hard';
  visibility: 'private' | 'public_school';
  created_by_teacher_id?: string | null;
  source_question_id?: string | null;
  created_at: string;
  updated_at?: string;
};

type WeekEntry = {
  week_number: number;
  topics: string[];
  is_break: boolean;
};

type TopicGroupRecord = {
  id: string;
  title: string;
  topics: string[];
  weeks: WeekEntry[];
  term?: '1' | '2' | '3';
  created_by_teacher_id?: string | null;
  created_by_admin_id?: string | null;
  created_at: string;
};

type ContextPayload = {
  userId?: string;
  teacherId?: string;
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

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                      */
/* ────────────────────────────────────────────────────────────────────────────── */

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

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Props                                                                        */
/* ────────────────────────────────────────────────────────────────────────────── */

interface QuestionBankDetailProps {
  role: 'admin' | 'teacher';
}

/* ────────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                    */
/* ────────────────────────────────────────────────────────────────────────────── */

export function QuestionBankDetail({ role }: QuestionBankDetailProps) {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';

  const apiPrefix = `/api/${role}/question-bank`;
  const routePrefix = `/${role}/question-bank`;

  const [ownerId, setOwnerId] = useState('');
  const [subjectClasses, setSubjectClasses] = useState<SubjectClassItem[]>([]);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);
  const [isSchemeModalOpen, setIsSchemeModalOpen] = useState(false);
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

  useEffect(() => {
    if (bankId) {
      void loadPage();
    }
  }, [bankId]);

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

  /** Build a default 12-week scheme array for display when no scheme exists */
  function buildDefaultWeeks(): WeekEntry[] {
    const weeks: WeekEntry[] = [];
    for (let w = 1; w <= 12; w++) {
      weeks.push({ week_number: w, topics: [], is_break: w === 6 });
    }
    return weeks;
  }

  function getCurrentSchemeWeeks(): WeekEntry[] {
    const scheme = selectedTerm !== 'all'
      ? topicGroups.find((g) => inferTopicGroupTerm(g) === selectedTerm)
      : null;
    const weeks = scheme?.weeks;
    if (Array.isArray(weeks) && weeks.length > 0) return weeks;
    // Fall back to deriving from flat topics
    if (scheme && scheme.topics.length > 0) {
      const wks = buildDefaultWeeks();
      const teachingWeeks = wks.filter((w) => !w.is_break);
      scheme.topics.forEach((topic, i) => {
        const wi = i % teachingWeeks.length;
        const weekNum = teachingWeeks[wi].week_number;
        const idx = wks.findIndex((w) => w.week_number === weekNum);
        if (idx !== -1) wks[idx].topics.push(topic);
      });
      return wks;
    }
    return buildDefaultWeeks();
  }

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

  // Admins can always edit; teachers only if they own the bank
  const isEditable = role === 'admin'
    ? true
    : bank
      ? bank.created_by_teacher_id === ownerId
      : false;

  async function loadPage() {
    setIsLoading(true);
    setQuestionsError('');
    try {
      const [contextResponse, bankResponse, questionsResponse, groupsResponse] = await Promise.all([
        fetch(`${apiPrefix}/context`, { cache: 'no-store' }),
        fetch(`${apiPrefix}/banks/${bankId}`, { cache: 'no-store' }),
        fetch(`${apiPrefix}/banks/${bankId}/questions`, { cache: 'no-store' }),
        fetch(`${apiPrefix}/banks/${bankId}/topic-groups`, { cache: 'no-store' }),
      ]);

      const contextPayload = (await contextResponse.json()) as ContextPayload & { error?: string };
      const bankPayload = (await bankResponse.json()) as BankPayload & { error?: string };
      const questionsPayload = (await questionsResponse.json()) as QuestionsPayload & { error?: string };
      const groupsPayload = (await groupsResponse.json()) as { groups?: TopicGroupRecord[] } & { error?: string };

      if (!contextResponse.ok || contextPayload.error) {
        toast.error('Failed to load question bank data');
        return;
      }

      if (!bankResponse.ok || bankPayload.error) {
        toast.error(bankPayload?.error || 'Question bank not found');
        router.push(routePrefix);
        return;
      }

      if (!questionsResponse.ok || questionsPayload.error) {
        setQuestionsError(questionsPayload?.error || 'Failed to load questions');
      } else {
        setQuestions(questionsPayload.questions || []);
      }

      if (!groupsResponse.ok || groupsPayload.error) {
        setTopicGroups([]);
      } else {
        setTopicGroups(groupsPayload.groups || []);
      }

      // Handle both teacher (teacherId) and admin (userId) context shapes
      const contextOwnerId = contextPayload.teacherId || contextPayload.userId || '';
      setOwnerId(contextOwnerId);
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

    const requestBody = JSON.stringify({
      bankId,
      subjectClassId,
      difficulty: generateDifficulty,
      questionType: generateQuestionType,
      count,
      topics,
    });

    const MAX_ATTEMPTS = 3;

    setIsGenerating(true);
    try {
      let lastError = '';

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await fetch(`${apiPrefix}/questions/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: requestBody,
          });

          const payload = await response.json();

          if (!response.ok && response.status !== 422) {
            toast.error(payload?.error || 'Failed to generate questions');
            return;
          }

          if (response.status === 422) {
            lastError = payload?.error || 'AI payload could not be validated';
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
              continue;
            }
            break;
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
          return;
        } catch {
          toast.error('Failed to generate questions');
          return;
        }
      }

      console.warn('[Generate] Failed after', MAX_ATTEMPTS, 'attempts:', lastError);
      toast.error('The AI is having trouble right now. Please try again later.');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleOpenGenerateModal() {
    setGenerateStep(1);
    setManualTopicInput('');

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

  async function addManualTopic() {
    const value = manualTopicInput.trim();
    if (!value) return;

    setSelectedGenerateTopics((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === value.toLowerCase());
      if (exists) return prev;
      return [...prev, value];
    });
    setManualTopicInput('');

    if (selectedTerm !== 'all') {
      const matchingGroup = topicGroups.find((g) => inferTopicGroupTerm(g) === selectedTerm);
      if (matchingGroup) {
        const alreadyInGroup = (matchingGroup.topics || []).some(
          (t) => t.toLowerCase() === value.toLowerCase()
        );
        if (!alreadyInGroup) {
          const updatedTopics = [...(matchingGroup.topics || []), value];
          try {
            const res = await fetch(
              `${apiPrefix}/banks/${bankId}/topic-groups/${matchingGroup.id}`,
              {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: matchingGroup.title, topics: updatedTopics }),
              }
            );
            if (res.ok) {
              const payload = await res.json();
              const savedGroup = payload.group as TopicGroupRecord;
              setTopicGroups((prev) =>
                prev.map((g) => (g.id === savedGroup.id ? savedGroup : g))
              );
              toast.success(`"${value}" added to ${matchingGroup.title}`);
            }
          } catch {
            // silently ignore
          }
        }
      }
    }
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

  function getWeekTopicCount(term: string): number {
    if (term === 'all') {
      return topicGroups.reduce((sum, g) => sum + (g.topics?.length || 0), 0);
    }
    const scheme = topicGroups.find((g) => inferTopicGroupTerm(g) === term);
    return scheme ? (scheme.topics?.length || 0) : 0;
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
      const response = await fetch(`${apiPrefix}/banks/${bankId}`, {
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

  function handleOpenSchemeModal() {
    setIsSchemeModalOpen(true);
  }

  const canGenerateQuestions = isEditable && !!bank && !!subjectClassId;

  const generateStepLabels = [
    { step: 1, title: 'Amount' },
    { step: 2, title: 'Topics' },
    { step: 3, title: 'Difficulty' },
    { step: 4, title: 'Format' },
    { step: 5, title: 'Review' },
  ];

  /* ─────────────────────────── Loading State ─────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-stone-500 font-medium">Loading your question bank...</p>
        </div>
      </div>
    );
  }

  /* ─────────────────────────── Not Found ─────────────────────────── */

  if (!bank) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <Card className="w-full max-w-md border-stone-200 shadow-sm text-center p-8 space-y-4">
          <div className="flex justify-center">
            <BookOpen className="h-12 w-12 text-stone-300" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-stone-900">Question bank not found</h1>
            <p className="text-sm text-stone-500">This bank may have been removed or you may lack access permissions.</p>
          </div>
          <Button variant="outline" onClick={() => router.push(routePrefix)} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to overview
          </Button>
        </Card>
      </div>
    );
  }

  /* ─────────────────────────── Main Render ─────────────────────────── */

  return (
    <div className="w-full space-y-8 pb-16">
      {/* ── Header Section ── */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-stone-500 hover:text-stone-900"
            onClick={() => router.push(routePrefix)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-2 flex-1">
              <h1 className="text-4xl font-bold tracking-tight text-stone-900">{bank.title}</h1>
              {bank.description && (
                <p className="text-stone-600 text-lg max-w-2xl">{bank.description}</p>
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

        {/* ── CTA Section ── */}
        {isEditable && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Sparkles className="h-4 w-4" />
                Expand your question bank with AI
              </div>
              <p className="text-sm text-amber-700">Generate questions tailored to specific topics and difficulty levels</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="border-stone-200"
                onClick={() => router.push(`${routePrefix}/${bankId}/questions`)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
              <Button
                onClick={handleOpenGenerateModal}
                disabled={!canGenerateQuestions}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium w-full sm:w-auto"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Generate with AI
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-200"
                onClick={handleOpenSchemeModal}
              >
                <FolderKanban className="h-4 w-4 mr-2" />
                Scheme of Work
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-200"
                onClick={() => setIsBankSettingsModalOpen(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Bank Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-200"
                onClick={() => router.push(`${routePrefix}/${bankId}/print`)}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Exam
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-stone-200"
                onClick={() => router.push(`${routePrefix}/${bankId}/audit`)}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Audit Trail
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="space-y-6">
        <Card className="border-stone-200 shadow-sm">
          <CardHeader className="border-b border-stone-100 bg-stone-50/50 pb-4">
            <div className="space-y-4">
              <div>
                <CardTitle>Questions Catalog</CardTitle>
                <CardDescription>
                  {filteredQuestions.length} of {questions.length} question{questions.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>

              {/* Filters */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="relative sm:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
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
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="all">All Terms</option>
                  <option value="1">Term 1</option>
                  <option value="2">Term 2</option>
                  <option value="3">Term 3</option>
                </select>
                <select
                  value={questionDifficultyFilter}
                  onChange={(e) => setQuestionDifficultyFilter(e.target.value as any)}
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                >
                  <option value="all">All difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <select
                  value={questionTypeFilter}
                  onChange={(e) => setQuestionTypeFilter(e.target.value as any)}
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
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
                <BookOpen className="mx-auto h-8 w-8 text-stone-300" />
                <div>
                  <p className="text-base font-medium text-stone-700">No matching questions found</p>
                  <p className="text-sm text-stone-500 mt-1">
                    {questions.length === 0
                      ? "Get started by generating questions with AI above"
                      : "Try adjusting your filters"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredQuestions.map((question, index) => (
                  <div key={question.id} className="pb-6 border-b border-stone-100 last:border-0 last:pb-0">
                    {/* Question Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-stone-50 border-stone-200">
                          {question.topic}
                        </Badge>
                        <Badge variant="outline" className={`${getDifficultyStyles(question.difficulty)} border`}>
                          {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                          {question.question_type === 'objective' ? 'Multiple Choice' : 'Essay'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-stone-500 hover:text-amber-600 hover:bg-amber-50"
                            onClick={() => router.push(`${routePrefix}/${bankId}/questions?questionId=${question.id}`)}
                          >
                            <PencilLine className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Question Image */}
                    {question.metadata?.imageUrl && (
                      <div className="mb-4 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm">
                        <img
                          src={question.metadata.imageUrl}
                          alt={question.metadata.imageName || 'Question image'}
                          className="max-h-72 w-full object-contain bg-white"
                        />
                      </div>
                    )}

                    {/* Question Text */}
                    <div className="text-base text-stone-900 font-medium mb-4 leading-relaxed flex gap-2 items-start">
                      <span className="select-none">{index + 1}.</span>
                      <SmartText
                        content={question.question_text}
                        containsMath={!!question.metadata?.containsMath}
                      />
                    </div>

                    {/* Options */}
                    {question.question_type === 'objective' && question.options.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 mb-4 pl-4">
                        {question.options.map((option, idx) => (
                          <div
                            key={idx}
                            className="text-sm text-stone-700 border border-stone-200 bg-white px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors"
                          >
                            <span className="font-semibold text-stone-400 mr-2">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <SmartText content={option} containsMath={!!question.metadata?.containsMath} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Answer and Explanation */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3 text-sm">
                      <div className="flex gap-2">
                        <CheckCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-stone-700">Correct Answer</div>
                          {(() => {
                            const ca = question.correct_answer;
                            if (!ca) {
                              return <div className="text-stone-600 mt-1">Not specified</div>;
                            }
                            if (question.question_type === 'objective' && /^[A-H]$/i.test(ca)) {
                              return <div className="text-stone-600 mt-1">{ca.toUpperCase()}</div>;
                            }
                            return (
                              <div className="text-stone-600 mt-1">
                                <SmartText content={ca} containsMath={!!question.metadata?.containsMath} />
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      {question.explanation && (
                        <div className="border-t border-amber-200 pt-3">
                          <div className="font-semibold text-stone-700 mb-1">Explanation</div>
                          <div className="text-stone-600">
                            <SmartText content={question.explanation} containsMath={!!question.metadata?.containsMath} />
                          </div>
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

      {/* ── Settings Modal ── */}
      <Dialog open={isBankSettingsModalOpen} onOpenChange={setIsBankSettingsModalOpen}>
        <DialogContent className="w-[96vw] max-w-2xl max-h-[90vh] overflow-y-auto p-0 sm:w-full">
          <DialogHeader className="space-y-2 border-b border-stone-200/80 bg-stone-50/80 px-6 py-5 sm:px-7">
            <DialogTitle className="text-xl font-bold tracking-tight text-stone-950">Bank Settings</DialogTitle>
            <DialogDescription className="max-w-2xl text-sm leading-6 text-stone-600">
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
                <Label className="text-xs font-semibold text-stone-700">Bank Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!isEditable}
                  placeholder="e.g. Mathematics"
                  className="h-11 border-stone-200 bg-white text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-stone-700">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Add a description..."
                  rows={4}
                  className="resize-none border-stone-200 bg-white text-sm shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-stone-700">Subject & Class</Label>
                <select
                  value={subjectClassId}
                  onChange={(e) => setSubjectClassId(e.target.value)}
                  disabled={!isEditable}
                  className="w-full h-11 rounded-md border border-stone-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:bg-stone-50"
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
                <Label className="text-xs font-semibold text-stone-700">Visibility</Label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  disabled={!isEditable}
                  className="w-full h-11 rounded-md border border-stone-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:bg-stone-50"
                >
                  <option value="private">Private (Only Me)</option>
                  <option value="public_school">Shared with School</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-stone-200 pt-4 sm:flex-row">
              <Button
                onClick={handleSave}
                disabled={isSaving || !isEditable}
                className="flex-1 bg-stone-950 text-white shadow-sm transition-colors hover:bg-stone-800"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsBankSettingsModalOpen(false)}
                className="flex-1 border-stone-200"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Scheme of Work Modal ── */}
      <Dialog open={isSchemeModalOpen} onOpenChange={setIsSchemeModalOpen}>
        <DialogContent className="w-[96vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0 sm:w-full">
          <DialogHeader className="space-y-2 border-b border-stone-200/80 bg-stone-50/80 px-6 py-5 sm:px-7">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-stone-950">Scheme of Work</DialogTitle>
                <DialogDescription className="max-w-2xl text-sm leading-6 text-stone-600 mt-1">
                  Week-by-week topic plan for this question bank
                </DialogDescription>
              </div>
              <Badge variant="outline" className="border-stone-200 text-stone-500 shrink-0">
                {getWeekTopicCount(selectedTerm)} topic{getWeekTopicCount(selectedTerm) !== 1 ? 's' : ''} across {selectedTerm === 'all' ? 'all terms' : 'Term ' + selectedTerm}
              </Badge>
            </div>
          </DialogHeader>

          <div className="px-6 py-5 sm:px-7 space-y-5">
            {!isEditable && (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>You can view the scheme, but only the bank owner can edit it.</div>
              </div>
            )}

            {/* Inline term tabs */}
            <div className="flex gap-1 bg-stone-100 p-1 rounded-lg w-fit">
              {(['1', '2', '3'] as const).map((term) => {
                const scheme = topicGroups.find((g) => inferTopicGroupTerm(g) === term);
                const count = scheme?.topics?.length || 0;
                return (
                  <button
                    key={term}
                    onClick={() => setSelectedTerm(term)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                      selectedTerm === term
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Term {term}
                    {count > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        selectedTerm === term ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-500'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Weekly scheme grid */}
            {selectedTerm !== 'all' && (() => {
              const weeks = getCurrentSchemeWeeks();
              const hasTopics = weeks.some((w) => !w.is_break && w.topics.length > 0);

              if (!hasTopics) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-3">
                      <BookOpen className="h-6 w-6 text-stone-400" />
                    </div>
                    <p className="text-sm font-semibold text-stone-700 mb-1">No scheme for Term {selectedTerm}</p>
                    <p className="text-xs text-stone-500 mb-4 max-w-xs">
                      Head to the Scheme of Work page to create a week-by-week topic plan.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`${routePrefix}/${bankId}/groups`)}
                      className="gap-2 border-stone-200"
                    >
                      <FolderKanban className="h-4 w-4" />
                      Create Scheme
                    </Button>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Weeks 1-5 */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mb-2.5 px-1">
                      First Half · Weeks 1 – 5
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {weeks.filter((w) => w.week_number >= 1 && w.week_number <= 5).map((week) => (
                        <CompactWeekCard key={week.week_number} week={week} />
                      ))}
                    </div>
                  </div>

                  {/* Week 6 - Break */}
                  <div className="max-w-[200px] mx-auto">
                    {weeks.filter((w) => w.is_break).map((week) => (
                      <div
                        key={week.week_number}
                        className="rounded-lg border-2 border-dashed border-stone-200 bg-stone-50/50 py-3 text-center"
                      >
                        <p className="text-[11px] font-semibold text-stone-400">Week 6</p>
                        <p className="text-[10px] text-stone-300 font-medium">Mid-Term Break</p>
                      </div>
                    ))}
                  </div>

                  {/* Weeks 7-12 */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-stone-400 mb-2.5 px-1">
                      Second Half · Weeks 7 – 12
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {weeks.filter((w) => w.week_number >= 7 && w.week_number <= 12).map((week) => (
                        <CompactWeekCard key={week.week_number} week={week} />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedTerm === 'all' && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-stone-500">Select a term above to view its scheme of work.</p>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-stone-100 flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSchemeModalOpen(false)}
              className="border-stone-200 text-stone-600"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setIsSchemeModalOpen(false);
                router.push(`${routePrefix}/${bankId}/groups`);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <FolderKanban className="h-4 w-4" />
              Full Scheme Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Generation Modal ── */}
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
              className="rounded-lg p-1 hover:bg-stone-100 transition-colors"
            >
              <X className="h-5 w-5 text-stone-500" />
            </button>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex gap-2 px-6 py-4 bg-stone-50 -mx-6 flex-shrink-0">
            {generateStepLabels.map((item) => (
              <div key={item.step} className="flex-1">
                <button
                  className={`w-full text-xs font-medium px-3 py-2 rounded-lg transition-all ${
                    generateStep === item.step
                      ? 'bg-amber-600 text-white shadow-sm'
                      : generateStep > item.step
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white text-stone-500 border border-stone-200'
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
                  <Label className="text-sm font-semibold text-stone-900">How many questions to generate?</Label>
                  <p className="text-xs text-stone-600 mt-1">Choose between 1 and 30 questions</p>
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
                      className="px-3 py-1 rounded border border-stone-300 hover:bg-stone-50 text-stone-700 transition-colors"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {generateStep === 2 && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div>
                  <Label className="text-sm font-semibold text-stone-900">Select Topics</Label>
                  <p className="text-xs text-stone-500 mt-1">Tick individual topics from your groups, or add custom ones below</p>
                </div>

                {topicGroups.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Saved groups</p>
                    {topicGroups.map((group) => {
                      const groupTopics = group.topics || [];
                      const selectedInGroup = groupTopics.filter((t) =>
                        selectedGenerateTopics.some((s) => s.toLowerCase() === t.toLowerCase())
                      );
                      const allSelected = groupTopics.length > 0 && selectedInGroup.length === groupTopics.length;
                      const someSelected = selectedInGroup.length > 0 && !allSelected;
                      return (
                        <details
                          key={group.id}
                          className="group/acc rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden transition-shadow duration-200 hover:shadow-md"
                        >
                          <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 list-none">
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-white text-[10px] font-bold transition-all duration-150 ${
                                  allSelected
                                    ? 'border-amber-600 bg-amber-600'
                                    : someSelected
                                      ? 'border-amber-400 bg-amber-100'
                                      : 'border-stone-300 bg-white'
                                }`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (allSelected) {
                                    setSelectedGenerateTopics((prev) =>
                                      prev.filter(
                                        (s) => !groupTopics.some((t) => t.toLowerCase() === s.toLowerCase())
                                      )
                                    );
                                  } else {
                                    setSelectedGenerateTopics((prev) => {
                                      const existing = new Set(prev.map((s) => s.toLowerCase()));
                                      const toAdd = groupTopics.filter((t) => !existing.has(t.toLowerCase()));
                                      return [...prev, ...toAdd];
                                    });
                                  }
                                }}
                                role="checkbox"
                                aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                                aria-label={`Select all in ${group.title}`}
                              >
                                {allSelected ? '✓' : someSelected ? '−' : ''}
                              </span>
                              <span className="truncate text-sm font-semibold text-stone-800">{group.title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {selectedInGroup.length > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                  {selectedInGroup.length}/{groupTopics.length}
                                </span>
                              )}
                              {selectedInGroup.length === 0 && (
                                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                                  {groupTopics.length}
                                </span>
                              )}
                              <svg
                                className="h-4 w-4 text-stone-400 transition-transform duration-200 group-open/acc:rotate-180"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </summary>
                          <div className="border-t border-stone-100 px-4 pb-3 pt-3">
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                              {groupTopics.map((topic) => {
                                const isChecked = selectedGenerateTopics.some(
                                  (s) => s.toLowerCase() === topic.toLowerCase()
                                );
                                return (
                                  <label
                                    key={topic}
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                                      isChecked
                                        ? 'bg-amber-50 text-amber-800'
                                        : 'text-stone-700 hover:bg-stone-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isGenerating}
                                      onChange={() => toggleGenerateTopic(topic)}
                                      className="h-4 w-4 rounded border-stone-300 accent-amber-600 disabled:cursor-not-allowed"
                                    />
                                    <span className="truncate leading-tight">{topic}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                )}

                <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Selected</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {effectiveGenerateTopics.length > 0
                          ? `${effectiveGenerateTopics.length} topic${effectiveGenerateTopics.length === 1 ? '' : 's'} will be used`
                          : 'Nothing selected — will default to the subject'}
                      </p>
                    </div>
                    {effectiveGenerateTopics.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedGenerateTopics([])}
                        disabled={isGenerating}
                        className="h-7 px-2 text-xs text-stone-400 hover:bg-white hover:text-red-500"
                      >
                        Clear all
                      </Button>
                    )}
                  </div>
                  <div className="flex min-h-[60px] flex-wrap gap-1.5">
                    {effectiveGenerateTopics.length > 0 ? (
                      effectiveGenerateTopics.map((topic) => (
                        <span
                          key={topic}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm"
                        >
                          {topic}
                          <button
                            type="button"
                            onClick={() => removeGenerateTopic(topic)}
                            disabled={isGenerating}
                            aria-label={`Remove ${topic}`}
                            className="rounded-full text-amber-400 hover:text-red-500 transition-colors duration-150 disabled:cursor-not-allowed"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-lg border border-dashed border-stone-200 bg-white/60 py-5 text-xs text-stone-400">
                        Tick topics above, or type a custom one below
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={manualTopicInput}
                    onChange={(e) => setManualTopicInput(e.target.value)}
                    placeholder="Type a custom topic and press Enter…"
                    className="h-10 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && addManualTopic()}
                    disabled={isGenerating}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addManualTopic}
                    className="h-10 px-4 shrink-0"
                    disabled={isGenerating || !manualTopicInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}

            {generateStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <Label className="text-sm font-semibold text-stone-900">Difficulty Level</Label>
                  <p className="text-xs text-stone-600 mt-1">Select the complexity level for questions</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['easy', 'medium', 'hard'] as const).map((level) => {
                    const icons = { easy: '⭐', medium: '⭐⭐', hard: '⭐⭐⭐' };
                    const isSelected = generateDifficulty === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setGenerateDifficulty(level)}
                        className={`py-4 text-sm font-semibold border-2 rounded-lg transition-all ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 text-amber-700'
                            : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
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
                  <Label className="text-sm font-semibold text-stone-900">Question Format</Label>
                  <p className="text-xs text-stone-600 mt-1">Choose the type of questions to generate</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['objective', 'theory'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setGenerateQuestionType(type)}
                      className={`py-4 text-sm font-semibold border-2 rounded-lg transition-all ${
                        generateQuestionType === type
                          ? 'bg-amber-50 border-amber-500 text-amber-700'
                          : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
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
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 space-y-4">
                  <div className="font-semibold text-amber-900 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Review Your Settings
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-stone-700">Questions to Generate</span>
                      <span className="font-semibold text-amber-700">{generateCount}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-stone-700">Difficulty Level</span>
                      <span className="font-semibold text-amber-700 capitalize">{generateDifficulty}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-stone-700">Question Format</span>
                      <span className="font-semibold text-amber-700">
                        {generateQuestionType === 'objective' ? 'Multiple Choice' : 'Essay'}
                      </span>
                    </div>
                    <div className="bg-white/60 px-4 py-3 rounded-lg">
                      <span className="text-stone-700 block mb-2">Topics</span>
                      <div className="flex flex-wrap gap-2">
                        {effectiveGenerateTopics.map((topic, idx) => (
                          <span key={idx} className="bg-amber-200 text-amber-900 px-3 py-1 rounded text-xs font-medium">
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
          <div className="flex gap-3 border-t border-stone-200 pt-4 flex-shrink-0 px-6 pb-6">
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
                className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-medium"
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
    </div>
  );
}
