"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, GripVertical, Printer, Eye, EyeOff, Search } from 'lucide-react';
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

function inferTopicGroupTerm(group: TopicGroupRecord) {
  if (group.term) return group.term;
  const label = group.title.trim().toLowerCase();
  if (/\b(1st|first|term\s*1|term\s*one)\b/.test(label)) return '1';
  if (/\b(2nd|second|term\s*2|term\s*two)\b/.test(label)) return '2';
  if (/\b(3rd|third|term\s*3|term\s*three)\b/.test(label)) return '3';
  return undefined;
}

// --- Main Component ---
export default function ExamPrintPage() {
  const params = useParams<{ bankId: string }>();
  const router = useRouter();
  const bankId = typeof params?.bankId === 'string' ? params.bankId : Array.isArray(params?.bankId) ? params.bankId[0] : '';
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [isLoading, setIsLoading] = useState(true);
  const [bank, setBank] = useState<BankRecord | null>(null);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [topicGroups, setTopicGroups] = useState<TopicGroupRecord[]>([]);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [orderedQuestions, setOrderedQuestions] = useState<QuestionRecord[]>([]);

  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedTerm, setSelectedTerm] = useState<'all' | '1' | '2' | '3'>('all');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'objective' | 'theory'>('all');

  const [schoolName, setSchoolName] = useState('');
  const [schoolTagline, setSchoolTagline] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [examTitle, setExamTitle] = useState('Second term examination');
  const [subjectName, setSubjectName] = useState('');
  const [className, setClassName] = useState('');

  const [showAnswerKey, setShowAnswerKey] = useState(false);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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
      const matchesSearch = !query || question.topic.toLowerCase().includes(query) || question.question_text.toLowerCase().includes(query);
      const matchesType = questionTypeFilter === 'all' || question.question_type === questionTypeFilter;
      const matchesTerm = selectedTerm === 'all' || termTopics.includes(question.topic.trim().toLowerCase());
      return matchesSearch && matchesType && matchesTerm;
    });
  }, [questions, questionSearch, questionTypeFilter, selectedTerm, termTopics, selectedQuestionIds]);

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
    setSelectedQuestionIds(prev => [...prev, ...filteredAvailableQuestions.map(q => q.id)]);
    setOrderedQuestions(prev => [...prev, ...filteredAvailableQuestions]);
  }

  function removeAllSelected() {
    setSelectedQuestionIds([]);
    setOrderedQuestions([]);
  }

  const handleSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    let _orderedQuestions = [...orderedQuestions];
    const draggedItemContent = _orderedQuestions.splice(dragItem.current, 1)[0];
    _orderedQuestions.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
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

  const objectives = orderedQuestions.filter(q => q.question_type === 'objective');
  const theory = orderedQuestions.filter(q => q.question_type === 'theory');

  // --- Core Reusable Exam Paper Template Layout ---
  const ExamPaperTemplate = () => (
    <div className="bg-white text-black p-8 sm:p-12 font-sans selection:bg-gray-200">
      {/* School Header */}
      <div className="text-center mb-6 pb-4 border-b-2 border-black">
        {schoolLogo && <img src={schoolLogo} alt="School Logo" className="h-14 mx-auto mb-2 object-contain" />}
        <h1 className="text-2xl font-black tracking-wide uppercase text-gray-900">{schoolName || "XARIS SCHOOL"}</h1>
        <p className="text-xs font-medium text-gray-700 italic max-w-md mx-auto mt-0.5">{schoolTagline}</p>
        <p className="text-xs font-semibold text-gray-800 mt-1 uppercase tracking-tight">{schoolAddress}</p>
        {schoolPhone && <p className="text-xs font-medium text-gray-800">Tel: {schoolPhone}</p>}
        <h2 className="text-lg font-bold text-gray-900 mt-3 capitalize tracking-wide">{examTitle}</h2>
      </div>

      {/* Meta info matching questions.jpg */}
      <div className="flex justify-between items-center text-sm font-bold border-b border-gray-400 pb-2 mb-6 tracking-wide">
        <span>SUBJECT: {subjectName.toUpperCase() || "SOCIAL STUDIES"}</span>
        <span>CLASS: {className.toUpperCase() || "J S S 3"}</span>
      </div>

      {/* Objectives Section */}
      {objectives.length > 0 && (
        <div className="mb-10">
          <div className="text-center text-base font-extrabold uppercase tracking-widest mb-6">
            Objectives
          </div>
          <div className="space-y-4">
            {objectives.map((question, index) => (
              <div key={question.id} className="text-[13px] leading-relaxed text-gray-900">
                <div className="flex items-start">
                  <span className="font-bold min-w-[24px]">{index + 1}.</span>
                  <div className="flex-1 pl-1">
                    <SmartText
                      content={question.question_text}
                      containsMath={question.metadata?.containsMath || false}
                    />
                  </div>
                </div>

                {/* Grid layout for Options cleanly formatted inline */}
                {question.options && question.options.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2 pl-6 font-medium text-gray-800">
                    {question.options.map((option, optIndex) => (
                      <div key={optIndex} className="flex items-start">
                        <span className="font-bold mr-1">({String.fromCharCode(97 + optIndex)})</span>
                        <span>
                          <SmartText content={option} containsMath={question.metadata?.containsMath || false} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {showAnswerKey && question.correct_answer && (
                  <div className="mt-2 ml-6 p-2 bg-green-50 border border-green-200 text-xs font-semibold text-green-700 rounded">
                    Key Answer: {question.correct_answer}
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
          <div className="text-center text-base font-extrabold uppercase tracking-widest mb-6 pt-4 border-t border-gray-300">
            Theory / Essay
          </div>
          <div className="space-y-6">
            {theory.map((question, index) => (
              <div key={question.id} className="text-[13px] leading-relaxed text-gray-900">
                <div className="flex items-start">
                  <span className="font-bold min-w-[24px]">{objectives.length + index + 1}.</span>
                  <div className="flex-1 pl-1 font-semibold">
                    <SmartText
                      content={question.question_text}
                      containsMath={question.metadata?.containsMath || false}
                    />
                  </div>
                </div>

                {showAnswerKey && question.explanation && (
                  <div className="ml-6 mt-2 p-3 bg-blue-50 border border-blue-200 text-xs text-gray-800 rounded">
                    <p className="font-bold text-blue-800 mb-1">Marking Guide / Explanation:</p>
                    <SmartText content={question.explanation} containsMath={question.metadata?.containsMath || false} />
                  </div>
                )}

                {/* Simulated handwritten lines space below theories */}
                <div className="ml-6 mt-4 space-y-3 opacity-40 printing:hidden">
                  <div className="border-b border-dashed border-gray-400 h-1 w-full" />
                  <div className="border-b border-dashed border-gray-400 h-1 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout role="teacher">
      <div className="min-h-screen bg-slate-100 print:bg-white print:p-0">

        {/* Sticky Control Header */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm print:hidden">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Exam Paper Builder</h1>
                <p className="text-xs text-slate-500">{bank?.title || 'Question Bank'}</p>
              </div>
            </div>
            <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm">
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        {/* Dynamic Split Screen View Workspace */}
        <div className="max-w-[1600px] mx-auto p-4 lg:p-6 print:p-0 grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT SIDEBAR: Configurations & Question Selections */}
          <div className="lg:col-span-5 space-y-6 print:hidden">

            {/* School details setup */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3"><CardTitle className="text-base font-bold">Header Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">School Name</Label>
                    <Input size={32} value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. XARIS SCHOOL" className="text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-600">Exam Title</Label>
                    <Input value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="Second term examination" className="text-xs mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600">Address Details</Label>
                  <Input value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} placeholder="367, ojoigbede road, lagos" className="text-xs mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs font-semibold text-slate-600">Tagline / Motto</Label><Input value={schoolTagline} onChange={(e) => setSchoolTagline(e.target.value)} placeholder="Nursery & Basic College" className="text-xs mt-1" /></div>
                  <div><Label className="text-xs font-semibold text-slate-600">Phone lines</Label><Input value={schoolPhone} onChange={(e) => setSchoolPhone(e.target.value)} placeholder="0803325..." className="text-xs mt-1" /></div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAnswerKey(!showAnswerKey)} className="w-full mt-2 gap-2 text-xs font-medium">
                  {showAnswerKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showAnswerKey ? 'Hide Answer Key Details' : 'Preview Answer Key Data'}
                </Button>
              </CardContent>
            </Card>

            {/* Quick Filter Section */}
            <Card className="shadow-sm border-slate-200">
              <CardContent className="pt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  <Input placeholder="Quick search question repository..." value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} className="pl-9 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value as any)} className="w-full p-2 border border-slate-200 rounded-md text-xs bg-white">
                    <option value="all">All Academic Terms</option>
                    <option value="1">Term 1</option><option value="2">Term 2</option><option value="3">Term 3</option>
                  </select>
                  <select value={questionTypeFilter} onChange={(e) => setQuestionTypeFilter(e.target.value as any)} className="w-full p-2 border border-slate-200 rounded-md text-xs bg-white">
                    <option value="all">Objective & Theory</option>
                    <option value="objective">Objective Only</option>
                    <option value="theory">Theory Only</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={addAllFiltered} disabled={filteredAvailableQuestions.length === 0} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    Add Filtered ({filteredAvailableQuestions.length})
                  </Button>
                  <Button size="sm" variant="outline" onClick={removeAllSelected} disabled={orderedQuestions.length === 0} className="flex-1 text-xs text-rose-600 hover:bg-rose-50">
                    Clear Active Paper
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Selection list pool */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2 py-3 border-b"><CardTitle className="text-xs font-bold text-slate-700">Available Questions Pool ({filteredAvailableQuestions.length})</CardTitle></CardHeader>
              <CardContent className="p-0 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredAvailableQuestions.length === 0 ? (
                  <p className="text-xs text-center py-6 text-slate-400 font-medium">No valid items remaining under active filter.</p>
                ) : (
                  filteredAvailableQuestions.map((question) => (
                    <div key={question.id} onClick={() => toggleQuestionSelection(question)} className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-start gap-2.5">
                      <input type="checkbox" checked={false} readOnly className="mt-0.5 rounded border-slate-300 accent-blue-600" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 px-1">{question.question_type}</Badge>
                          <span className="text-[10px] text-slate-400 font-medium line-clamp-1">{question.topic}</span>
                        </div>
                        <p className="text-xs text-slate-700 font-medium line-clamp-2">{question.question_text}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Rearranger tool block */}
            {orderedQuestions.length > 0 && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-2 py-3 border-b">
                  <CardTitle className="text-xs font-bold text-slate-700">Sort Blueprint Order (Drag items)</CardTitle>
                </CardHeader>
                <CardContent className="p-2 max-h-72 overflow-y-auto space-y-1.5">
                  {orderedQuestions.map((question, index) => (
                    <div key={question.id} draggable onDragStart={() => (dragItem.current = index)} onDragEnter={() => (dragOverItem.current = index)} onDragEnd={handleSort} onDragOver={(e) => e.preventDefault()} className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-400 w-4">{index + 1}</span>
                        <p className="text-xs text-slate-700 truncate font-medium">{question.question_text}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); toggleQuestionSelection(question); }} className="text-[11px] text-rose-500 hover:underline px-1 font-semibold shrink-0">
                        Remove
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT SIDEBAR: The Live Layout View Container */}
          <div className="lg:col-span-7 space-y-4 print:col-span-12">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1 print:hidden flex items-center justify-between">
              <span> Live Print Sheet View Preview</span>
              <span className="text-slate-500 font-medium lowercase">({orderedQuestions.length} items appended)</span>
            </div>

            {/* Live Container Preview Wrapper */}
            <div className="rounded-xl border border-slate-200 shadow-md bg-white print:border-none print:shadow-none overflow-hidden max-w-3xl mx-auto w-full">
              <ExamPaperTemplate />
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}