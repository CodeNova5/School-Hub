"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Lock, PlayCircle, ShieldCheck, Trophy } from "lucide-react";

type SubjectOption = {
  slug: string;
  name: string;
};

type QuestionRow = {
  id: string;
  question_text: string;
  options: string[];
  subject_slug: string;
  subject_name: string;
  exam_year: number;
  topic: string | null;
};

type AttemptResult = {
  correctCount: number;
  totalQuestions: number;
  score: number;
};

const ALL_TOPICS = "__all_topics__";

export default function StudentJambPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(ALL_TOPICS);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);

  useEffect(() => {
    if (!schoolLoading && schoolId) {
      loadJambData();
    }
  }, [schoolId, schoolLoading]);

  async function loadJambData() {
    if (!schoolId) return;

    try {
      setLoading(true);
      const user = await getCurrentUser();

      if (!user) {
        toast.error("Please log in to continue");
        window.location.href = "/student/login";
        return;
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .eq("school_id", schoolId)
        .single();

      if (studentError || !student) {
        toast.error("Student profile not found");
        return;
      }

      setStudentName(`${student.first_name} ${student.last_name}`);

      const { data: jambAccess, error: jambAccessError } = await supabase
        .from("jamb_student_access")
        .select("id")
        .eq("student_id", student.id)
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();

      if (jambAccessError) {
        console.error("Failed to load JAMB access:", jambAccessError);
      }

      if (!jambAccess) {
        setHasAccess(false);
        return;
      }

      setHasAccess(true);

      const response = await fetch("/api/scrape/subjects", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load subject list");
      }

      const result = await response.json();
      const loadedSubjects = Array.isArray(result.subjects)
        ? result.subjects
            .map((subject: any) => ({
              slug: String(subject.slug || ""),
              name: String(subject.name || ""),
            }))
            .filter((subject: SubjectOption) => subject.slug && subject.name)
        : [];

      setSubjects(loadedSubjects);
    } catch (error: any) {
      console.error("Failed to load JAMB data:", error);
      toast.error(error.message || "Failed to load JAMB practice data");
    } finally {
      setLoading(false);
    }
  }

  const currentQuestion = questions[currentQuestionIndex] || null;

  useEffect(() => {
    if (!selectedSubject) {
      setYears([]);
      setTopics([]);
      setSelectedYear("");
      setSelectedTopic(ALL_TOPICS);
      setQuestions([]);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setAttemptResult(null);
      return;
    }

    setSelectedYear("");
    setSelectedTopic(ALL_TOPICS);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setAttemptResult(null);

    void loadAvailableFilters(selectedSubject).catch((error: any) => {
      console.error("Failed to load subject filters:", error);
      toast.error(error.message || "Failed to load available years and topics");
    });
  }, [selectedSubject]);

  const filteredSubjectLabel = useMemo(() => {
    return subjects.find((subject) => subject.slug === selectedSubject)?.name || "JAMB";
  }, [selectedSubject, subjects]);

  async function loadAvailableFilters(subjectSlug: string) {
    const response = await fetch(`/api/scrape/available?subject=${encodeURIComponent(subjectSlug)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load available years and topics");
    }

    const result = await response.json();
    const loadedYears = Array.isArray(result.years)
      ? result.years
          .map((year: any) => Number(year))
          .filter((year: number) => Number.isFinite(year))
          .sort((a: number, b: number) => b - a)
      : [];
    const loadedTopics = Array.isArray(result.topics)
      ? result.topics
          .map((topic: any) => String(topic.topic || topic.value || topic || ""))
          .filter((topic: string) => Boolean(topic))
      : [];

    setYears(loadedYears);
    setTopics(Array.from(new Set<string>(loadedTopics)).sort((a, b) => a.localeCompare(b)));
  }

  async function loadQuestions() {
    if (!selectedSubject || !selectedYear) {
      toast.error("Please select a subject and year");
      return;
    }

    try {
      setLoadingQuestions(true);
      const params = new URLSearchParams({
        subject: selectedSubject,
        subjectName: filteredSubjectLabel,
        year: selectedYear,
        topic: selectedTopic,
        limit: "20",
      });

      const response = await fetch(`/api/student/jamb/questions?${params.toString()}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load questions");
      }

      const loadedQuestions = Array.isArray(result.data?.questions)
        ? result.data.questions.map((row: any) => ({
            id: row.id,
            question_text: row.question_text,
            options: Array.isArray(row.options) ? row.options : [],
            subject_slug: row.subject_slug,
            subject_name: row.subject_name,
            exam_year: row.exam_year,
            topic: row.topic,
          }))
        : [];

      if (loadedQuestions.length === 0) {
        toast.info("No questions matched the selected filters");
      }

      setQuestions(loadedQuestions);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setAttemptResult(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to load questions");
    } finally {
      setLoadingQuestions(false);
    }
  }

  function recordAnswer(questionId: string, selectedOption: string) {
    setAnswers((current) => ({
      ...current,
      [questionId]: selectedOption,
    }));
  }

  async function submitAttempt() {
    if (!questions.length) return;

    try {
      setSubmitting(true);
      const response = await fetch("/api/student/jamb/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectSlug: selectedSubject,
          subjectName: filteredSubjectLabel,
          examYear: Number(selectedYear),
          topic: selectedTopic === ALL_TOPICS ? null : selectedTopic,
          answers: questions.map((question) => ({
            questionId: question.id,
            selectedOption: answers[question.id] || null,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit attempt");
      }

      setAttemptResult(result.data);
      toast.success("Attempt saved successfully");
    } catch (error: any) {
      toast.error(error.message || "Unable to save attempt");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!hasAccess) {
    return (
      <DashboardLayout role="student">
        <div className="mx-auto max-w-3xl space-y-6">
          <Alert className="border-amber-200 bg-amber-50">
            <Lock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              JAMB CBT practice is not enabled for your account yet.
            </AlertDescription>
          </Alert>
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-start gap-4 p-8">
              <Badge variant="outline">Restricted feature</Badge>
              <h1 className="text-3xl font-bold text-gray-900">JAMB CBT Practice</h1>
              <p className="text-gray-600 max-w-2xl">
                Your administrator has not enabled this feature for your student profile.
                Once access is granted, you will be able to practice past questions here.
              </p>
              <Button asChild>
                <Link href="/student">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="student">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge variant="success" className="gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                Access enabled
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">JAMB CBT Practice</h1>
            <p className="text-gray-600 mt-2">
              Welcome {studentName}. Pick a subject, year, and topic, then practice past questions.
            </p>
          </div>
          <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white shadow-lg">
            <p className="text-sm text-blue-100">Exam type</p>
            <p className="text-2xl font-bold">JAMB</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardTitle>Select Practice Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Subject</p>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.slug} value={subject.slug}>
                          {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Year</p>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose year" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Topic</p>
                  <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                    <SelectTrigger>
                      <SelectValue placeholder="All topics" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_TOPICS}>All topics</SelectItem>
                      {topics.map((topic) => (
                        <SelectItem key={topic} value={topic}>
                          {topic}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={loadQuestions} disabled={loadingQuestions || !selectedSubject || !selectedYear} className="gap-2">
                {loadingQuestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Load Questions
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-green-50">
              <CardTitle>Practice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Selected subject</p>
                <p className="mt-1 font-semibold text-gray-900">{filteredSubjectLabel}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Questions loaded</p>
                <p className="mt-1 font-semibold text-gray-900">{questions.length}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Attempt status</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {attemptResult ? "Saved" : "Not submitted"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {questions.length > 0 && currentQuestion ? (
          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {currentQuestion.subject_name} · {currentQuestion.exam_year}
                    {currentQuestion.topic ? ` · ${currentQuestion.topic}` : ""}
                  </p>
                </div>
                <Badge variant="outline">JAMB CBT</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <p className="text-lg font-medium text-gray-900">{currentQuestion.question_text}</p>

              <div className="grid gap-3">
                {currentQuestion.options.map((option, index) => {
                  const selected = answers[currentQuestion.id] === option;
                  return (
                    <Button
                      key={`${currentQuestion.id}-${index}`}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className={`justify-start py-6 text-left ${selected ? "border-blue-600" : ""}`}
                      onClick={() => recordAnswer(currentQuestion.id, option)}
                    >
                      <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-sm font-semibold">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="text-base">{option}</span>
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <Button
                    type="button"
                    onClick={() => setCurrentQuestionIndex((current) => Math.min(questions.length - 1, current + 1))}
                    className="gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button type="button" onClick={submitAttempt} disabled={submitting} className="gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    Submit Attempt
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {attemptResult ? (
          <Card className="border-emerald-200 bg-emerald-50 shadow-lg">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Attempt saved</p>
                <h2 className="text-2xl font-bold text-emerald-900">
                  {attemptResult.correctCount} / {attemptResult.totalQuestions} correct
                </h2>
                <p className="text-emerald-700">Score: {attemptResult.score}%</p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/student">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}