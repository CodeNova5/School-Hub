"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, GripVertical, Printer, Eye, EyeOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// --- Shared Types & Helpers (from page.tsx) ---

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

function inferTopicGroupTerm(group: TopicGroupRecord) {
  if (group.term) return group.term;
  const label = group.title.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';
  return undefined;
}

// --- Print Page Component ---

export default function ExamPrintPage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [isLoading, setIsLoading] = useState(true);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);

  // Selection & Ordering
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  // We'll maintain an ordered list of the selected questions
  const [orderedQuestions, setOrderedQuestions] = useState<QuestionRecord[]>([]);

  // Filters
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'all' | '1' | '2' | '3'>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'objective' | 'theory'>('all');

  // Exam Paper Config
  const [schoolName, setSchoolName] = useState('');
  const [schoolTagline, setSchoolTagline] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [examTitle, setExamTitle] = useState('Second term examination');
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');

  const [showAnswerKey, setShowAnswerKey] = useState(false);

  // Drag & Drop State
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  useEffect(() => {
    if (bankId) {
      loadData();
    }
  }, [bankId]);

  useEffect(() => {
    if (schoolId) {
      fetchSchoolDetails(schoolId);
    }
  }, [schoolId]);

  async function fetchSchoolDetails(id: string) {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('name, address, phone, logo_url')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setSchoolName(data.name || '');
        setSchoolAddress(data.address || '');
        setSchoolPhone(data.phone || '');
        setSchoolLogo(data.logo_url || '');
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
        fetch('/api/teacher/question-bank/context')
      ]);

      const bankData = await bankRes.json();
      const questionsData = await questionsRes.json();
      const groupsData = await groupsRes.json();
      const contextData = await contextRes.json();

      if (!bankRes.ok) throw new Error('Bank not found');

      setBank(bankData.bank);
      setQuestions(questionsData.questions || []);
      setTopicGroups(groupsData.groups || []);

      // Try to extract subject and class from context based on subject_class_id
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
      // Don't show already selected questions in the available list
      if (selectedQuestionIds.includes(question.id)) return false;

      const matchesSearch =
        !query ||
        question.topic.toLowerCase().includes(query) ||
        question.question_text.toLowerCase().includes(query);
      const matchesType = questionTypeFilter === 'all' || question.question_type === questionTypeFilter;
      const matchesTerm =
        selectedTerm === 'all' || termTopics.includes(question.topic.trim().toLowerCase());

      return matchesSearch && matchesType && matchesTerm;
    });
  }, [questions, questionSearch, questionTypeFilter, selectedTerm, termTopics, selectedQuestionIds]);


  // Handlers
  function toggleQuestionSelection(question: QuestionRecord) {
    if (selectedQuestionIds.includes(question.id)) {
      setSelectedQuestionIds(prev => prev.filter(id => id !== question.id));
      setOrderedQuestions(prev => prev.filter(q => q.id !== question.id));
    } else {
      setSelectedQuestionIds(prev => [...prev, question.id]);
      setOrderedQuestions(prev => [...prev, question]);
    }
  }

  function addAllFiltered() {
    const idsToAdd = filteredAvailableQuestions.map(q => q.id);
    setSelectedQuestionIds(prev => [...prev, ...idsToAdd]);
    setOrderedQuestions(prev => [...prev, ...filteredAvailableQuestions]);
  }

  function removeAllSelected() {
    setSelectedQuestionIds([]);
    setOrderedQuestions([]);
  }

  // Drag and Drop reordering
  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;

    // duplicate items
    let _orderedQuestions = [...orderedQuestions];

    // remove and save the dragged item content
    const draggedItemContent = _orderedQuestions.splice(dragItem.current, 1)[0];

    // switch the position
    _orderedQuestions.splice(dragOverItem.current, 0, draggedItemContent);

    // reset the position ref
    dragItem.current = null;
    dragOverItem.current = null;

    // update the actual array
    setOrderedQuestions(_orderedQuestions);
  };

  const handlePrint = () => {
    window.print();
  };


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

  // Separate objectives and theory for rendering
  const objectives = orderedQuestions.filter(q => q.question_type === 'objective');
  const theory = orderedQuestions.filter(q => q.question_type === 'theory');

  return (
    <DashboardLayout role="teacher">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
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
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Printer className="w-4 h-4" />
                Print Paper
              </button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          <div className="space-y-8">
            {/* Configuration Cards - Full Width Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* School Details Card */}
              <Card className="border-slate-200 lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">School Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="schoolName" className="text-sm font-medium text-slate-700">
                      School Name
                    </Label>
                    <Input
                      id="schoolName"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      placeholder="Enter school name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="schoolTagline" className="text-sm font-medium text-slate-700">
                      Tagline
                    </Label>
                    <Input
                      id="schoolTagline"
                      value={schoolTagline}
                      onChange={(e) => setSchoolTagline(e.target.value)}
                      placeholder="School motto or tagline"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="schoolAddress" className="text-sm font-medium text-slate-700">
                      Address
                    </Label>
                    <Input
                      id="schoolAddress"
                      value={schoolAddress}
                      onChange={(e) => setSchoolAddress(e.target.value)}
                      placeholder="School address"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="schoolPhone" className="text-sm font-medium text-slate-700">
                      Phone
                    </Label>
                    <Input
                      id="schoolPhone"
                      value={schoolPhone}
                      onChange={(e) => setSchoolPhone(e.target.value)}
                      placeholder="School phone"
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Exam Config Card */}
              <Card className="border-slate-200 lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Exam Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="examTitle" className="text-sm font-medium text-slate-700">
                      Exam Title
                    </Label>
                    <Input
                      id="examTitle"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g., Second Term Examination"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="subject" className="text-sm font-medium text-slate-700">
                        Subject
                      </Label>
                      <Input
                        id="subject"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="Subject name"
                        className="mt-1"
                        disabled
                      />
                    </div>
                    <div>
                      <Label htmlFor="className" className="text-sm font-medium text-slate-700">
                        Class
                      </Label>
                      <Input
                        id="className"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="e.g., JSS 1"
                        className="mt-1"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg">
                    <button
                      onClick={() => setShowAnswerKey(!showAnswerKey)}
                      className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      {showAnswerKey ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                      {showAnswerKey ? 'Hide' : 'Show'} Answer Key
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Selection Stats */}
              <Card className="border-slate-200 bg-blue-50 md:col-span-2 lg:col-span-4">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Selected Questions:</span>
                      <Badge variant="default" className="bg-blue-600">
                        {orderedQuestions.length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Objectives:</span>
                      <Badge variant="outline">{objectives.length}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600">Theory:</span>
                      <Badge variant="outline">{theory.length}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            {/* Filters - Full Width */}
            <Card className="border-slate-200 w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Filter Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div>
                  <Label htmlFor="search" className="text-sm font-medium text-slate-700">
                    Search
                  </Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="search"
                      placeholder="Search by topic or content..."
                      value={questionSearch}
                      onChange={(e) => setQuestionSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Term Filter */}
                  <div>
                    <Label htmlFor="term" className="text-sm font-medium text-slate-700">
                      Term
                    </Label>
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

                  {/* Question Type Filter */}
                  <div>
                    <Label htmlFor="type" className="text-sm font-medium text-slate-700">
                      Type
                    </Label>
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

                  {/* Bulk Actions */}
                  <div className="flex gap-2 mt-6">
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

            {/* Available Questions - Full Width */}
            <Card className="border-slate-200 w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Available Questions ({filteredAvailableQuestions.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredAvailableQuestions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500">No questions match your filters</p>
                    </div>
                  ) : (
                    filteredAvailableQuestions.map((question) => (
                      <div
                        key={question.id}
                        onClick={() => toggleQuestionSelection(question)}
                        className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
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
                              <Badge variant="outline" className="text-xs">
                                {question.topic}
                              </Badge>
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
                            <p className="text-sm text-slate-700 mt-2 line-clamp-2">
                              {question.question_text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Selected Questions Order - Full Width */}
            {orderedQuestions.length > 0 && (
              <Card className="border-slate-200 w-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Question Order (Drag to Reorder)</CardTitle>
                  <CardDescription>Arrange questions in the order they should appear on the exam</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {orderedQuestions.map((question, index) => (
                      <div
                        key={question.id}
                        draggable
                        onDragStart={() => (dragItem.current = index)}
                        onDragEnter={() => (dragOverItem.current = index)}
                        onDragEnd={handleSort}
                        onDragOver={(e) => e.preventDefault()}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-3 pt-1">
                            <GripVertical className="w-5 h-5 text-slate-400" />
                            <span className="font-bold text-slate-400 w-6 text-center">{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge variant="outline" className="text-xs">
                                {question.topic}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${question.question_type === 'objective'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-orange-100 text-orange-800'
                                  }`}
                              >
                                {question.question_type}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-700">
                              <SmartText
                                content={question.question_text}
                                containsMath={question.metadata?.containsMath || false}
                              />
                            </p>
                          </div>
                          <button
                            onClick={() => toggleQuestionSelection(question)}
                            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors whitespace-nowrap"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Print Preview - Hidden from View but Shown on Print */}
        <div className="hidden print:block mt-12 bg-white p-12 max-w-4xl mx-auto">
          {/* School Header */}
          <div className="text-center mb-4 pb-4 border-b border-slate-800">
            {schoolLogo && (
              <img
                src={schoolLogo}
                alt="School Logo"
                className="h-12 mx-auto mb-2"
              />
            )}
            <h1 className="text-xl font-bold text-slate-900">{schoolName}</h1>
            {schoolTagline && (
              <p className="text-xs text-slate-600 mt-1">{schoolTagline}</p>
            )}
            <p className="text-xs text-slate-600 mt-1">{schoolAddress}</p>
            <p className="text-xs text-slate-600">{schoolPhone}</p>
          </div>

          {/* Exam Title */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2">{examTitle}</h2>
            <div className="flex justify-between text-sm font-semibold text-slate-900">
              <span>SUBJECT: {subjectName.toUpperCase()}</span>
              <span>CLASS: {className.toUpperCase()}</span>
            </div>
          </div>

          {/* Objectives Section */}
          {objectives.length > 0 && (
            <div className="mb-8">
              <div className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-400">
                Objectives
              </div>
              <div className="space-y-3">
                {objectives.map((question, index) => (
                  <div key={question.id} className="text-sm">
                    <div className="mb-2">
                      <span className="font-bold">{index + 1}.</span>
                      <span className="ml-2">
                        <SmartText
                          content={question.question_text}
                          containsMath={question.metadata?.containsMath || false}
                        />
                      </span>
                    </div>
                    <div className="ml-6 space-y-1">
                      {question.options.map((option, optIndex) => (
                        <div key={optIndex} className="text-sm text-slate-800">
                          <span className="font-semibold">({String.fromCharCode(97 + optIndex)})</span>
                          <span className="ml-2">
                            <SmartText
                              content={option}
                              containsMath={question.metadata?.containsMath || false}
                            />
                          </span>
                        </div>
                      ))}
                    </div>

                    {showAnswerKey && question.correct_answer && (
                      <div className="mt-2 ml-6 p-2 bg-green-50 border-l-4 border-green-500 text-xs">
                        <p className="font-semibold text-green-700">
                          Answer: {question.correct_answer}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Theory Section */}
          {theory.length > 0 && (
            <div>
              <div className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-400">
                Theory
              </div>
              <div className="space-y-6">
                {theory.map((question, index) => (
                  <div key={question.id} className="text-sm">
                    <div className="mb-3">
                      <span className="font-bold">{objectives.length + index + 1}.</span>
                      <span className="ml-2">
                        <SmartText
                          content={question.question_text}
                          containsMath={question.metadata?.containsMath || false}
                        />
                      </span>
                    </div>

                    {showAnswerKey && question.explanation && (
                      <div className="ml-6 p-2 bg-green-50 border-l-4 border-green-500 mb-3 text-xs">
                        <p className="font-semibold text-green-700 mb-1">Solution:</p>
                        <div className="text-green-700">
                          <SmartText
                            content={question.explanation}
                            containsMath={question.metadata?.containsMath || false}
                          />
                        </div>
                      </div>
                    )}

                    {/* Space for students to write */}
                    <div className="ml-6 mt-4 border-t border-dashed border-slate-400 pt-4 min-h-32" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}