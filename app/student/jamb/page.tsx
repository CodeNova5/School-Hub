"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { formatJambOptionText, formatJambText } from "@/lib/format-jamb-text";
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
import { ChevronLeft, ChevronRight, Loader2, Lock, ShieldCheck, Trophy, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
};

type AttemptResult = {
  correctCount: number;
  totalQuestions: number;
  score: number;
  answeredCount?: number;
  unansweredCount?: number;
  missedCount?: number;
  unansweredQuestions?: number[];
  missedQuestions?: Array<{
    questionId: string;
    questionNumber: number;
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    explanation?: string;
  }>;
  previousAttempt?: {
    score: number;
    correctCount: number;
    totalQuestions: number;
  };
};

const QUESTIONS_PER_PAGE = 5;

type MatrixChunk = {
  type: "matrix";
  rows: string[][];
};

type FractionChunk = {
  type: "fraction";
  numerator: string;
  denominator: string;
};

type TextChunk = {
  type: "text";
  value: string;
};

type RenderChunk = MatrixChunk | FractionChunk | TextChunk;

function isNumericToken(token: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(token);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMathToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "<mtext></mtext>";

  if (isNumericToken(trimmed) && trimmed.startsWith("-")) {
    return `<mrow><mo>-</mo><mn>${escapeHtml(trimmed.slice(1))}</mn></mrow>`;
  }

  if (isNumericToken(trimmed)) {
    return `<mn>${escapeHtml(trimmed)}</mn>`;
  }

  if (/^[A-Za-z]+$/.test(trimmed)) {
    return `<mi>${escapeHtml(trimmed)}</mi>`;
  }

  return `<mtext>${escapeHtml(trimmed)}</mtext>`;
}

function parseTextWithMatrices(text: string): RenderChunk[] {
  const chunks: RenderChunk[] = [];
  const matrixRegex = /\(\(([^()]+)\)\s*\(([^()]+)\)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = matrixRegex.exec(text)) !== null) {
    const [fullMatch, row1Raw, row2Raw] = match;
    const matchStart = match.index;

    if (matchStart > lastIndex) {
      chunks.push({
        type: "text",
        value: text.slice(lastIndex, matchStart),
      });
    }

    const row1 = row1Raw.trim().split(/\s+/).filter(Boolean);
    const row2 = row2Raw.trim().split(/\s+/).filter(Boolean);

    chunks.push({
      type: "matrix",
      rows: [row1, row2],
    });

    lastIndex = matchStart + fullMatch.length;
  }

  if (lastIndex < text.length) {
    chunks.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return chunks;
}

function parseFractionsInText(text: string): RenderChunk[] {
  const chunks: RenderChunk[] = [];
  const fractionRegex = /\(([^()]+)\)\/\(([^()]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fractionRegex.exec(text)) !== null) {
    const [fullMatch, numeratorRaw, denominatorRaw] = match;
    const matchStart = match.index;

    if (matchStart > lastIndex) {
      chunks.push({ type: "text", value: text.slice(lastIndex, matchStart) });
    }

    chunks.push({ type: "fraction", numerator: numeratorRaw.trim(), denominator: denominatorRaw.trim() });
    lastIndex = matchStart + fullMatch.length;
  }

  if (lastIndex < text.length) {
    chunks.push({ type: "text", value: text.slice(lastIndex) });
  }

  return chunks.length > 1 ? chunks : [{ type: "text", value: text }];
}

function parseComplexMathExpressions(text: string): RenderChunk[] {
  const fractionChunks = parseFractionsInText(text);
  const allChunks: RenderChunk[] = [];
  for (const chunk of fractionChunks) {
    if (chunk.type === "text") {
      const matrixChunks = parseTextWithMatrices(chunk.value);
      allChunks.push(...matrixChunks);
    } else {
      allChunks.push(chunk);
    }
  }
  return allChunks;
}

