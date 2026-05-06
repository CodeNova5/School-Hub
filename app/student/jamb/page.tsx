"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
const QUESTIONS_PER_PAGE = 5;

export default function StudentJambPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [subjectPage, setSubjectPage] = useState(1);
  const [subjectTotalPages, setSubjectTotalPages] = useState(1);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [years, setYears] = useState<number[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedTopic, setSelectedTopic] = useState(ALL_TOPICS);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionTotalPages, setQuestionTotalPages] = useState(1);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [questionDebug, setQuestionDebug] = useState<{
    page: number;
    totalPages: number;
    count: number;
    hasMore: boolean;
    sourceUrl?: string;
  } | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    subject: string;
    year: string;
    topic: string;
  } | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  function getDraftKey(subject?: string, year?: string, topic?: string) {
    const s = subject || selectedSubject || "";
    const y = year || selectedYear || "";
    const t = topic || selectedTopic || ALL_TOPICS;
    const sid = schoolId || "global";
    return `jamb_draft:${sid}:${s}:${y}:${t}`;
  }

  function getSessionKey() {
    const sid = schoolId || "global";
    return `jamb_session:${sid}`;
  }

  function saveSessionState(subject: string, year: string, topic: string) {
    try {
      if (typeof window === "undefined") return;
      const key = getSessionKey();
      const session = { subject, year, topic, timestamp: Date.now() };
      window.localStorage.setItem(key, JSON.stringify(session));
    } catch (e) {
      console.error("Failed to save session state", e);
    }
  }

  function loadSessionState() {
    try {
      if (typeof window === "undefined") return null;
      const key = getSessionKey();
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load session state", e);
      return null;
    }
  }

  function clearSessionState() {
    try {
      if (typeof window === "undefined") return;
      const key = getSessionKey();
      window.localStorage.removeItem(key);
    } catch (e) {
      console.error("Failed to clear session state", e);
    }
  }

  function handleRestoreSession() {
    if (pendingSession) {
      setSelectedSubject(pendingSession.subject);
      setSelectedYear(pendingSession.year);
      setSelectedTopic(pendingSession.topic);
      setShowRestoreDialog(false);
    }
  }

  function handleStartFresh() {
    clearSessionState();
    setSelectedSubject("");
    setSelectedYear("");
    setSelectedTopic(ALL_TOPICS);
    setAnswers({});
    setQuestions([]);
    setShowRestoreDialog(false);
    toast.success("Started fresh session");
  }

  function loadDraftFromLocalStorage(key?: string) {
    try {
      const k = key || getDraftKey();
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
      if (!raw) return {} as Record<string, string>;
      const parsed = JSON.parse(raw || "{}");
      return parsed.answers || {};
    } catch (e) {
      console.error("Failed to load draft from localStorage", e);
      return {} as Record<string, string>;
    }
  }

  function saveDraftToLocalStorage(data?: Record<string, string>, key?: string) {
    try {
      const k = key || getDraftKey();
      const currentAnswers = data || answers;
      const isCurrentPageComplete = questions.length === QUESTIONS_PER_PAGE &&
        questions.every(q => currentAnswers[q.id]);

      const payload = {
        subject: selectedSubject,
        year: selectedYear,
        topic: selectedTopic,
        updatedAt: Date.now(),
        answers: currentAnswers,
        pageCompletion: pageCompletion,
      };
      if (typeof window !== "undefined") window.localStorage.setItem(k, JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to save draft to localStorage", e);
    }
  }

  const [pageCompletion, setPageCompletion] = useState<Record<number, boolean>>({});

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

      // Check for existing session to restore
      const savedSession = loadSessionState();
      if (savedSession && savedSession.subject && savedSession.year) {
        setPendingSession(savedSession);
        setShowRestoreDialog(true);
      }

      // load first page of subjects
      await fetchSubjects(1);
    } catch (error: any) {
      console.error("Failed to load JAMB data:", error);
      toast.error(error.message || "Failed to load JAMB data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSubjects(page = 1) {
    try {
      setSubjectLoading(true);
      const response = await fetch(`/api/scrape/subjects?page=${page}`, { cache: "no-store" });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to load subject list");
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
      setSubjectPage(Number(result.page) || page);
      setSubjectTotalPages(Number(result.totalPages) || 1);
    } catch (error: any) {
      console.error("Failed to fetch subjects:", error);
      toast.error(error.message || "Failed to load subjects");
    } finally {
      setSubjectLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedSubject) {
      setYears([]);
      setTopics([]);
      setSelectedYear("");
      setSelectedTopic(ALL_TOPICS);
      setQuestions([]);
      setAnswers({});
      setAttemptResult(null);
      setQuestionDebug(null);
      return;
    }

    // If there's a pending session for this subject, don't wipe the year/topic
    // because the restore flow will apply them. Otherwise, reset year/topic.
    if (!(pendingSession && pendingSession.subject === selectedSubject)) {
      setSelectedYear("");
      setSelectedTopic(ALL_TOPICS);
    }

    setQuestions([]);
    setAnswers({});
    setAttemptResult(null);
    setQuestionDebug(null);

    void loadAvailableFilters(selectedSubject).catch((error: any) => {
      console.error("Failed to load subject filters:", error);
      toast.error(error.message || "Failed to load available years and topics");
    });
  }, [selectedSubject, pendingSession]);

  const filteredSubjectLabel = useMemo(() => {
    return subjects.find((subject) => subject.slug === selectedSubject)?.name || "JAMB";
  }, [selectedSubject, subjects]);

  const answeredCount = useMemo(() => {
    return questions.reduce((count, question) => {
      return answers[question.id] ? count + 1 : count;
    }, 0);
  }, [answers, questions]);

  const totalQuestions = useMemo(() => {
    return questionTotalPages * QUESTIONS_PER_PAGE;
  }, [questionTotalPages]);

  const totalAnsweredCount = useMemo(() => {
    return Object.keys(answers).length;
  }, [answers]);

  const progressPercent = useMemo(() => {
    if (!totalQuestions) return 0;
    return Math.round((totalAnsweredCount / totalQuestions) * 100);
  }, [totalAnsweredCount, totalQuestions]);

  const isPageComplete = (pageNum: number): boolean => {
    return pageCompletion[pageNum] === true;
  };

  const getPageAnsweredCount = (pageNum: number): number => {
    if (pageNum === questionPage) {
      return answeredCount;
    }
    // For other pages, we can't reliably calculate without knowing their question IDs
    // So we just check if the page is marked complete
    return pageCompletion[pageNum] ? QUESTIONS_PER_PAGE : 0;
  };

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

  async function loadQuestions(page = 1) {
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
        limit: String(QUESTIONS_PER_PAGE),
        page: String(page),
      });

      console.info("[student/jamb/page] loading questions", {
        subject: selectedSubject,
        year: selectedYear,
        topic: selectedTopic,
        page,
        url: `/api/student/jamb/questions?${params.toString()}`,
      });

      const response = await fetch(`/api/student/jamb/questions?${params.toString()}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to load questions");
      }

      const payload = result.data || {};
      const loadedQuestions = Array.isArray(payload.questions)
        ? payload.questions.map((row: any) => ({
            id: row.id,
            question_text: row.question_text,
            options: Array.isArray(row.options) ? row.options : [],
            subject_slug: row.subject_slug,
            subject_name: row.subject_name,
            exam_year: row.exam_year,
            topic: row.topic,
          }))
        : [];

      const pageNum = Number(payload.page) || page;
      const totalPages = payload.totalPages !== undefined ? Number(payload.totalPages) : pageNum;
      const hasMore = Boolean(payload.hasMore ?? pageNum < totalPages);

      if (loadedQuestions.length === 0 && page === 1) {
        toast.info("No questions matched the selected filters");
      }

      // Always replace questions when loading a new page (not append)
      setQuestions(loadedQuestions);
      // Restore any saved answers for this subject/year/topic
      try {
        const saved = loadDraftFromLocalStorage();
        if (saved && Object.keys(saved).length) {
          setAnswers((current) => ({ ...current, ...saved }));
        }
        // Restore page completion status
        const draftKey = getDraftKey();
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(draftKey) : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.pageCompletion) {
            setPageCompletion(parsed.pageCompletion);
          }
        }
      } catch (e) {
        console.error("Failed to restore saved answers", e);
      }
      setAttemptResult(null);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setQuestionPage(pageNum);
      setQuestionTotalPages(totalPages || 1);
      setHasMoreQuestions(hasMore);
      setQuestionDebug({
        page: pageNum,
        totalPages: totalPages || 1,
        count: loadedQuestions.length,
        hasMore,
        sourceUrl: payload.url,
      });

      console.info("[student/jamb/page] loaded questions", {
        page: pageNum,
        totalPages,
        count: loadedQuestions.length,
        hasMore,
        sourceUrl: payload.url,
      });
    } catch (error: any) {
      console.error("[student/jamb/page] question load failed", error);
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

  // Track page completion when answers change
  useEffect(() => {
    if (questions.length === QUESTIONS_PER_PAGE && questionPage) {
      const allAnswered = questions.every(q => answers[q.id]);
      if (allAnswered !== pageCompletion[questionPage]) {
        setPageCompletion(prev => ({
          ...prev,
          [questionPage]: allAnswered
        }));
      }
    }
  }, [answers, questions, questionPage, pageCompletion]);

  // Persist answers to localStorage (debounced)
  useEffect(() => {
    // don't save if no subject/year selected
    if (!selectedSubject || !selectedYear) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    // debounce 800ms
    // @ts-ignore
    saveTimerRef.current = window.setTimeout(() => {
      saveDraftToLocalStorage();
      saveTimerRef.current = null;
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [answers, selectedSubject, selectedYear, selectedTopic]);

  // save on unload
  useEffect(() => {
    function handleBeforeUnload() {
      saveDraftToLocalStorage();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }
    };
  }, [answers, selectedSubject, selectedYear, selectedTopic]);

  // Auto-load questions when subject + year are selected
  useEffect(() => {
    if (selectedSubject && selectedYear) {
      saveSessionState(selectedSubject, selectedYear, selectedTopic);
      void loadQuestions(1);
    }
  // intentionally exclude loadQuestions from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedYear, selectedTopic]);

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
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Continue Previous Session?</AlertDialogTitle>
          <AlertDialogDescription>
            We found your previous practice session. Would you like to resume where you left off?
            {pendingSession && (
              <div className="mt-3 space-y-2 rounded-lg bg-slate-100 p-3">
                <div className="text-sm"><span className="font-semibold text-gray-700">Subject:</span> {subjects.find(s => s.slug === pendingSession.subject)?.name || pendingSession.subject}</div>
                <div className="text-sm"><span className="font-semibold text-gray-700">Year:</span> {pendingSession.year}</div>
                {pendingSession.topic !== ALL_TOPICS && <div className="text-sm"><span className="font-semibold text-gray-700">Topic:</span> {pendingSession.topic}</div>}
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel onClick={handleStartFresh}>Start Fresh</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreSession}>Resume Session</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

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
              <CardTitle>Practice Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50">Step 1</Badge>
                    <p className="text-sm font-medium text-gray-700">Subject</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
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
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={selectedSubject ? "bg-blue-50" : "bg-gray-50"}>Step 2</Badge>
                    <p className="text-sm font-medium text-gray-700">Year</p>
                  </div>
                  <Select value={selectedYear} onValueChange={setSelectedYear} disabled={!selectedSubject}>
                    <SelectTrigger className={!selectedSubject ? "opacity-50 cursor-not-allowed" : ""}>
                      <SelectValue placeholder={selectedSubject ? "Choose year" : "Select subject first"} />
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={selectedYear ? "bg-blue-50" : "bg-gray-50"}>Step 3</Badge>
                    <p className="text-sm font-medium text-gray-700">Topic</p>
                  </div>
                  <Select value={selectedTopic} onValueChange={setSelectedTopic} disabled={!selectedYear}>
                    <SelectTrigger className={!selectedYear ? "opacity-50 cursor-not-allowed" : ""}>
                      <SelectValue placeholder={selectedYear ? "All topics" : "Select year first"} />
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

              {selectedSubject && selectedYear && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center gap-2 text-sm text-blue-900">
                  <span>📚 {subjects.find(s => s.slug === selectedSubject)?.name} • 📅 {selectedYear} {selectedTopic !== ALL_TOPICS && `• 📖 ${selectedTopic}`}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button onClick={() => loadQuestions(1)} disabled={loadingQuestions || !selectedSubject || !selectedYear} className="gap-2">
                  {loadingQuestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                  Load Questions
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-green-50">
              <CardTitle>Practice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Selected subject</p>
                <p className="mt-1 font-semibold text-gray-900">{filteredSubjectLabel || "—"}</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Total questions available</p>
                <p className="mt-1 font-semibold text-gray-900">{totalQuestions || "—"}</p>
                {totalQuestions > 0 && <p className="mt-1 text-xs text-gray-500">{questionTotalPages} pages × {QUESTIONS_PER_PAGE} questions</p>}
              </div>
              <div className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500">Overall Progress</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {totalAnsweredCount}/{totalQuestions}
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">{progressPercent}% complete</p>
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Pages completed</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {Object.values(pageCompletion).filter(Boolean).length}/{questionTotalPages}
                </p>
                {questionTotalPages > 0 && <p className="mt-1 text-xs text-gray-500">{QUESTIONS_PER_PAGE} questions per page</p>}
              </div>
              <div className="rounded-xl border bg-white p-4">
                <p className="text-sm text-gray-500">Attempt status</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {attemptResult ? "Saved" : "Not submitted"}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-gray-500">Debug</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {questionDebug ? `${questionDebug.count} returned, ${questionDebug.hasMore ? "more pages available" : "last page reached"}` : "No fetch yet"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {questionDebug ? `Page ${questionDebug.page} of ${questionDebug.totalPages}` : "Load a page to see request details"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {questions.length > 0 ? (
          <div className="space-y-6">
            {/* Top Pagination */}
            <div className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Overall Progress</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {totalAnsweredCount} / {totalQuestions} questions answered
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Page {questionPage}: {answeredCount}/{QUESTIONS_PER_PAGE} answered · {progressPercent}% total
                  </p>
                </div>
                <Button type="button" onClick={submitAttempt} disabled={submitting} className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                  Submit Attempt
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadQuestions(Math.max(1, questionPage - 1))}
                  disabled={loadingQuestions || questionPage <= 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex flex-wrap items-center gap-1">
                  {Array.from({ length: questionTotalPages }, (_, i) => i + 1).map((pageNum) => {
                    const isComplete = isPageComplete(pageNum);
                    const isCurrent = pageNum === questionPage;
                    const pageAnswered = getPageAnsweredCount(pageNum);
                    const hasAnswers = pageAnswered > 0;

                    return (
                      <Button
                        key={pageNum}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadQuestions(pageNum)}
                        disabled={loadingQuestions}
                        className={`min-w-10 transition-all ${
                          isComplete && !isCurrent
                            ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                            : hasAnswers && !isCurrent
                            ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
                            : ""
                        }`}
                        title={isComplete ? "Complete! 5/5 answered" : hasAnswers ? `${pageAnswered}/5 answered` : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadQuestions(Math.min(questionTotalPages, questionPage + 1))}
                  disabled={loadingQuestions || questionPage >= questionTotalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-5">
              {questions.map((question, questionIndex) => (
                (() => {
                  const displayQuestionNumber = (questionPage - 1) * QUESTIONS_PER_PAGE + questionIndex + 1;

                  return (
                <Card key={question.id} className="overflow-hidden shadow-lg">
                  <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-blue-50">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle>
                          Question {displayQuestionNumber}
                        </CardTitle>
                        <p className="mt-1 text-sm text-gray-500">
                          {question.subject_name} · {question.exam_year}
                          {question.topic ? ` · ${question.topic}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline">JAMB CBT</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 p-6">
                    <p className="text-lg font-medium text-gray-900">{question.question_text}</p>

                    <div className="grid gap-3">
                      {question.options.map((option, optionIndex) => {
                        const selected = answers[question.id] === option;
                        return (
                          <Button
                            key={`${question.id}-${optionIndex}`}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            className={`justify-start py-6 text-left ${selected ? "border-blue-600" : ""}`}
                            onClick={() => recordAnswer(question.id, option)}
                          >
                            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-sm font-semibold">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="text-base">{option}</span>
                          </Button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-gray-600">
                      <span>
                        {answers[question.id]
                          ? `Selected answer: ${answers[question.id]}`
                          : "No answer selected yet"}
                      </span>
                      <span>Question {displayQuestionNumber}</span>
                    </div>
                  </CardContent>
                </Card>
                  );
                })()
              ))}
            </div>

            {/* Bottom Pagination */}
            <div className="flex flex-col gap-3 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="text-sm text-gray-600">
                  Page {questionPage} of {questionTotalPages} · {answeredCount}/{QUESTIONS_PER_PAGE} answered on this tab
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadQuestions(Math.max(1, questionPage - 1))}
                  disabled={loadingQuestions || questionPage <= 1}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="flex flex-wrap items-center gap-1">
                  {Array.from({ length: questionTotalPages }, (_, i) => i + 1).map((pageNum) => {
                    const isComplete = isPageComplete(pageNum);
                    const isCurrent = pageNum === questionPage;
                    const pageAnswered = getPageAnsweredCount(pageNum);
                    const hasAnswers = pageAnswered > 0;

                    return (
                      <Button
                        key={pageNum}
                        variant={isCurrent ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadQuestions(pageNum)}
                        disabled={loadingQuestions}
                        className={`min-w-10 transition-all ${
                          isComplete && !isCurrent
                            ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"
                            : hasAnswers && !isCurrent
                            ? "border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200"
                            : ""
                        }`}
                        title={isComplete ? "Complete! 5/5 answered" : hasAnswers ? `${pageAnswered}/5 answered` : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadQuestions(Math.min(questionTotalPages, questionPage + 1))}
                  disabled={loadingQuestions || questionPage >= questionTotalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
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