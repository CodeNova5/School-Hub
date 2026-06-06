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
      {/* ── Print-Specific Styles ── */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide the Dashboard layout and left panel */
          body * {
            visibility: hidden;
          }
          /* Only show the print container and its children */
          #exam-print-container, #exam-print-container * {
            visibility: visible;
          }
          #exam-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          /* Hide Next.js default overlays */
          nextjs-portal { display: none !important; }
          
          /* Paper formatting */
          @page {
            size: A4;
            margin: 20mm;
          }
          
          .no-print {
            display: none !important;
          }
          
          /* Prevent page breaks inside questions */
          .question-block {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}} />

      <div className="w-full h-[calc(100vh-8rem)] flex flex-col no-print">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-gray-500 hover:text-gray-900"
              onClick={() => router.push(`/teacher/question-bank/${bankId}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Print Exam Paper</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showAnswerKey ? 'default' : 'outline'}
              onClick={() => setShowAnswerKey(!showAnswerKey)}
              className={showAnswerKey ? 'bg-amber-600 hover:bg-amber-700' : ''}
            >
              {showAnswerKey ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showAnswerKey ? 'Hide Answers' : 'Show Answers'}
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="h-4 w-4 mr-2" />
              Print Paper
            </Button>
          </div>
        </div>

        {/* Two Panel Layout */}
        <div className="flex gap-6 h-full min-h-0">
          
          {/* Left Panel: Question Selection */}
          <Card className="w-[450px] flex flex-col shrink-0 h-full border-gray-200">
            <CardHeader className="pb-4 shrink-0">
              <CardTitle>Select Questions</CardTitle>
              <CardDescription>
                {selectedQuestionIds.length} selected from {questions.length} total
              </CardDescription>
              
              <div className="space-y-3 mt-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    placeholder="Search questions..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={selectedTerm}
                    onChange={(e) => setSelectedTerm(e.target.value as any)}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none"
                  >
                    <option value="all">All Terms</option>
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                  <select
                    value={questionTypeFilter}
                    onChange={(e) => setQuestionTypeFilter(e.target.value as any)}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none"
                  >
                    <option value="all">All types</option>
                    <option value="objective">Objective</option>
                    <option value="theory">Theory</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-0 border-t border-gray-100">
              
              {/* Selected Tab / View */}
              {orderedQuestions.length > 0 && (
                <div className="p-4 border-b border-gray-100 bg-blue-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-blue-900">Selected ({orderedQuestions.length})</h3>
                    <Button variant="ghost" size="sm" onClick={removeAllSelected} className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50">
                      Clear All
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {orderedQuestions.map((q, index) => (
                      <div
                        key={q.id}
                        draggable
                        onDragStart={() => (dragItem.current = index)}
                        onDragEnter={() => (dragOverItem.current = index)}
                        onDragEnd={handleSort}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex items-start gap-2 p-2 bg-white rounded border border-gray-200 shadow-sm cursor-move hover:border-blue-300 transition-colors"
                      >
                        <GripVertical className="h-4 w-4 text-gray-400 mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            <SmartText content={q.question_text} containsMath={!!q.metadata?.containsMath} />
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">{q.question_type}</Badge>
                            <span className="text-[10px] text-gray-500 truncate">{q.topic}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleQuestionSelection(q)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Questions List */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">Available Questions</h3>
                  {filteredAvailableQuestions.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={addAllFiltered} className="h-6 text-xs text-blue-600 hover:bg-blue-50">
                      Select All
                    </Button>
                  )}
                </div>
                
                {filteredAvailableQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No available questions match filters.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredAvailableQuestions.map(q => (
                      <div 
                        key={q.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleQuestionSelection(q)}
                      >
                        <input 
                          type="checkbox" 
                          checked={selectedQuestionIds.includes(q.id)}
                          readOnly
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 line-clamp-2">
                            <SmartText content={q.question_text} containsMath={!!q.metadata?.containsMath} />
                          </p>
                          <div className="flex gap-2 mt-1.5">
                            <span className="text-[10px] uppercase font-medium text-gray-500">{q.question_type}</span>
                            <span className="text-[10px] text-gray-400 truncate">&bull; {q.topic}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right Panel: Exam Paper Preview */}
          <div className="flex-1 flex flex-col h-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            {/* Toolbar for config */}
            <div className="bg-white border-b border-gray-200 p-4 shrink-0 grid grid-cols-2 gap-4 overflow-y-auto max-h-[30vh]">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">School Name</Label>
                  <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tagline</Label>
                  <Input value={schoolTagline} onChange={e => setSchoolTagline(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address / Contact</Label>
                  <Input value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={schoolPhone} onChange={e => setSchoolPhone(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Exam Title (e.g. Second Term)</Label>
                  <Input value={examTitle} onChange={e => setExamTitle(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input value={subjectName} onChange={e => setSubjectName(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Class</Label>
                    <Input value={className} onChange={e => setClassName(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>
              </div>
            </div>

            {/* A4 Paper Container */}
            <div className="flex-1 overflow-y-auto p-8 bg-gray-100 flex justify-center">
              
              {/* This is the container that actually gets printed */}
              <div 
                id="exam-print-container"
                className="bg-white w-[210mm] min-h-[297mm] shadow-lg p-[20mm] text-black font-serif print:shadow-none print:w-full print:min-h-0 print:p-0"
              >
                {/* Exam Header exactly as in the image */}
                <div className="text-center mb-6 border-b-2 border-black pb-4">
                  {schoolLogo && (
                    <div className="flex justify-center mb-3">
                      <img src={schoolLogo} alt="School Logo" className="h-16 w-auto object-contain" />
                    </div>
                  )}
                  <h1 className="text-3xl font-bold uppercase tracking-wider mb-1" style={{ fontFamily: 'Times New Roman, serif' }}>
                    {schoolName}
                  </h1>
                  {schoolTagline && <div className="text-sm italic mb-1">{schoolTagline}</div>}
                  <div className="text-sm">{schoolAddress}</div>
                  <div className="text-sm mb-3">{schoolPhone}</div>
                  
                  <h2 className="text-xl font-bold mb-4">{examTitle}</h2>

                  <div className="flex justify-between font-bold text-lg px-4 uppercase">
                    <div>SUBJECT: {subjectName}</div>
                    <div>CLASS: {className}</div>
                  </div>
                </div>

                {/* Main Content */}
                {orderedQuestions.length === 0 ? (
                  <div className="text-center text-gray-400 py-20 italic no-print">
                    Select questions from the left panel to build your exam paper.
                  </div>
                ) : (
                  <div className="space-y-8">
                    
                    {/* Objectives Section */}
                    {objectives.length > 0 && (
                      <div>
                        <h3 className="text-center font-bold text-lg mb-4">Objectives</h3>
                        <div className="space-y-4">
                          {objectives.map((q, i) => (
                            <div key={q.id} className="question-block text-[15px] leading-relaxed flex gap-3">
                              <span className="font-medium shrink-0">{i + 1}.</span>
                              <div className="w-full">
                                {/* Question Text */}
                                <div>
                                  <SmartText content={q.question_text} containsMath={!!q.metadata?.containsMath} />
                                </div>
                                {/* Options rendered inline standard style */}
                                {q.options.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
                                    {q.options.map((opt, optIdx) => {
                                      const letter = String.fromCharCode(97 + optIdx); // a, b, c, d
                                      const isCorrect = showAnswerKey && q.correct_answer?.toLowerCase() === String.fromCharCode(65 + optIdx).toLowerCase();
                                      
                                      return (
                                        <div key={optIdx} className={`flex gap-1 items-baseline ${isCorrect ? 'text-amber-600 font-bold underline' : ''}`}>
                                          <span>({letter})</span>
                                          <SmartText content={opt} containsMath={!!q.metadata?.containsMath} />
                                        </div>
                                      )
                                    })}
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
                      <div className={objectives.length > 0 ? "pt-8" : ""}>
                        <h3 className="text-center font-bold text-lg mb-4">Theory</h3>
                        <div className="space-y-12">
                          {theory.map((q, i) => (
                            <div key={q.id} className="question-block text-[15px] leading-relaxed flex gap-3">
                              <span className="font-medium shrink-0">{i + 1}.</span>
                              <div className="w-full">
                                <div>
                                  <SmartText content={q.question_text} containsMath={!!q.metadata?.containsMath} />
                                </div>
                                {showAnswerKey && q.explanation && (
                                  <div className="mt-4 p-4 border border-amber-500 bg-amber-50 rounded text-amber-900 text-sm">
                                    <div className="font-bold mb-1">Answer/Marking Guide:</div>
                                    <SmartText content={q.explanation} containsMath={!!q.metadata?.containsMath} />
                                  </div>
                                )}
                                {!showAnswerKey && (
                                  <div className="mt-8 space-y-8">
                                    {/* Generate empty lines for student to write answers */}
                                    <div className="border-b border-gray-300 w-full h-1"></div>
                                    <div className="border-b border-gray-300 w-full h-1"></div>
                                    <div className="border-b border-gray-300 w-full h-1"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