function renderQuestionWithMathML(rawText: string): ReactNode {
  const formatted = formatJambText(rawText);
  const chunks = parseComplexMathExpressions(formatted);
  const hasMath = chunks.some((chunk) => chunk.type === "matrix" || chunk.type === "fraction");

  if (!hasMath) {
    return formatted;
  }

  return chunks.map((chunk, chunkIndex) => {
    if (chunk.type === "text") {
      return (
        <span key={`text-${chunkIndex}`} className="preserve-whitespace">
          {chunk.value}
        </span>
      );
    }

    if (chunk.type === "fraction") {
      const fractionMathMl = `<math display="inline"><mrow><mfrac><mrow>${escapeHtml(chunk.numerator)}</mrow><mrow>${escapeHtml(chunk.denominator)}</mrow></mfrac></mrow></math>`;
      return (
        <span
          key={`fraction-${chunkIndex}`}
          aria-label="fraction"
          className="inline-block align-middle"
          style={{ display: "inline-block", verticalAlign: "middle", margin: "0 0.2rem" }}
          dangerouslySetInnerHTML={{ __html: fractionMathMl }}
        />
      );
    }

    const matrixRows = chunk.rows
      .map((row) => `<mtr>${row.map((cell) => `<mtd>${renderMathToken(cell)}</mtd>`).join("")}</mtr>`)
      .join("");
    const matrixMathMl = `<math display="inline"><mrow><mo>(</mo><mtable>${matrixRows}</mtable><mo>)</mo></mrow></math>`;

    return (
      <span
        key={`matrix-${chunkIndex}`}
        aria-label="matrix"
        className="inline-block align-middle"
        style={{ display: "inline-block", verticalAlign: "middle", margin: "0 0.2rem" }}
        dangerouslySetInnerHTML={{ __html: matrixMathMl }}
      />
    );
  });
}

