"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
  Trophy,
  BarChart3,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Edit,
  Save,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface QuizSubmissionView {
  id: string;
  student_id: string;
  student_name: string;
  submitted_at: string;
  auto_score: number | null;
  auto_graded_at: string | null;
  answers: Record<string, string> | null;
  grade: number | null;
  graded_at: string | null;
  feedback: string | null;
  submitted_on_time: boolean;
}

interface QuizQuestionView {
  question_id: string;
  question_text: string;
  options: { label: string; value: string }[];
  correct_answer: string;
  marks: number;
  display_order: number;
  topic: string;
  explanation: string | null;
}

interface TeacherQuizResultsViewProps {
  schoolId: string;
  assignment: any;
  submissions: any[];
  onDataChange?: () => void;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export function TeacherQuizResultsView({
  schoolId,
  assignment,
  submissions: rawSubmissions,
  onDataChange,
}: TeacherQuizResultsViewProps) {
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionView[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [editOverride, setEditOverride] = useState<Record<string, string>>({});
  const [savingOverride, setSavingOverride] = useState<string | null>(null);

  /* ===== Load quiz questions ===== */
  useEffect(() => {
    if (!assignment.id) return;
    loadQuizQuestions();
  }, [assignment.id]);

  async function loadQuizQuestions() {
    setLoadingQuestions(true);
    try {
      // Load quiz questions with teacher_question details
      const { data: questions } = await supabase
        .from("assignment_quiz_questions")
        .select("question_id, marks, display_order")
        .eq("assignment_id", assignment.id)
        .order("display_order", { ascending: true });

      if (questions && questions.length > 0) {
        const questionIds = questions.map((q: any) => q.question_id);
        const { data: teacherQs } = await supabase
          .from("teacher_questions")
          .select("id, question_text, options, correct_answer, explanation, topic")
          .in("id", questionIds);

        const qMap = new Map<any, any>(
          (teacherQs || []).map((q: any) => [q.id, q])
        );

        setQuizQuestions(
          questions.map((q: any) => {
            const tq = qMap.get(q.question_id);
            return {
              question_id: q.question_id,
              question_text: tq?.question_text || "",
              options: tq?.options || [],
              correct_answer: tq?.correct_answer || "",
              marks: q.marks,
              display_order: q.display_order,
              topic: tq?.topic || "",
              explanation: tq?.explanation || null,
            };
          })
        );
      }
    } catch {
      // non-critical
    } finally {
      setLoadingQuestions(false);
    }
  }

  /* ===== Build student submission views ===== */
  const studentViews: QuizSubmissionView[] = rawSubmissions
    .filter((s: any) => s.answers) // Only show students who submitted
    .map((s: any) => ({
      id: s.id,
      student_id: s.student_id,
      student_name: `${s.students?.first_name || ""} ${s.students?.last_name || ""}`.trim(),
      submitted_at: s.submitted_at,
      auto_score: s.auto_score,
      auto_graded_at: s.auto_graded_at,
      answers: s.answers,
      grade: s.grade,
      graded_at: s.graded_at,
      feedback: s.feedback,
      submitted_on_time: s.submitted_on_time,
    }));

  const pendingCount = studentViews.filter((s) => !s.auto_graded_at).length;
  const autoGradedCount = studentViews.filter((s) => s.auto_graded_at).length;
  const manualGradedCount = studentViews.filter((s) => s.graded_at).length;

  const scoredSubmissions = studentViews.filter(
    (s) => s.auto_score !== null && s.auto_score !== undefined
  );
  const averageScore =
    scoredSubmissions.length > 0
      ? Math.round(
          scoredSubmissions.reduce((sum, s) => sum + (s.auto_score || 0), 0) /
            scoredSubmissions.length
        )
      : 0;

  const highestScore = scoredSubmissions.length > 0
    ? Math.max(...scoredSubmissions.map((s) => s.auto_score || 0))
    : 0;

  /* ===== Filtered students ===== */
  const filteredStudents = searchQuery
    ? studentViews.filter((s) =>
        s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : studentViews;

  /* ===== Per-question stats ===== */
  function getQuestionStats(questionId: string) {
    let correct = 0;
    let total = 0;
    studentViews.forEach((s) => {
      if (s.answers && s.answers[questionId]) {
        total++;
        const q = quizQuestions.find((q) => q.question_id === questionId);
        if (
          q &&
          s.answers[questionId].toUpperCase() === q.correct_answer.toUpperCase()
        ) {
          correct++;
        }
      }
    });
    return { correct, total, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 };
  }

  /* ===== Override grade ===== */
  async function handleSaveOverride(submissionId: string) {
    const newGrade = editOverride[submissionId];
    if (!newGrade || isNaN(Number(newGrade))) {
      toast.error("Enter a valid numeric score");
      return;
    }

    setSavingOverride(submissionId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("assignment_submissions")
        .update({
          grade: Number(newGrade),
          graded_at: new Date().toISOString(),
          graded_by: user?.id,
        })
        .eq("id", submissionId)
        .eq("school_id", schoolId);

      if (error) throw error;
      toast.success("Override saved");
      onDataChange?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to save override");
    } finally {
      setSavingOverride(null);
    }
  }

  /* ===== Color helpers ===== */
  function scoreColor(score: number, total: number) {
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (pct >= 70) return "text-green-600";
    if (pct >= 40) return "text-yellow-600";
    return "text-red-600";
  }

  function scoreBg(score: number, total: number) {
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (pct >= 70) return "bg-green-50 border-green-200";
    if (pct >= 40) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  }

  const totalMarks = assignment.total_marks || 100;

  /* ===== Render ===== */
  if (loadingQuestions) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading quiz results...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{studentViews.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Auto-graded</p>
                <p className="text-2xl font-bold text-green-600">{autoGradedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <Loader2 className="h-8 w-8 text-amber-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Average</p>
                <p className={`text-2xl font-bold ${scoreColor(averageScore, totalMarks)}`}>
                  {averageScore}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-indigo-500 opacity-60" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Highest</p>
                <p className={`text-2xl font-bold ${scoreColor(highestScore, totalMarks)}`}>
                  {highestScore}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500 opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Question Breakdown */}
      {quizQuestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Per-Question Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quizQuestions.map((q, idx) => {
                const stats = getQuestionStats(q.question_id);
                return (
                  <div key={q.question_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition">
                    <span className="text-xs font-bold text-muted-foreground w-6 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{q.question_text}</p>
                      <p className="text-[10px] text-muted-foreground">{q.topic}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            stats.percentage >= 70
                              ? "bg-green-500"
                              : stats.percentage >= 40
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-16 text-right">
                        {stats.correct}/{stats.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Student Results List */}
      {filteredStudents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {searchQuery ? "No students match your search" : "No quiz submissions yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredStudents.map((student) => {
            const isExpanded = expandedStudent === student.id;
            const studentScore = student.auto_score ?? 0;
            const hasOverride = student.grade !== null;

            return (
              <Card key={student.id} className="overflow-hidden">
                {/* Student Header */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStudent(isExpanded ? null : student.id)
                  }
                  className="w-full text-left p-4 flex items-center justify-between hover:bg-muted/30 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      studentScore >= totalMarks * 0.7
                        ? "bg-green-100 text-green-700"
                        : studentScore >= totalMarks * 0.4
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {student.student_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{student.student_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(student.submitted_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className={`text-lg font-bold ${scoreColor(studentScore, totalMarks)}`}>
                        {student.auto_score ?? "—"}
                      </p>
                      <div className="flex items-center gap-1">
                        {hasOverride && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            Override
                          </Badge>
                        )}
                        {!student.submitted_on_time && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            Late
                          </Badge>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Answer Review */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="p-4 space-y-4">
                      {quizQuestions.map((q, idx) => {
                        const studentAnswer = student.answers?.[q.question_id] || "";
                        const isCorrect =
                          studentAnswer.toUpperCase() === q.correct_answer.toUpperCase();
                        return (
                          <div
                            key={q.question_id}
                            className={`border-l-4 p-3 rounded-r-lg ${
                              studentAnswer
                                ? isCorrect
                                  ? "border-l-green-500 bg-green-50/30"
                                  : "border-l-red-500 bg-red-50/30"
                                : "border-l-gray-300 bg-gray-50/30"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-bold text-muted-foreground mt-0.5">
                                {idx + 1}.
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">{q.question_text}</p>
                                <div className="mt-2 space-y-1">
                                  {q.options.map((opt) => {
                                    const isSelected = studentAnswer === opt.label;
                                    const isCorrectOpt =
                                      q.correct_answer.toUpperCase() === opt.label.toUpperCase();
                                    let optClass = "border-gray-200 bg-white";
                                    if (isCorrectOpt) optClass = "border-green-300 bg-green-50";
                                    else if (isSelected && !isCorrectOpt)
                                      optClass = "border-red-300 bg-red-50";
                                    return (
                                      <div
                                        key={opt.label}
                                        className={`flex items-center gap-2 p-1.5 rounded border text-xs ${optClass}`}
                                      >
                                        <span className="font-bold w-4 shrink-0">{opt.label}</span>
                                        <span>{opt.value}</span>
                                        {isCorrectOpt && (
                                          <CheckCircle2 className="h-3 w-3 text-green-600 ml-auto shrink-0" />
                                        )}
                                        {isSelected && !isCorrectOpt && (
                                          <XCircle className="h-3 w-3 text-red-600 ml-auto shrink-0" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {!isCorrect && studentAnswer && q.explanation && (
                                  <p className="text-[10px] text-blue-700 mt-1.5 bg-blue-50 p-1.5 rounded">
                                    <strong>Explanation:</strong> {q.explanation}
                                  </p>
                                )}
                                {!studentAnswer && (
                                  <p className="text-[10px] text-muted-foreground mt-1 italic">
                                    Not answered
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Grade Override */}
                      <div className="border-t pt-4">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <Label className="text-xs">Override Score (max {totalMarks})</Label>
                            <Input
                              type="number"
                              min={0}
                              max={totalMarks}
                              placeholder={String(student.auto_score ?? "")}
                              defaultValue={student.grade ?? ""}
                              onChange={(e) =>
                                setEditOverride((prev) => ({
                                  ...prev,
                                  [student.id]: e.target.value,
                                }))
                              }
                              className="h-9 text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSaveOverride(student.id)}
                            disabled={savingOverride === student.id}
                            className="gap-1"
                          >
                            {savingOverride === student.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            Save Override
                          </Button>
                        </div>
                        {hasOverride && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Currently overridden to <strong>{student.grade}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
