"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SelectedQuizQuestion } from "@/lib/types";
import {
  Loader2,
  BookOpen,
  Search,
  ChevronRight,
  ChevronDown,
  Plus,
  AlertCircle,
  Clock,
  Shuffle,
  RotateCcw,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface QuestionBank {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  question_count?: number;
}

interface QuestionItem {
  id: string;
  topic: string;
  question_text: string;
  options: { label: string; value: string }[];
  difficulty: string;
  marks: number;
}

interface QuizBuilderProps {
  schoolId: string;
  teacherId: string;
  subjectClassId: string;
  selectedQuestions: SelectedQuizQuestion[];
  onQuestionsChange: (questions: SelectedQuizQuestion[]) => void;
  quizConfig: {
    shuffle_questions: boolean;
    time_limit_minutes: number | null;
    allow_retake: boolean;
    show_results_immediately: boolean;
  };
  onConfigChange: (config: {
    shuffle_questions: boolean;
    time_limit_minutes: number | null;
    allow_retake: boolean;
    show_results_immediately: boolean;
  }) => void;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export function AssignmentQuizBuilder({
  schoolId,
  teacherId,
  subjectClassId,
  selectedQuestions,
  onQuestionsChange,
  quizConfig,
  onConfigChange,
}: QuizBuilderProps) {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBank, setExpandedBank] = useState<string | null>(null);
  const [bankQuestionCounts, setBankQuestionCounts] = useState<Record<string, number>>({});

  /* ---------------------------------------------------------------------- */
  /* Load banks for this subject class                                      */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!schoolId || !subjectClassId) return;
    loadBanks();
  }, [schoolId, subjectClassId]);

  async function loadBanks() {
    setLoadingBanks(true);
    try {
      const { data: banksData, error } = await supabase
        .from("teacher_question_banks")
        .select("id, title, description, visibility")
        .eq("school_id", schoolId)
        .eq("subject_class_id", subjectClassId)
        .order("title", { ascending: true });

      if (error) throw error;
      setBanks(banksData || []);

      // Get question counts per bank
      if (banksData && banksData.length > 0) {
        const bankIds = banksData.map((b: any) => b.id);
        const { data: counts } = await supabase
          .from("teacher_questions")
          .select("bank_id, id")
          .eq("school_id", schoolId)
          .eq("question_type", "objective")
          .in("bank_id", bankIds);

        if (counts) {
          const countMap: Record<string, number> = {};
          counts.forEach((c: any) => {
            countMap[c.bank_id] = (countMap[c.bank_id] || 0) + 1;
          });
          setBankQuestionCounts(countMap);
        }
      }
    } catch (err: any) {
      toast.error("Failed to load question banks");
    } finally {
      setLoadingBanks(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Load questions for selected bank                                       */
  /* ---------------------------------------------------------------------- */

  async function loadQuestions(bankId: string) {
    setLoadingQuestions(true);
    try {
      const { data, error } = await supabase
        .from("teacher_questions")
        .select("id, topic, question_text, options, difficulty, marks")
        .eq("school_id", schoolId)
        .eq("bank_id", bankId)
        .eq("question_type", "objective")
        .order("topic", { ascending: true });

      if (error) throw error;
      setQuestions(data || []);
      setSelectedBankId(bankId);
    } catch (err: any) {
      toast.error("Failed to load questions");
    } finally {
      setLoadingQuestions(false);
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Selection helpers                                                       */
  /* ---------------------------------------------------------------------- */

  function toggleQuestion(question: QuestionItem) {
    const existing = selectedQuestions.find((q) => q.question_id === question.id);
    if (existing) {
      onQuestionsChange(
        selectedQuestions.filter((q) => q.question_id !== question.id)
      );
    } else {
      const newQuestion: SelectedQuizQuestion = {
        question_id: question.id,
        marks: question.marks || 1,
        display_order: selectedQuestions.length + 1,
        question_text: question.question_text,
        topic: question.topic,
        options: question.options,
      };
      onQuestionsChange([...selectedQuestions, newQuestion]);
    }
  }

  function updateMarks(questionId: string, marks: number) {
    onQuestionsChange(
      selectedQuestions.map((q) =>
        q.question_id === questionId ? { ...q, marks: Math.max(1, marks) } : q
      )
    );
  }

  function selectAllFromBank() {
    const alreadySelected = new Set(selectedQuestions.map((q) => q.question_id));
    const newQuestions = questions
      .filter((q) => !alreadySelected.has(q.id))
      .map((q, idx) => ({
        question_id: q.id,
        marks: q.marks || 1,
        display_order: selectedQuestions.length + idx + 1,
        question_text: q.question_text,
        topic: q.topic,
        options: q.options,
      }));
    onQuestionsChange([...selectedQuestions, ...newQuestions]);
  }

  function clearAll() {
    onQuestionsChange([]);
  }

  /* ---------------------------------------------------------------------- */
  /* Filtered questions                                                      */
  /* ---------------------------------------------------------------------- */

  const filteredQuestions = searchQuery
    ? questions.filter(
        (q) =>
          q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.topic.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : questions;

  const selectedIds = new Set(selectedQuestions.map((q) => q.question_id));
  const totalQuizMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0);

  /* ---------------------------------------------------------------------- */
  /* RENDER                                                                  */
  /* ---------------------------------------------------------------------- */

  if (!schoolId || !subjectClassId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
        <AlertCircle className="h-4 w-4" />
        Select a class and subject first to load question banks.
      </div>
    );
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-white">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-sm">Question Bank Quiz</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {selectedQuestions.length} selected
          </span>
          {selectedQuestions.length > 0 && (
            <span className="text-xs font-medium text-blue-600">
              {totalQuizMarks} marks
            </span>
          )}
        </div>
        {selectedQuestions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-red-500 hover:text-red-700 h-7 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Quiz Config Toggles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-2">
          <Shuffle className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <Switch
              id="shuffle"
              checked={quizConfig.shuffle_questions}
              onCheckedChange={(v) =>
                onConfigChange({ ...quizConfig, shuffle_questions: v })
              }
              className="scale-75"
            />
            <Label htmlFor="shuffle" className="text-xs cursor-pointer">
              Shuffle
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <Switch
              id="show-results"
              checked={quizConfig.show_results_immediately}
              onCheckedChange={(v) =>
                onConfigChange({ ...quizConfig, show_results_immediately: v })
              }
              className="scale-75"
            />
            <Label htmlFor="show-results" className="text-xs cursor-pointer">
              Show results
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1.5">
            <Switch
              id="retake"
              checked={quizConfig.allow_retake}
              onCheckedChange={(v) =>
                onConfigChange({ ...quizConfig, allow_retake: v })
              }
              className="scale-75"
            />
            <Label htmlFor="retake" className="text-xs cursor-pointer">
              Retake
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="number"
            min={1}
            placeholder="Min"
            value={quizConfig.time_limit_minutes ?? ""}
            onChange={(e) =>
              onConfigChange({
                ...quizConfig,
                time_limit_minutes: e.target.value
                  ? parseInt(e.target.value)
                  : null,
              })
            }
            className="h-7 text-xs w-16"
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </div>

      <div className="border-t pt-3">
        {/* ── Bank Selector ── */}
        {loadingBanks ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : banks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No question banks found</p>
            <p className="text-xs mt-1">
              Create a question bank first in the Question Bank section.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Search */}
            {selectedBankId && (
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            )}

            {/* Bank List */}
            <div className="space-y-1">
              {banks.map((bank) => {
                const isExpanded = expandedBank === bank.id;
                const isActive = selectedBankId === bank.id;
                const questionCount = bankQuestionCounts[bank.id] || 0;

                return (
                  <div key={bank.id} className="border rounded-md">
                    <button
                      type="button"
                      className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/50 transition rounded-md"
                      onClick={() => {
                        if (isExpanded) {
                          setExpandedBank(null);
                          setSelectedBankId(null);
                          setSearchQuery("");
                        } else {
                          setExpandedBank(bank.id);
                          loadQuestions(bank.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {bank.title}
                        </span>
                        {bank.visibility === "public_school" && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {questionCount} Q
                        </span>
                        {isExpanded && questionCount > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllFromBank();
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Select all
                          </Button>
                        )}
                      </div>
                    </button>

                    {/* Question List */}
                    {isExpanded && (
                      <div className="border-t">
                        {loadingQuestions ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredQuestions.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            <p className="text-xs">
                              {searchQuery
                                ? "No questions match your search."
                                : "No objective questions in this bank."}
                            </p>
                          </div>
                        ) : (
                          <ScrollArea className="max-h-64">
                            <div className="divide-y">
                              {filteredQuestions.map((question) => {
                                const isSelected = selectedIds.has(question.id);
                                return (
                                  <div
                                    key={question.id}
                                    className={`flex items-start gap-2 px-3 py-2.5 transition ${
                                      isSelected ? "bg-blue-50/50" : "hover:bg-muted/30"
                                    }`}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() =>
                                        toggleQuestion(question)
                                      }
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium line-clamp-2">
                                        {question.question_text}
                                      </p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                          {question.topic}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                          {question.difficulty}
                                        </span>
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Input
                                          type="number"
                                          min={1}
                                          value={
                                            selectedQuestions.find(
                                              (q) =>
                                                q.question_id === question.id
                                            )?.marks ?? 1
                                          }
                                          onChange={(e) =>
                                            updateMarks(
                                              question.id,
                                              parseInt(e.target.value) || 1
                                            )
                                          }
                                          className="h-7 w-14 text-xs text-center"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-[10px] text-muted-foreground">
                                          pts
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </ScrollArea>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Selected Questions Summary ── */}
        {selectedQuestions.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Selected Questions
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {totalQuizMarks} total marks
              </span>
            </div>
            <ScrollArea className="max-h-32">
              <div className="space-y-1">
                {selectedQuestions.map((q, idx) => (
                  <div
                    key={q.question_id}
                    className="flex items-center justify-between gap-2 bg-blue-50/50 rounded px-2 py-1.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-muted-foreground w-4 shrink-0">
                        {idx + 1}.
                      </span>
                      <p className="text-xs truncate">{q.question_text}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-medium text-blue-600">
                        {q.marks}pt
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onQuestionsChange(
                            selectedQuestions.filter(
                              (sq) => sq.question_id !== q.question_id
                            )
                          )
                        }
                        className="text-muted-foreground hover:text-red-500 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