export default function StudentJambPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [, setSubjectLoading] = useState(false);
  const [, setSubjectPage] = useState(1);
  const [, setSubjectTotalPages] = useState(1);
  const [years, setYears] = useState<number[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [, setHasMoreQuestions] = useState(false);
  const [, setQuestionDebug] = useState<{
    page: number;
    totalPages: number;
    count: number;
    hasMore: boolean;
    sourceUrl?: string;
  } | null>(null);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionTotalPages, setQuestionTotalPages] = useState(1);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showTerminationDialog, setShowTerminationDialog] = useState(false);
  const [pendingFilterChange, setPendingFilterChange] = useState<{
    type: "subject" | "year";
    value: string;
  } | null>(null);
  const [showResultWizard, setShowResultWizard] = useState(false);
  const [resultWizardStep, setResultWizardStep] = useState(1);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPreSubmitReview, setShowPreSubmitReview] = useState(false);
  const [pendingSession, setPendingSession] = useState<{
    subject: string;
    year: string;
  } | null>(null);

  // Track all question IDs across all pages for accurate submission
  const [allQuestionIds, setAllQuestionIds] = useState<{id: string; pageNum: number}[]>([]);

  // When questions load for a page, register their IDs
  useEffect(() => {
    if (questions.length > 0 && questionPage) {
      setAllQuestionIds(prev => {
        // Remove any existing entries for this page
        const filtered = prev.filter(q => q.pageNum !== questionPage);
        const newEntries = questions.map(q => ({ id: q.id, pageNum: questionPage }));
        return [...filtered, ...newEntries];
      });
    }
  }, [questions, questionPage]);

  // Reset allQuestionIds when session resets
  useEffect(() => {
    if (!selectedSubject || !selectedYear) {
      setAllQuestionIds([]);
    }
  }, [selectedSubject, selectedYear]);
  const isRestoringDraftRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  function getDraftKey(subject?: string, year?: string) {
    const s = subject || selectedSubject || "";
    const y = year || selectedYear || "";
    const sid = schoolId || "global";
    return `jamb_draft:${sid}:${s}:${y}`;
  }

  function getSessionKey() {
    const sid = schoolId || "global";
    return `jamb_session:${sid}`;
  }

  function saveSessionState(subject: string, year: string) {
    try {
      if (typeof window === "undefined") return;
      const key = getSessionKey();
      const session = { subject, year, timestamp: Date.now() };
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
      isRestoringDraftRef.current = true;
      setSelectedSubject(pendingSession.subject);
      setSelectedYear(pendingSession.year);
      setShowRestoreDialog(false);
    }
  }

  function handleStartFresh() {
    isRestoringDraftRef.current = false;
    clearSessionState();
    setSelectedSubject("");
    setSelectedYear("");
    setAnswers({});
    setQuestions([]);
    setAllQuestionIds([]);
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
      setSelectedYear("");
      setQuestions([]);
      setAnswers({});
      setAttemptResult(null);
      setQuestionDebug(null);
      return;
    }

    // If there's a pending session for this subject, don't wipe the year
    // because the restore flow will apply it. Otherwise, reset year.
    if (!(pendingSession && pendingSession.subject === selectedSubject)) {
      setSelectedYear("");
    }

    setQuestions([]);
    setAnswers({});
    setAttemptResult(null);
    setQuestionDebug(null);

    void loadAvailableFilters(selectedSubject).catch((error: any) => {
      console.error("Failed to load subject filters:", error);
      toast.error(error.message || "Failed to load available years");
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
      throw new Error("Failed to load available years");
    }

    const result = await response.json();
    const loadedYears = Array.isArray(result.years)
      ? result.years
        .map((year: any) => Number(year))
        .filter((year: number) => Number.isFinite(year))
        .sort((a: number, b: number) => b - a)
      : [];

    setYears(loadedYears);
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
        limit: String(QUESTIONS_PER_PAGE),
        page: String(page),
      });

      console.info("[student/jamb/page] loading questions", {
        subject: selectedSubject,
        year: selectedYear,
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
      // Restore any saved answers for this subject/year
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
      isRestoringDraftRef.current = false;

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

      // Mark session as active now that questions are loaded
      if (loadedQuestions.length > 0) {
        setIsSessionActive(true);
        setResultWizardStep(1);
      }

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

  function handleFilterChange(type: "subject" | "year", value: string) {
    if (isSessionActive && !attemptResult) {
      setPendingFilterChange({ type, value });
      setShowTerminationDialog(true);
    } else {
      applyFilterChange(type, value);
    }
  }

  function applyFilterChange(type: "subject" | "year", value: string) {
    if (type === "subject") setSelectedSubject(value);
    else if (type === "year") setSelectedYear(value);
  }

  function handleConfirmTermination() {
    if (pendingFilterChange) {
      setAnswers({});
      setQuestions([]);
      setAllQuestionIds([]);
      setAttemptResult(null);
      setIsSessionActive(false);
      clearSessionState();
      applyFilterChange(pendingFilterChange.type, pendingFilterChange.value);
      setPendingFilterChange(null);
      setShowTerminationDialog(false);
      toast.success("Session terminated. You can start a new practice session.");
    }
  }

  function handleSaveAndExit() {
    clearSessionState();
    toast.success("Progress saved. You can resume this session later.");
    window.location.href = "/student";
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
    if (isRestoringDraftRef.current) return;

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
  }, [answers, selectedSubject, selectedYear]);

  // save on unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (isRestoringDraftRef.current) return;
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
  }, [answers, selectedSubject, selectedYear]);

  // Auto-load questions when subject + year are selected
  useEffect(() => {
    if (selectedSubject && selectedYear) {
      saveSessionState(selectedSubject, selectedYear);
      void loadQuestions(1);
    }
  // intentionally exclude loadQuestions from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedYear]);

  async function submitAttempt() {
    if (!allQuestionIds.length && !questions.length) return;

    try {
      setSubmitting(true);
      setShowPreSubmitReview(false);

      // Use all tracked question IDs across all pages
      const questionIdsToSubmit = allQuestionIds.length > 0
        ? allQuestionIds.map(q => q.id)
        : questions.map(q => q.id);

      const answersPayload = questionIdsToSubmit.map((questionId) => ({
        questionId,
        selectedOption: answers[questionId] || null,
      }));

      const response = await fetch("/api/student/jamb/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectSlug: selectedSubject,
          subjectName: filteredSubjectLabel,
          examYear: Number(selectedYear),
          answers: answersPayload,
          totalQuestions,
          totalPages: questionTotalPages,
          questionsPerPage: QUESTIONS_PER_PAGE,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit attempt");
      }

      // Fetch previous attempt for comparison
      const prevResponse = await fetch(
        `/api/student/jamb/previous-attempt?subject=${encodeURIComponent(selectedSubject)}&year=${selectedYear}`,
        { cache: "no-store" }
      );
      const prevResult = prevResponse.ok ? await prevResponse.json() : null;

      setAttemptResult({
        ...result.data,
        previousAttempt: prevResult?.data,
      });
      setShowResultWizard(true);
      setResultWizardStep(1);
      setIsSessionActive(false);
      clearSessionState();
      toast.success("Attempt submitted successfully");
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
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel onClick={handleStartFresh}>Start Fresh</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreSession}>Resume Session</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showTerminationDialog} onOpenChange={setShowTerminationDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Terminate Current Session?</AlertDialogTitle>
          <AlertDialogDescription>
            You have an active practice session with unanswered questions. Changing the subject or year will clear your current progress and start a new session.
            {pendingFilterChange && (
              <div className="mt-3 space-y-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="text-sm text-amber-900">Your answers will be lost. This action cannot be undone.</div>
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTermination} className="bg-red-600 hover:bg-red-700">
              Terminate & Change
            </AlertDialogAction>
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
              Welcome {studentName}. Pick a subject and year, then practice past questions.
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50">Step 1</Badge>
                    <p className="text-sm font-medium text-gray-700">Subject</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select value={selectedSubject} onValueChange={(value) => handleFilterChange("subject", value)}>
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
                  <Select value={selectedYear} onValueChange={(value) => handleFilterChange("year", value)} disabled={!selectedSubject}>
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
              </div>

              {selectedSubject && selectedYear && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center gap-2 text-sm text-blue-900">
                  <span>📚 {subjects.find(s => s.slug === selectedSubject)?.name} • 📅 {selectedYear}</span>
                </div>
              )}
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
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <p className="text-sm text-gray-500">Pages completed</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {Object.values(pageCompletion).filter(Boolean).length}/{questionTotalPages}
                </p>
                {questionTotalPages > 0 && <p className="mt-1 text-xs text-gray-500">{QUESTIONS_PER_PAGE} questions per page</p>}
              </div>

              {questions.length > 0 && !attemptResult && (
                <div className="space-y-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => setShowPreSubmitReview(true)}
                    disabled={submitting}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    Submit Attempt
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveAndExit}
                    className="w-full gap-2"
                  >
                    Save & Exit
                  </Button>
                </div>
              )}
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
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleSaveAndExit} className="gap-2">
                    Save & Exit
                  </Button>
                  <Button type="button" onClick={() => setShowPreSubmitReview(true)} disabled={submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    Submit Attempt
                  </Button>
                </div>
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
                        </p>
                      </div>
                      <Badge variant="outline">JAMB CBT</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5 p-6">
                    <p className="text-lg font-medium text-gray-900 preserve-whitespace">{renderQuestionWithMathML(question.question_text)}</p>

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
                            <span className="text-base">{formatJambOptionText(option)}</span>
                          </Button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-gray-600">
                      <span>
                        {answers[question.id]
                          ? `Selected answer: ${formatJambOptionText(answers[question.id])}`
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

      <Dialog open={showPreSubmitReview} onOpenChange={setShowPreSubmitReview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Review Before Submitting
            </DialogTitle>
            <DialogDescription>
              Check your progress across all pages before submitting. Unanswered questions will be marked incorrect.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-emerald-50 p-4 text-center">
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Answered</p>
                <p className="mt-1 text-3xl font-bold text-emerald-800">{totalAnsweredCount}</p>
              </div>
              <div className="rounded-xl border bg-amber-50 p-4 text-center">
                <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Unanswered</p>
                <p className="mt-1 text-3xl font-bold text-amber-800">
                  {Math.max(totalQuestions - totalAnsweredCount, 0)}
                </p>
              </div>
              <div className="rounded-xl border bg-blue-50 p-4 text-center">
                <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Total</p>
                <p className="mt-1 text-3xl font-bold text-blue-800">{totalQuestions}</p>
              </div>
            </div>

            {/* Overall progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Overall Completion</p>
                <p className="text-sm font-semibold text-gray-900">{progressPercent}%</p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Per-page breakdown */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Page-by-page Breakdown</p>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {Array.from({ length: questionTotalPages }, (_, i) => i + 1).map((pageNum) => {
                  const isComplete = isPageComplete(pageNum);
                  const pageAnswered = getPageAnsweredCount(pageNum);
                  const isCurrent = pageNum === questionPage;

                  return (
                    <div
                      key={pageNum}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        isComplete
                          ? "border-emerald-200 bg-emerald-50"
                          : pageAnswered > 0
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        ) : pageAnswered > 0 ? (
                          <HelpCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-800">
                          Page {pageNum}
                          {isCurrent && <span className="ml-2 text-xs text-blue-600 font-normal">(current)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : "bg-amber-400"}`}
                            style={{ width: `${(pageAnswered / QUESTIONS_PER_PAGE) * 100}%` }}
                          />
                        </div>
                        <span className={`text-sm font-semibold ${isComplete ? "text-emerald-700" : pageAnswered > 0 ? "text-amber-700" : "text-slate-500"}`}>
                          {pageAnswered}/{QUESTIONS_PER_PAGE}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warning if unanswered */}
            {totalAnsweredCount < totalQuestions && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  You have {Math.max(totalQuestions - totalAnsweredCount, 0)} unanswered question(s).
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  You can still submit — unanswered questions will count as incorrect.
                </p>
              </div>
            )}

            {totalAnsweredCount === totalQuestions && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  All questions answered! You&apos;re ready to submit.
                </p>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">
                Total questions are estimated as {questionTotalPages} pages × {QUESTIONS_PER_PAGE} questions. The final page may contain fewer questions.
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setShowPreSubmitReview(false)}>
              Go Back & Review
            </Button>
            <Button
              onClick={submitAttempt}
              disabled={submitting}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Confirm & Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showResultWizard} onOpenChange={setShowResultWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {resultWizardStep === 1 ? "Practice Session Summary" : "Your Results"}
            </DialogTitle>
            <DialogDescription>
              {resultWizardStep === 1
                ? "Review your answers before viewing your score"
                : "See your score and review missed questions"}
            </DialogDescription>
          </DialogHeader>

          {resultWizardStep === 1 && attemptResult && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">Total Questions</p>
                    <p className="mt-2 text-3xl font-bold text-gray-900">
                      {attemptResult.totalQuestions}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">Answered</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-600">
                      {attemptResult.answeredCount || 0}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">Unanswered</p>
                    <p className="mt-2 text-3xl font-bold text-amber-600">
                      {(attemptResult.totalQuestions || 0) - (attemptResult.answeredCount || 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Progress</p>
                <div className="space-y-2">
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                      style={{
                        width: `${((attemptResult.answeredCount || 0) / (attemptResult.totalQuestions || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    {Math.round(((attemptResult.answeredCount || 0) / (attemptResult.totalQuestions || 1)) * 100)}% complete
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm text-blue-900">
                  ✓ Ready to view your score and detailed feedback?
                </p>
              </div>

              <div className="flex gap-3 justify-end border-t pt-6">
                <Button variant="outline" onClick={() => setShowResultWizard(false)}>
                  Close
                </Button>
                <Button onClick={() => setResultWizardStep(2)} className="gap-2">
                  <Trophy className="h-4 w-4" />
                  View Score
                </Button>
              </div>
            </div>
          )}

          {resultWizardStep === 2 && attemptResult && (
            <div className="space-y-6">
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-emerald-700">Your Score</p>
                    <h2 className="mt-2 text-4xl font-bold text-emerald-900">
                      {attemptResult.score}%
                    </h2>
                    <p className="mt-2 text-sm text-emerald-700">
                      {attemptResult.correctCount} out of {attemptResult.totalQuestions} questions correct
                    </p>
                  </div>
                </CardContent>
              </Card>

              {attemptResult.previousAttempt && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-6">
                    <p className="text-sm font-medium text-blue-700 mb-3">Comparison with Previous Attempt</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-blue-600">Previous score</p>
                        <p className="mt-1 text-2xl font-bold text-blue-900">
                          {attemptResult.previousAttempt.score}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600">Improvement</p>
                        <p className={`mt-1 text-2xl font-bold ${attemptResult.score >= attemptResult.previousAttempt.score ? "text-emerald-600" : "text-red-600"}`}>
                          {attemptResult.score > attemptResult.previousAttempt.score ? "+" : ""}{(attemptResult.score - attemptResult.previousAttempt.score).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(attemptResult.unansweredCount ?? 0) > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-amber-600" />
                    Unanswered Questions ({attemptResult.unansweredCount ?? 0})
                  </p>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <p className="text-sm text-amber-900">
                      {attemptResult.unansweredQuestions?.join(", ") || `${attemptResult.unansweredCount ?? 0} questions`}
                    </p>
                  </div>
                </div>
              )}

              {(attemptResult.missedCount ?? 0) > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Incorrect Answers ({attemptResult.missedCount ?? 0})
                  </p>
                  <div className="space-y-4">
                    {attemptResult.missedQuestions?.map((item: any, idx: number) => (
                      <div key={idx} className="rounded-lg border bg-white p-4">
                        <p className="text-sm font-medium text-gray-900 mb-3">
                          Question {item.questionNumber || idx + 1}
                        </p>
                        <div className="space-y-2 text-sm">
                          {item.questionText && (
                            <div>
                              <p className="text-gray-600 mb-1">Question:</p>
                              <p className="text-gray-900">{formatJambText(item.questionText)}</p>
                            </div>
                          )}
                          <div className="rounded bg-red-50 p-2 border border-red-200">
                            <p className="text-red-700 font-medium">Your answer:</p>
                            <p className="text-red-900">{formatJambOptionText(item.userAnswer)}</p>
                          </div>
                          <div className="rounded bg-emerald-50 p-2 border border-emerald-200">
                            <p className="text-emerald-700 font-medium">Correct answer:</p>
                            <p className="text-emerald-900">{formatJambOptionText(item.correctAnswer)}</p>
                          </div>
                          {item.explanation && (
                            <div className="rounded bg-blue-50 p-2 border border-blue-200">
                              <p className="text-blue-700 font-medium">Explanation:</p>
                              <p className="text-blue-900 text-xs">{formatJambText(item.explanation)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end border-t pt-6">
                <Button variant="outline" onClick={() => setResultWizardStep(1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button asChild>
                  <Link href="/student">Back to dashboard</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}