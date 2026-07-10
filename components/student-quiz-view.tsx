"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";



/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

interface QuizQuestionData {
  id: string;
  question_id: string;
  marks: number;
  display_order: number;
  question: {
    question_text: string;
    options: { label: string; value: string }[];
    correct_answer: string | null;
    explanation: string | null;
    topic: string;
  };
}

interface QuizConfig {
  shuffle_questions: boolean;
  time_limit_minutes: number | null;
  allow_retake: boolean;
  show_results_immediately: boolean;
}

interface QuizViewProps {
  assignment: any;
  quizConfig: QuizConfig;
  quizQuestions: QuizQuestionData[];
  existingSubmission: any;
  schoolId: string;
  studentId: string;
  onSubmissionComplete: (submission: any) => void;
}

/* -------------------------------------------------------------------------- */
/* COMPONENT                                                                  */
/* -------------------------------------------------------------------------- */

export function StudentQuizView({
  assignment,
  quizConfig,
  quizQuestions,
  existingSubmission,
  schoolId,
  studentId,
  onSubmissionComplete,
}: QuizViewProps) {
  /* ===== State ===== */
  const [phase, setPhase] = useState<"not_started" | "in_progress" | "submitting" | "completed">(
    existingSubmission?.answers ? "completed" : "not_started"
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [shuffledQuestions, setShuffledQuestions] = useState<QuizQuestionData[]>([]);
  const [results, setResults] = useState<{
    correctCount: number;
    totalCount: number;
    score: number;
    totalMarks: number;
    details: Record<string, { selected: string; correct: string; isCorrect: boolean }>;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef(answers);
  const submittingRef = useRef(false);

  /* Keep answersRef in sync with latest answers state */
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  /* ===== Initialize shuffled questions ===== */
  useEffect(() => {
    if (quizConfig.shuffle_questions) {
      const shuffled = [...quizQuestions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(shuffled);
    } else {
      setShuffledQuestions([...quizQuestions].sort((a, b) => a.display_order - b.display_order));
    }
  }, [quizQuestions, quizConfig.shuffle_questions]);

  /* ===== Handle existing submission for results view ===== */
  useEffect(() => {
    if (existingSubmission?.answers && phase === "completed") {
      const savedAnswers = existingSubmission.answers as Record<string, string>;
      setAnswers(savedAnswers);
      computeAndSetResults(savedAnswers, quizQuestions);
    }
  }, []);

  /* ===== Timer ===== */
  useEffect(() => {
    if (phase !== "in_progress" || !quizConfig.time_limit_minutes) return;

    const totalSeconds = quizConfig.time_limit_minutes * 60;
    setTimeRemaining(totalSeconds);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  /* ===== Start Quiz ===== */
  function handleStart() {
    setPhase("in_progress");
  }

  /* ===== Answer Selection ===== */
  function handleSelectAnswer(questionId: string, label: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: label }));
  }

  /* ===== Auto-submit on timeout ===== */
  async function handleAutoSubmit() {
    if (phase !== "in_progress") return;
    if (submittingRef.current) return;
    await submitQuiz(answersRef.current);
  }

  /* ===== Submit Quiz ===== */
  async function submitQuiz(answersToSubmit: Record<string, string>) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPhase("submitting");
    try {
      const startedAt = existingSubmission?.started_at || new Date().toISOString();

      // Call the server-side API for validated grading
      const res = await fetch(
        `/api/student/assignments/${assignment.id}/submit-quiz`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: answersToSubmit, started_at: startedAt }),
        }
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit quiz");
      }

      const { data: responseData } = await res.json();

      // Use server-validated results
      setResults({
        correctCount: responseData.result.correctCount,
        totalCount: responseData.result.totalQuestions,
        score: responseData.result.score,
        totalMarks: responseData.result.totalMarks,
        details: responseData.details,
      });

      if (quizConfig.show_results_immediately) {
        setPhase("completed");
      } else {
        toast.success("Quiz submitted successfully!");
      }

      if (responseData.submission) {
        onSubmissionComplete(responseData.submission);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit quiz");
      setPhase("in_progress");
    }
  }

  /* ===== Submit handler ===== */
  async function handleSubmit() {
    const unanswered = shuffledQuestions.filter((q) => !answers[q.question_id]);
    if (unanswered.length > 0) {
      toast.error(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }
    await submitQuiz(answers);
  }

  /* ===== Retake ===== */
  async function handleRetake() {
    setAnswers({});
    setResults(null);
    setTimeRemaining(null);
    setPhase("not_started");
  }

  /* ===== Compute results ===== */
  function computeResults(
    ans: Record<string, string>,
    questions: QuizQuestionData[]
  ) {
    let correctCount = 0;
    const totalCount = questions.length;
    const details: Record<string, { selected: string; correct: string; isCorrect: boolean }> = {};

    questions.forEach((q) => {
      const selected = ans[q.question_id] || "";
      const correct = q.question.correct_answer || "";
      const isCorrect = selected.toUpperCase() === correct.toUpperCase();
      if (isCorrect) correctCount++;
      details[q.question_id] = { selected, correct, isCorrect };
    });

    const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * totalMarks) : 0;

    return { correctCount, totalCount, score, totalMarks, details };
  }

  function computeAndSetResults(
    ans: Record<string, string>,
    questions: QuizQuestionData[]
  ) {
    const result = computeResults(ans, questions);
    setResults(result);
  }

  /* ===== Format time ===== */
  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  /* ===== Score percentage color ===== */
  function getScoreColor(percent: number) {
    if (percent >= 70) return "text-green-600";
    if (percent >= 40) return "text-yellow-600";
    return "text-red-600";
  }

  /* ===== Render: Not Started ===== */
  if (phase === "not_started") {
    return (
      <Card className="border-2 border-blue-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-3">
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Quiz Ready</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {shuffledQuestions.length} question{shuffledQuestions.length !== 1 ? "s" : ""}
            {quizConfig.time_limit_minutes && ` · ${quizConfig.time_limit_minutes} minute time limit`}
            {quizConfig.shuffle_questions && " · Shuffled order"}
          </p>
        </CardHeader>
        <CardContent className="pt-6 text-center">
          {existingSubmission?.auto_score !== null && existingSubmission?.auto_score !== undefined && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                You previously scored <strong>{existingSubmission.auto_score}</strong> marks.
                {quizConfig.allow_retake ? " You can retake this quiz." : ""}
              </p>
            </div>
          )}
          <Button onClick={handleStart} size="lg" className="gap-2">
            <Play className="h-5 w-5" />
            {existingSubmission?.answers ? "Retake Quiz" : "Start Quiz"}
          </Button>
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p>• Read each question carefully</p>
            <p>• Select the best answer for each question</p>
            {quizConfig.show_results_immediately && <p>• You'll see results immediately after submitting</p>}
            {!quizConfig.allow_retake && !existingSubmission?.answers && <p>• You can only take this quiz once</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ===== Render: In Progress ===== */
  if (phase === "in_progress" || phase === "submitting") {
    const answeredCount = Object.keys(answers).length;
    const progressPercent = shuffledQuestions.length > 0
      ? Math.round((answeredCount / shuffledQuestions.length) * 100)
      : 0;

    return (
      <div className="space-y-4">
        {/* Timer & Progress Bar */}
        <Card className="sticky top-0 z-10 border-2 bg-white shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {answeredCount}/{shuffledQuestions.length} answered
                </Badge>
              </div>
              {quizConfig.time_limit_minutes && timeRemaining !== null && (
                <div className={`flex items-center gap-1.5 font-mono text-sm font-bold ${timeRemaining < 60 ? "text-red-600 animate-pulse" : "text-gray-700"}`}>
                  <Clock className="h-4 w-4" />
                  {formatTime(timeRemaining)}
                </div>
              )}
            </div>
            <Progress value={progressPercent} className="h-1.5" />
          </CardContent>
        </Card>

        {/* Questions */}
        {shuffledQuestions.map((q, idx) => (
          <Card key={q.question_id} className="border border-gray-200">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium leading-relaxed">
                    {q.question.question_text}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {q.question.topic} · {q.marks} mark{q.marks !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 ml-9">
                {q.question.options.map((opt) => {
                  const isSelected = answers[q.question_id] === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={phase === "submitting"}
                      onClick={() => handleSelectAnswer(q.question_id, opt.label)}
                      className={`w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition text-sm ${
                        isSelected
                          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      } ${phase === "submitting" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <span className={`text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                      }`}>
                        {opt.label}
                      </span>
                      <span className="text-sm">{opt.value}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Submit Button */}
        <div className="flex justify-center pt-2 pb-8">
          <Button
            onClick={handleSubmit}
            disabled={phase === "submitting" || answeredCount < shuffledQuestions.length}
            size="lg"
            className="min-w-[200px]"
          >
            {phase === "submitting" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </span>
            ) : (
              "Submit Quiz"
            )}
          </Button>
        </div>
      </div>
    );
  }

  /* ===== Render: Completed ===== */
  if (phase === "completed" && results) {
    const percent = results.totalMarks > 0
      ? Math.round((results.score / results.totalMarks) * 100)
      : 0;

    return (
      <div className="space-y-4">
        {/* Score Card */}
        <Card className={`border-2 ${percent >= 70 ? "border-green-300" : percent >= 40 ? "border-yellow-300" : "border-red-300"}`}>
          <CardContent className="text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-4xl font-bold mb-1">{results.score}</p>
            <p className="text-sm text-muted-foreground mb-1">
              out of {results.totalMarks} marks
            </p>
            <p className={`text-lg font-semibold ${getScoreColor(percent)}`}>
              {percent}%
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{results.correctCount} correct</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <XCircle className="h-4 w-4" />
                <span>{results.totalCount - results.correctCount} incorrect</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Review */}
        {quizConfig.show_results_immediately && (
          <>
            {shuffledQuestions.map((q, idx) => {
              const detail = results.details[q.question_id];
              if (!detail) return null;
              return (
                <Card key={q.question_id} className={`border-l-4 ${detail.isCorrect ? "border-l-green-500" : "border-l-red-500"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-0.5 bg-gray-100 text-gray-600">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{q.question.question_text}</p>
                          {detail.isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="ml-9 space-y-1">
                      {q.question.options.map((opt) => {
                        const isSelected = detail.selected === opt.label;
                        const isCorrectOpt = detail.correct === opt.label;
                        let bgClass = "border-gray-200 bg-white";
                        if (isCorrectOpt) bgClass = "border-green-300 bg-green-50";
                        else if (isSelected && !isCorrectOpt) bgClass = "border-red-300 bg-red-50";
                        return (
                          <div
                            key={opt.label}
                            className={`flex items-start gap-3 p-2 rounded-lg border text-sm ${bgClass}`}
                          >
                            <span className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 bg-gray-100 text-gray-600">
                              {opt.label}
                            </span>
                            <span className="text-sm">{opt.value}</span>
                            {isCorrectOpt && (
                              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5 ml-auto" />
                            )}
                            {isSelected && !isCorrectOpt && (
                              <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5 ml-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {q.question.explanation && q.question.correct_answer && !detail.isCorrect && (
                      <div className="ml-9 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-800">
                          <strong>Explanation:</strong> {q.question.explanation}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Retake Button */}
            {quizConfig.allow_retake && (
              <div className="flex justify-center pt-2 pb-8">
                <Button onClick={handleRetake} variant="outline" size="lg" className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Retake Quiz
                </Button>
              </div>
            )}
          </>
        )}

        {!quizConfig.show_results_immediately && (
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <p className="font-medium text-lg">Quiz Submitted</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your results will be available once reviewed. Check back later.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
