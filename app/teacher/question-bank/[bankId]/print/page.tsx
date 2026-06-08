"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, GripVertical, Printer, Eye, EyeOff, Search,
  CheckSquare, Shuffle, FileText, X, Trash2, ArrowUp, ArrowDown, Dices, Edit
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// --- Shared Types & Helpers ---

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

// Option Resync Helpers
function getCorrectOptionText(options: string[], correct_answer?: string | null): string | null {
  if (!correct_answer) return null;
  const ans = correct_answer.trim();

  // Match exact letter formats: "A", "b"
  if (/^[a-zA-Z]$/.test(ans)) {
    const index = ans.toLowerCase().charCodeAt(0) - 97;
    if (index >= 0 && index < options.length) {
      return options[index];
    }
  }

  // Match format: "Option A"
  const match = ans.match(/^option\s+([a-zA-Z])$/i);
  if (match) {
    const index = match[1].toLowerCase().charCodeAt(0) - 97;
    if (index >= 0 && index < options.length) {
      return options[index];
    }
  }

  // Fallback: the answer is likely stored as the exact string text
  return ans;
}

function calculateNewCorrectAnswer(newOptions: string[], correctOptionText: string | null, oldCorrectAnswer?: string | null): string | null | undefined {
  if (!oldCorrectAnswer || !correctOptionText) return oldCorrectAnswer;

  const newIndex = newOptions.findIndex(opt => opt === correctOptionText);
  if (newIndex === -1) return oldCorrectAnswer; // Fallback if string not found

  const ans = oldCorrectAnswer.trim();

  // Preserve "a", "b", "c" format
  if (/^[a-z]$/.test(ans)) {
    return String.fromCharCode(97 + newIndex);
  }

  // Preserve "A", "B", "C" format
  if (/^[A-Z]$/.test(ans)) {
    return String.fromCharCode(65 + newIndex);
  }

  // Preserve "Option A" format
  const match = ans.match(/^(option\s+)([a-zA-Z])$/i);
  if (match) {
    const isUpper = match[2] === match[2].toUpperCase();
    const newLetter = String.fromCharCode((isUpper ? 65 : 97) + newIndex);
    return `${match[1]}${newLetter}`;
  }

  // If answer was the pure text string itself, return it unchanged
  return oldCorrectAnswer;
}


type QuestionRecord = {
  id: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_answer?: string | null;
  explanation?: string | null;
  metadata?: {
    imageUrl?: string;
    imageName?: string;
    containsMath?: boolean;
  } | null;
  question_type: 'objective' | 'theory';
  difficulty: 'easy' | 'medium' | 'hard';
};

type OrderedQuestionRecord = QuestionRecord & {
  custom_number?: string;
};


type BankRecord = {
  id: string;
  title: string;
  subject_class_id: string;
};

type TopicGroupRecord = {
  id: string;
  title: string;
  topics: string[];
  term?: '1' | '2' | '3';
};

type ActiveTab = 'select' | 'arrange' | 'preview';

function inferTopicGroupTerm(group: TopicGroupRecord) {
  if (group.term) return group.term;
  const label = group.title.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';
  return undefined;
}

// --- Stats Banner (shared across tabs) ---

interface StatsBannerProps {
  total: number;
  objectives: number;
  theory: number;
  compact?: boolean;
}

function StatsBanner({ total, objectives, theory, compact = false }: StatsBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-600">Selected</span>
          <Badge className="bg-blue-600 text-white text-xs">{total}</Badge>
        </div>
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-600">Objectives</span>
          <Badge variant="outline" className="text-xs border-purple-300 text-purple-700">{objectives}</Badge>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-600">Theory</span>
          <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">{theory}</Badge>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-slate-200 bg-blue-50">
      <CardContent className="pt-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Selected Questions:</span>
            <Badge className="bg-blue-600">{total}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Objectives:</span>
            <Badge variant="outline">{objectives}</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Theory:</span>
            <Badge variant="outline">{theory}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Tab Button ---

interface TabButtonProps {
  tab: ActiveTab;
  activeTab: ActiveTab;
  onClick: (tab: ActiveTab) => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function TabButton({ tab, activeTab, onClick, icon, label, badge }: TabButtonProps) {
  const isActive = tab === activeTab;
  return (
    <button
      onClick={() => onClick(tab)}
      className={`
        flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-t-xl border-b-2 transition-all duration-200 whitespace-nowrap
        ${isActive
          ? 'border-blue-600 text-blue-700 bg-white shadow-sm'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`
          ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full
          ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}
        `}>
          {badge}
        </span>
      )}
    </button>
  );
}

// --- Main Page Component ---

export default function ExamPrintPage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [isLoading, setIsLoading] = useState(true);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<ActiveTab>('select');

  // Selection & Ordering
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [orderedQuestions, setOrderedQuestions] = useState<OrderedQuestionRecord[]>([]);

  // Filters
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'all' | '1' | '2' | '3'>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'objective' | 'theory'>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');

  // Exam Paper Config
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');

  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // Sub-tab state for Arrange & Order
  const [arrangeSubTab, setArrangeSubTab] = useState<'objectives' | 'theory'>('objectives');

  const objectives = useMemo(() => orderedQuestions.filter((q) => q.question_type === 'objective'), [orderedQuestions]);
  const theory = useMemo(() => orderedQuestions.filter((q) => q.question_type === 'theory'), [orderedQuestions]);

  // Auto-switch sub-tab if one category is empty
  useEffect(() => {
    if (activeTab === 'arrange') {
      if (objectives.length === 0 && theory.length > 0) {
        setArrangeSubTab('theory');
      } else if (theory.length === 0 && objectives.length > 0) {
        setArrangeSubTab('objectives');
      }
    }
  }, [activeTab, objectives.length, theory.length]);

  useEffect(() => {
    if (bankId) loadData();
  }, [bankId]);

  useEffect(() => {
    if (schoolId) fetchSchoolDetails(schoolId);
  }, [schoolId]);

  async function fetchSchoolDetails(id: string) {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('name, address, phone')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) {
        if (data.name) setSchoolName(data.name);
        if (data.address) setSchoolAddress(data.address);
        if (data.phone) setSchoolPhone(data.phone);
      }

      // Fetch current session and current term names to set the exam title
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, name')
        .eq('is_current', true)
        .eq('school_id', id)
        .maybeSingle();

      if (sessionError) {
        console.error('Error fetching current session:', sessionError);
      } else if (sessionData) {
        const { data: termData, error: termError } = await supabase
          .from('terms')
          .select('name')
          .eq('is_current', true)
          .eq('session_id', sessionData.id)
          .eq('school_id', id)
          .maybeSingle();

        if (termError) {
          console.error('Error fetching current term:', termError);
        } else if (termData) {
          setExamTitle(`${termData.name} examination ${sessionData.name} session`);
        } else {
          setExamTitle(`examination ${sessionData.name} session`);
        }
      }
    } catch (error) {
      console.error('Error fetching school details:', error);
      toast.error('Failed to load school details');
    }
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [bankRes, questionsRes, groupsRes, contextRes] = await Promise.all([
        fetch(`/api/teacher/question-bank/banks/${bankId}`),
        fetch(`/api/teacher/question-bank/banks/${bankId}/questions`),
        fetch(`/api/teacher/question-bank/banks/${bankId}/topic-groups`),
        fetch('/api/teacher/question-bank/context'),
      ]);

      const bankData = await bankRes.json();
      const questionsData = await questionsRes.json();
      const groupsData = await groupsRes.json();
      const contextData = await contextRes.json();

      if (!bankRes.ok) throw new Error('Bank not found');

      setBank(bankData.bank);
      setQuestions(questionsData.questions || []);
      setTopicGroups(groupsData.groups || []);

      if (bankData.bank && contextData.subjectClasses) {
        const matchingClass = contextData.subjectClasses.find((c: any) => c.id === bankData.bank.subject_class_id);
        if (matchingClass) {
          setSubjectName(matchingClass.subjects?.name || 'Subject');
          setClassName(matchingClass.classes?.name || 'Class');
        } else {
          setSubjectName(bankData.bank.title);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data for printing');
    } finally {
      setIsLoading(false);
    }
  }

  // Get unique topics from list for filter dropdown options
  const uniqueTopics = useMemo(() => {
    const list = questions.map((q) => q.topic.trim());
    return Array.from(new Set(list)).sort();
  }, [questions]);

  // Filtering Logic
  const termTopics = useMemo(() => {
    if (selectedTerm === 'all') return [];
    return topicGroups
      .filter((g) => inferTopicGroupTerm(g) === selectedTerm)
      .flatMap((g) => g.topics)
      .map((t) => t.trim().toLowerCase());
  }, [topicGroups, selectedTerm]);

  const filteredAvailableQuestions = useMemo(() => {
    const query = questionSearch.trim().toLowerCase();
    return questions.filter((question) => {
      if (selectedQuestionIds.includes(question.id)) return false;

      const matchesSearch =
        !query ||
        question.question_text.toLowerCase().includes(query);

      const matchesType = questionTypeFilter === 'all' || question.question_type === questionTypeFilter;
      const matchesTerm =
        selectedTerm === 'all' || termTopics.includes(question.topic.trim().toLowerCase());
      const matchesTopic = topicFilter === 'all' || question.topic.trim() === topicFilter;
      const matchesDifficulty = difficultyFilter === 'all' || question.difficulty === difficultyFilter;

      return matchesSearch && matchesType && matchesTerm && matchesTopic && matchesDifficulty;
    });
  }, [questions, questionSearch, questionTypeFilter, selectedTerm, termTopics, topicFilter, difficultyFilter, selectedQuestionIds]);

  // General Handlers
  function toggleQuestionSelection(question: QuestionRecord) {
    if (selectedQuestionIds.includes(question.id)) {
      setSelectedQuestionIds((prev) => prev.filter((id) => id !== question.id));
      setOrderedQuestions((prev) => prev.filter((q) => q.id !== question.id));
    } else {
      setSelectedQuestionIds((prev) => [...prev, question.id]);
      setOrderedQuestions((prev) => [...prev, question]);
    }
  }

  function addAllFiltered() {
    const idsToAdd = filteredAvailableQuestions.map((q) => q.id);
    setSelectedQuestionIds((prev) => [...prev, ...idsToAdd]);
    setOrderedQuestions((prev) => [...prev, ...filteredAvailableQuestions]);
  }

  function removeAllSelected() {
    setSelectedQuestionIds([]);
    setOrderedQuestions([]);
  }

  // --- Drag & Drop State ---
  const dragItemId = useRef<string | null>(null);
  const dragOverItemId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragEnabledId, setDragEnabledId] = useState<string | null>(null);

  // --- Sorting & Arrangement Handlers ---

  const handleSort = () => {
    if (!dragItemId.current || !dragOverItemId.current) return;

    const fromIndex = orderedQuestions.findIndex(q => q.id === dragItemId.current);
    const toIndex = orderedQuestions.findIndex(q => q.id === dragOverItemId.current);

    if (fromIndex === -1 || toIndex === -1) return;

    let _orderedQuestions = [...orderedQuestions];
    const draggedItemContent = _orderedQuestions.splice(fromIndex, 1)[0];
    _orderedQuestions.splice(toIndex, 0, draggedItemContent);

    dragItemId.current = null;
    dragOverItemId.current = null;
    setDragOverId(null);
    setOrderedQuestions(_orderedQuestions);
  };

  const updateCustomNumber = (qId: string, value: string) => {
    setOrderedQuestions(prev => prev.map(q =>
      q.id === qId ? { ...q, custom_number: value } : q
    ));
  };

  const shuffleSingleQuestionOptions = (qId: string) => {
    const qIndex = orderedQuestions.findIndex(q => q.id === qId);
    if (qIndex === -1) return;

    const newQuestions = [...orderedQuestions];
    const q = { ...newQuestions[qIndex] };

    if (!q.options || q.options.length <= 1) return;

    const correctText = getCorrectOptionText(q.options, q.correct_answer);
    const newOptions = [...q.options];
    for (let i = newOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newOptions[i], newOptions[j]] = [newOptions[j], newOptions[i]];
    }

    q.options = newOptions;
    q.correct_answer = calculateNewCorrectAnswer(newOptions, correctText, q.correct_answer);
    newQuestions[qIndex] = q;
    setOrderedQuestions(newQuestions);
  };

  const moveOption = (qId: string, optIndex: number, direction: 'up' | 'down') => {
    const qIndex = orderedQuestions.findIndex(q => q.id === qId);
    if (qIndex === -1) return;

    const newQuestions = [...orderedQuestions];
    const q = { ...newQuestions[qIndex] };
    if (!q.options) return;

    const newOptions = [...q.options];

    if (direction === 'up' && optIndex > 0) {
      [newOptions[optIndex - 1], newOptions[optIndex]] = [newOptions[optIndex], newOptions[optIndex - 1]];
    } else if (direction === 'down' && optIndex < newOptions.length - 1) {
      [newOptions[optIndex + 1], newOptions[optIndex]] = [newOptions[optIndex], newOptions[optIndex + 1]];
    } else {
      return;
    }

    const correctText = getCorrectOptionText(q.options, q.correct_answer);
    q.options = newOptions;
    q.correct_answer = calculateNewCorrectAnswer(newOptions, correctText, q.correct_answer);
    newQuestions[qIndex] = q;
    setOrderedQuestions(newQuestions);
  };

  // --- Sorting & Arrangement Handlers ---

  const shuffleQuestionsList = () => {
    setOrderedQuestions((prev) => {
      const newArr = [...prev];
      for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
      }
      return newArr;
    });
    toast.success("Questions shuffled successfully");
  };

  const shuffleAllQuestionsOptions = () => {
    setOrderedQuestions((prev) => prev.map(q => {
      if (q.question_type !== 'objective' || !q.options || q.options.length <= 1) return q;

      const correctText = getCorrectOptionText(q.options, q.correct_answer);
      const newOptions = [...q.options];
      for (let i = newOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newOptions[i], newOptions[j]] = [newOptions[j], newOptions[i]];
      }

      return {
        ...q,
        options: newOptions,
        correct_answer: calculateNewCorrectAnswer(newOptions, correctText, q.correct_answer)
      };
    }));
    toast.success("All options shuffled successfully");
  };



  // --- End Handlers ---

  if (isLoading || schoolLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center space-y-3">
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
            <p className="text-sm text-gray-500 font-medium">Loading paper configuration...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-12">

        {/* ── Sticky Header (hidden on print) ── */}
        <div className="print:hidden sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Go back"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Exam Paper Builder</h1>
                  <p className="text-sm text-slate-500">{bank?.title || 'Question Bank'}</p>
                </div>
              </div>
              <StatsBanner
                total={orderedQuestions.length}
                objectives={objectives.length}
                theory={theory.length}
                compact
              />
            </div>
          </div>

          {/* ── Tab Bar ── */}
          <div className="container mx-auto px-4">
            <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
              <TabButton
                tab="select"
                activeTab={activeTab}
                onClick={setActiveTab}
                icon={<CheckSquare className="w-4 h-4" />}
                label="Select Questions"
                badge={filteredAvailableQuestions.length}
              />
              <TabButton
                tab="arrange"
                activeTab={activeTab}
                onClick={setActiveTab}
                icon={<Shuffle className="w-4 h-4" />}
                label="Arrange & Order"
                badge={orderedQuestions.length}
              />
              <TabButton
                tab="preview"
                activeTab={activeTab}
                onClick={setActiveTab}
                icon={<FileText className="w-4 h-4" />}
                label="Print Preview"
              />
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════
            TAB 1 — SELECT QUESTIONS
        ════════════════════════════════════════ */}
        {activeTab === 'select' && (
          <div className="print:hidden container mx-auto px-4 py-8 space-y-6">

            <StatsBanner
              total={orderedQuestions.length}
              objectives={objectives.length}
              theory={theory.length}
            />

            {/* Filter Card */}
            <Card className="border-slate-200 w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Filter Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="search" className="text-sm font-medium text-slate-700">Search Content</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="search"
                      placeholder="Search by text content only..."
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div>
                    <Label htmlFor="term" className="text-sm font-medium text-slate-700">Term</Label>
                    <select
                      id="term"
                      value={selectedTerm}
                      onChange={(e) => setSelectedTerm(e.target.value as any)}
                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Terms</option>
                      <option value="1">Term 1</option>
                      <option value="2">Term 2</option>
                      <option value="3">Term 3</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="topic" className="text-sm font-medium text-slate-700">Topic</Label>
                    <select
                      id="topic"
                      value={topicFilter}
                      onChange={(e) => setTopicFilter(e.target.value)}
                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Topics</option>
                      {uniqueTopics.map((topic) => (
                        <option key={topic} value={topic}>{topic}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="type" className="text-sm font-medium text-slate-700">Type</Label>
                    <select
                      id="type"
                      value={questionTypeFilter}
                      onChange={(e) => setQuestionTypeFilter(e.target.value as any)}
                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Types</option>
                      <option value="objective">Objective</option>
                      <option value="theory">Theory</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="difficulty" className="text-sm font-medium text-slate-700">Difficulty</Label>
                    <select
                      id="difficulty"
                      value={difficultyFilter}
                      onChange={(e) => setDifficultyFilter(e.target.value as any)}
                      className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div className="flex gap-2 w-full">
                    <Button
                      onClick={addAllFiltered}
                      disabled={filteredAvailableQuestions.length === 0}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      Add All ({filteredAvailableQuestions.length})
                    </Button>
                    <Button
                      onClick={removeAllSelected}
                      disabled={orderedQuestions.length === 0}
                      variant="outline"
                      className="flex-1"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Available Questions List */}
            <Card className="border-slate-200 w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Available Questions ({filteredAvailableQuestions.length})
                </CardTitle>
                {filteredAvailableQuestions.length === 0 && orderedQuestions.length > 0 && (
                  <CardDescription>All matching questions have been selected.</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {filteredAvailableQuestions.length === 0 ? (
                    <div className="text-center py-12">
                      <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">No questions match your filters</p>
                    </div>
                  ) : (
                    filteredAvailableQuestions.map((question) => (
                      <div
                        key={question.id}
                        onClick={() => toggleQuestionSelection(question)}
                        className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-blue-300 cursor-pointer transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={false}
                            readOnly
                            className="mt-1 w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{question.topic}</Badge>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${question.question_type === 'objective'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-orange-100 text-orange-800'
                                  }`}
                              >
                                {question.question_type}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${question.difficulty === 'easy'
                                  ? 'text-green-700'
                                  : question.difficulty === 'medium'
                                    ? 'text-yellow-700'
                                    : 'text-red-700'
                                  }`}
                              >
                                {question.difficulty}
                              </Badge>
                            </div>
                            <SmartText
                              content={question.question_text}
                              containsMath={question.metadata?.containsMath || false}
                            />

                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CTA to proceed */}
            {orderedQuestions.length > 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={() => setActiveTab('arrange')}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  Arrange {orderedQuestions.length} Questions
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB 2 — ARRANGE & ORDER
        ════════════════════════════════════════ */}
        {activeTab === 'arrange' && (
          <div className="print:hidden container mx-auto px-4 py-8 space-y-6">

            {/* Compact stats + quick actions */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <StatsBanner
                total={orderedQuestions.length}
                objectives={objectives.length}
                theory={theory.length}
                compact
              />
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Button
                  onClick={shuffleQuestionsList}
                  disabled={orderedQuestions.length === 0}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle Questions
                </Button>
                <Button
                  onClick={shuffleAllQuestionsOptions}
                  disabled={objectives.length === 0}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 border-purple-200"
                >
                  <Dices className="w-4 h-4" />
                  Shuffle All Options
                </Button>

                <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                <Button
                  onClick={() => setActiveTab('select')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  Back to Select
                </Button>
                <Button
                  onClick={removeAllSelected}
                  disabled={orderedQuestions.length === 0}
                  variant="outline"
                  size="sm"
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All
                </Button>
              </div>
            </div>

            {/* Drag & Drop list */}
            <Card className="border-slate-200 w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Question Order</CardTitle>
                <CardDescription>Drag questions via the handle to reorder how they appear. Adjust options locally inside each question.</CardDescription>
              </CardHeader>
              <CardContent>
                {orderedQuestions.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <Shuffle className="w-12 h-12 text-slate-200 mx-auto" />
                    <p className="text-slate-500 text-sm">No questions selected yet.</p>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('select')}>
                      Go to Select Questions
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sub-tabs switcher */}
                    <div className="flex bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/60 mb-6">
                      <button
                        type="button"
                        onClick={() => setArrangeSubTab('objectives')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${arrangeSubTab === 'objectives'
                          ? 'bg-white text-purple-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                          }`}
                      >
                        <CheckSquare className="w-4 h-4 text-purple-500" />
                        Objectives
                        <Badge
                          variant={arrangeSubTab === 'objectives' ? 'default' : 'secondary'}
                          className={arrangeSubTab === 'objectives' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
                        >
                          {objectives.length}
                        </Badge>
                      </button>
                      <button
                        type="button"
                        onClick={() => setArrangeSubTab('theory')}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${arrangeSubTab === 'theory'
                          ? 'bg-white text-orange-700 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                          }`}
                      >
                        <FileText className="w-4 h-4 text-orange-500" />
                        Theory
                        <Badge
                          variant={arrangeSubTab === 'theory' ? 'default' : 'secondary'}
                          className={arrangeSubTab === 'theory' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}
                        >
                          {theory.length}
                        </Badge>
                      </button>
                    </div>

                    {/* ── OBJECTIVES SECTION ── */}
                    {arrangeSubTab === 'objectives' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                          <h3 className="font-bold text-slate-800">Objectives</h3>
                          <Badge variant="secondary">{objectives.length}</Badge>
                        </div>

                        {objectives.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                            No objective questions selected.
                          </div>
                        ) : (
                          objectives.map((question, index) => (
                            <div
                              key={`obj-${question.id}`}
                              draggable={dragEnabledId === question.id}
                              onDragStart={(e) => {
                                if (dragEnabledId !== question.id) {
                                  e.preventDefault();
                                  return;
                                }
                                dragItemId.current = question.id;
                              }}
                              onDragEnter={() => {
                                dragOverItemId.current = question.id;
                                setDragOverId(question.id);
                              }}
                              onDragEnd={() => {
                                handleSort();
                                setDragOverId(null);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              className={`
                  p-4 border rounded-lg transition-all
                  ${dragOverId === question.id
                                  ? 'border-blue-400 bg-blue-50 scale-[1.01] shadow-md'
                                  : 'border-slate-200 bg-slate-50'
                                }
                `}
                            >
                              <div className="flex items-start gap-4">
                                {/* Drag Handle */}
                                <div className="flex flex-col items-center shrink-0">
                                  <div
                                    onMouseEnter={() => setDragEnabledId(question.id)}
                                    onMouseLeave={() => setDragEnabledId(null)}
                                    className="p-1 -ml-1 cursor-grab active:cursor-grabbing hover:bg-slate-200 rounded-md transition-colors"
                                  >
                                    <GripVertical className="w-5 h-5 text-slate-400" />
                                  </div>
                                  <span className="font-bold text-slate-400 w-6 text-center mt-1">{index + 1}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <Badge variant="outline" className="text-xs">{question.topic}</Badge>
                                    <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800">
                                      {question.question_type}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-slate-700 line-clamp-3 mb-2">
                                    <SmartText content={question.question_text} containsMath={question.metadata?.containsMath || false} />
                                  </div>

                                  {/* Options Configurator */}
                                  {question.options && question.options.length > 0 && (
                                    <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-2 max-w-2xl">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Arrange Options</span>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => shuffleSingleQuestionOptions(question.id)}
                                          className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                          <Shuffle className="w-3 h-3 mr-1" /> Shuffle Options
                                        </Button>
                                      </div>
                                      <div className="space-y-1.5">
                                        {question.options.map((opt, optIndex) => {
                                          const isCorrect = getCorrectOptionText(question.options, question.correct_answer) === opt;
                                          return (
                                            <div key={optIndex} className={`flex items-center gap-3 p-2 rounded-md border ${isCorrect ? 'border-green-300 bg-green-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                              <div className="flex flex-col gap-1 shrink-0">
                                                <button type="button" onClick={() => moveOption(question.id, optIndex, 'up')} disabled={optIndex === 0} className="text-slate-300 hover:text-blue-600 disabled:opacity-30">
                                                  <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button type="button" onClick={() => moveOption(question.id, optIndex, 'down')} disabled={optIndex === question.options.length - 1} className="text-slate-300 hover:text-blue-600 disabled:opacity-30">
                                                  <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                              <div className="text-sm font-semibold text-slate-400 shrink-0 w-6 text-center">
                                                ({String.fromCharCode(97 + optIndex)})
                                              </div>
                                              <div className="text-sm text-slate-700 flex-1">
                                                <SmartText content={opt} containsMath={question.metadata?.containsMath || false} />
                                              </div>
                                              {isCorrect && (
                                                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-[10px] shrink-0 uppercase tracking-wide">
                                                  Correct
                                                </Badge>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 mt-1">
                                  <Link
                                    href={`/teacher/question-bank/${bankId}/questions?questionId=${question.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit question"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => toggleQuestionSelection(question)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove question"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* ── THEORY SECTION ── */}
                    {arrangeSubTab === 'theory' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                          <h3 className="font-bold text-slate-800">Theory</h3>
                          <Badge variant="secondary">{theory.length}</Badge>
                        </div>

                        {theory.length === 0 ? (
                          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                            No theory questions selected.
                          </div>
                        ) : (
                          theory.map((question, index) => (
                            <div
                              key={`theory-${question.id}`}
                              draggable={dragEnabledId === question.id}
                              onDragStart={(e) => {
                                if (dragEnabledId !== question.id) {
                                  e.preventDefault();
                                  return;
                                }
                                dragItemId.current = question.id;
                              }}
                              onDragEnter={() => {
                                dragOverItemId.current = question.id;
                                setDragOverId(question.id);
                              }}
                              onDragEnd={() => {
                                handleSort();
                                setDragOverId(null);
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              className={`
                  p-4 border rounded-lg transition-all
                  ${dragOverId === question.id
                                  ? 'border-orange-400 bg-orange-50 scale-[1.01] shadow-md'
                                  : 'border-slate-200 bg-slate-50'
                                }
                `}
                            >
                              <div className="flex items-start gap-4">
                                {/* Drag Handle */}
                                <div className="flex flex-col items-center shrink-0">
                                  <div
                                    onMouseEnter={() => setDragEnabledId(question.id)}
                                    onMouseLeave={() => setDragEnabledId(null)}
                                    className="p-1 -ml-1 cursor-grab active:cursor-grabbing hover:bg-slate-200 rounded-md transition-colors"
                                  >
                                    <GripVertical className="w-5 h-5 text-slate-400" />
                                  </div>
                                  <span className="font-bold text-slate-400 w-6 text-center mt-1">
                                    {question.custom_number || index + 1}
                                  </span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <Badge variant="outline" className="text-xs">{question.topic}</Badge>
                                    <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                      {question.question_type}
                                    </Badge>
                                    <div className="ml-auto flex items-center gap-2">
                                      <Label htmlFor={`custom-num-${question.id}`} className="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                                        Custom No.
                                      </Label>
                                      <Input
                                        id={`custom-num-${question.id}`}
                                        value={question.custom_number || ''}
                                        onChange={(e) => updateCustomNumber(question.id, e.target.value)}
                                        placeholder={String(index + 1)}
                                        className="h-6 w-16 text-xs px-2"
                                      />
                                    </div>
                                  </div>
                                  <div className="text-sm text-slate-700 line-clamp-3 mb-2">
                                    <SmartText content={question.question_text} containsMath={question.metadata?.containsMath || false} />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 mt-1">
                                  <Link
                                    href={`/teacher/question-bank/${bankId}/questions?questionId=${question.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit question"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => toggleQuestionSelection(question)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove question"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  </div>
                )}
              </CardContent>
            </Card>

            {/* CTA to proceed */}
            {orderedQuestions.length > 0 && (
              <div className="flex justify-end mt-6">
                <Button
                  onClick={() => setActiveTab('preview')}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  Preview Paper
                  <FileText className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════
            TAB 3 — PRINT PREVIEW
        ════════════════════════════════════════ */}
        {activeTab === 'preview' && (
          <div className="container mx-auto px-4 py-8">

            {/* Preview controls (hidden on print) */}
            <div className="print:hidden flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Document Preview</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {objectives.length} objective{objectives.length !== 1 ? 's' : ''} · {theory.length} theory question{theory.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAnswerKey(!showAnswerKey)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${showAnswerKey
                    ? 'border-green-400 bg-green-50 text-green-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  {showAnswerKey ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {showAnswerKey ? 'Answers Visible' : 'Show Answer Key'}
                </button>
                <Button
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Paper
                </Button>
              </div>
            </div>

            {/* A4 Document */}
            <div className="bg-white p-10 md:p-16 max-w-[210mm] mx-auto shadow-2xl border border-slate-200 min-h-[297mm] print:shadow-none print:border-none print:p-0 print:max-w-none print:w-full">

              {/* School Header */}
              <div className="text-center mb-6 font-serif" style={{ fontFamily: 'Times New Roman, serif' }}>
                <h1 className="text-3xl md:text-4xl font-bold uppercase mb-1 tracking-normal">
                  {schoolName}
                </h1>
                {schoolAddress && (
                  <p className="text-sm md:text-base italic text-gray-800 font-medium">
                    {schoolAddress}
                  </p>
                )}
                {schoolPhone && (
                  <p className="text-sm md:text-base italic text-gray-800 font-medium">
                    {schoolPhone}
                  </p>
                )}
                <h2 className="text-lg md:text-xl font-bold uppercase mt-3 tracking-wide">
                  {examTitle}
                </h2>
              </div>

              {/* Student & Exam Details Header */}
              <div className="flex flex-col gap-4 text-[15px] font-bold text-black uppercase mb-8">
                {/* Row 1: Name and Class */}
                <div className="flex items-end justify-between gap-6">
                  <div className="flex items-end flex-1 gap-2">
                    <span className="whitespace-nowrap pb-0.5">NAME:</span>
                    <div className="flex-1 border-b border-black"></div>
                  </div>
                  <div className="flex items-end gap-2 whitespace-nowrap min-w-[120px]">
                    <span className="pb-0.5">CLASS:</span>
                    <span className="pb-0.5">{className}</span>
                  </div>
                </div>

                {/* Row 2: Subject and Time */}
                <div className="flex items-end justify-between gap-6">
                  <div className="flex items-end flex-1 gap-2">
                    <span className="whitespace-nowrap pb-0.5">SUBJECT:</span>
                    <span className="pb-0.5">{subjectName}</span>
                  </div>
                  <div className="flex items-end gap-2 whitespace-nowrap min-w-[120px]">
                    <span className="pb-0.5">TIME:</span>
                    {/* Empty line for time, similar to the name field */}
                    <div className="w-24 border-b border-black"></div>
                  </div>
                </div>
              </div>


              {/* Empty state */}
              {orderedQuestions.length === 0 && (
                <div className="text-center py-20 text-slate-400 print:hidden">
                  <FileText className="w-14 h-14 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No questions selected. Go back to select questions first.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setActiveTab('select')}
                  >
                    Select Questions
                  </Button>
                </div>
              )}

              {/* Objectives Section */}
              {objectives.length > 0 && (
                <div className="mb-8">
                  <div className="text-center font-bold text-lg mb-4">Objectives</div>
                  <div className="space-y-4">
                    {objectives.map((question, index) => (
                      <div key={question.id} className="text-base text-black flex items-start gap-2">
                        <span className="font-bold shrink-0">{index + 1}.</span>
                        <div className="flex-1">
                          <div className="inline">
                            <SmartText
                              content={question.question_text}
                              containsMath={question.metadata?.containsMath || false}
                            />
                          </div>
                          <div className="inline-flex flex-wrap gap-x-6 gap-y-1 mt-1 ml-2">
                            {question.options.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-1">
                                <span>({String.fromCharCode(97 + optIndex)})</span>
                                <SmartText
                                  content={option}
                                  containsMath={question.metadata?.containsMath || false}
                                />
                              </div>
                            ))}
                          </div>
                          {showAnswerKey && question.correct_answer && (
                            <div className="mt-1 p-1 bg-green-50 border border-green-200 text-sm print:hidden">
                              <span className="font-bold text-green-700">Answer: </span>
                              {question.correct_answer}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Theory Section */}
              {theory.length > 0 && (
                <div className="mt-8">
                  <div className="text-center font-bold text-lg mb-4">Theory</div>
                  <div className="space-y-6">
                    {theory.map((question, index) => (
                      <div key={question.id} className="text-base text-black flex items-start gap-2">

                        {/* UPDATED: Check for custom_number, fallback to fresh sequential index */}
                        <span className="font-bold shrink-0">
                          {question.custom_number ? `${question.custom_number}.` : `${index + 1}.`}
                        </span>

                        <div className="flex-1">
                          <div className="inline">
                            <SmartText
                              content={question.question_text}
                              containsMath={question.metadata?.containsMath || false}
                            />
                          </div>
                          {showAnswerKey && question.explanation && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 text-sm print:hidden">
                              <span className="font-bold text-green-700 block mb-1">Solution:</span>
                              <SmartText
                                content={question.explanation}
                                containsMath={question.metadata?.containsMath || false}
                              />
                            </div>
                          )}
                          {/* Writing lines for students */}
                          <div className="mt-6 border-b border-dashed border-gray-400 pt-8 w-full" />
                          <div className="mt-8 border-b border-dashed border-gray-400 pt-8 w-full" />
                          <div className="mt-8 border-b border-dashed border-gray-400 pt-8 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}