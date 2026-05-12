"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
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
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Lock,
  ShieldCheck,
  Trophy,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  LayoutGrid,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type SubjectOption = { slug: string; name: string };

type QuestionRow = {
  id: string;
  question_text: string;
  options: string[];
  subject_slug: string;
  subject_name: string;
  exam_year: number;
  image_url?: string | null;
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
  previousAttempt?: { score: number; correctCount: number; totalQuestions: number };
};

/* ─── Constants ──────────────────────────────────────────────────────────── */

const QUESTIONS_PER_PAGE = 5;
const QUESTION_CARD_ID = "jamb-question-card";

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function stripLeadingOptionLabel(input: string) {
  if (!input) return "";
  return input.replace(/^\s*(?:[A-Ea-e])\s*(?:[\.\)\-:\u2014])?\s*/i, "").trim();
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) => {
        const raw = (cell.textContent || "").replace(/\s+/g, " ").trim();
        return raw.replace(/\|/g, "\\|");
      })
    )
    .filter((row) => row.length > 0);
  if (!rows.length) return "";
  const maxCols = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    row.length >= maxCols ? row : [...row, ...Array.from({ length: maxCols - row.length }, () => "")]
  );
  const header = normalizedRows[0];
  const separator = Array.from({ length: maxCols }, () => "---");
  const body = normalizedRows.slice(1);
  const asLine = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [asLine(header), asLine(separator), ...body.map(asLine)].join("\n");
}

function normalizeMathContent(input: string): string {
  if (!input) return "";
  let normalized = input
    .replace(/\\\[(.+?)\\\]/gs, (_m, expr: string) => `$$${expr}$$`)
    .replace(/\\\((.+?)\\\)/g, (_m, expr: string) => `$${expr}$`)
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ");
  if (typeof window !== "undefined" && /<[^>]+>/.test(normalized)) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${normalized}</div>`, "text/html");
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (root) {
        root.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
        root.querySelectorAll('script[type^="math/tex"]').forEach((script) => {
          const latex = (script.textContent || "").trim();
          script.replaceWith(latex ? ` $${latex}$ ` : " ");
        });
        root.querySelectorAll("mjx-container").forEach((container) => {
          const tex =
            container.getAttribute("data-tex") ||
            container.getAttribute("aria-label") ||
            container.textContent ||
            "";
          container.replaceWith(tex ? ` $${tex.trim()}$ ` : " ");
        });
        root.querySelectorAll("table").forEach((table) => {
          if (!(table instanceof HTMLTableElement)) return;
          const markdownTable = tableToMarkdown(table);
          table.replaceWith(markdownTable ? `\n\n${markdownTable}\n\n` : " ");
        });
        normalized = root.textContent || normalized;
      }
    } catch (error) {
      console.error("Failed to normalize question content", error);
    }
  }
  return normalized.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

const OPTION_LABELS = ["A", "B", "C", "D", "E"];

/* ─── Component ──────────────────────────────────────────────────────────── */

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
  } | null>(null);

  // Page-level pagination (each "page" has QUESTIONS_PER_PAGE questions)
  const [questionPage, setQuestionPage] = useState(1);
  const [questionTotalPages, setQuestionTotalPages] = useState(1);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

  // Index of the active question within the current page (0-based)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

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
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showPreSubmitReview, setShowPreSubmitReview] = useState(false);
  const [pendingSession, setPendingSession] = useState<{ subject: string; year: string } | null>(null);
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);

  /* ── MathText ── */
  const MathText = ({ content }: { content: string }) => {
    const normalized = useMemo(() => normalizeMathContent(content), [content]);
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore" }]]}
        components={{
          p: ({ node, ...props }) => <span {...props} />,
          table: ({ node, ...props }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full border-collapse text-sm" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-slate-100" {...props} />,
          th: ({ node, ...props }) => (
            <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-700" {...props} />
          ),
          td: ({ node, ...props }) => <td className="border border-slate-200 px-3 py-2" {...props} />,
        }}
      >
        {normalized}
      </ReactMarkdown>
    );
  };

  /* ── Question ID tracking ── */
  const [allQuestionIds, setAllQuestionIds] = useState<{ id: string; pageNum: number }[]>([]);

  useEffect(() => {
    if (questions.length > 0 && questionPage) {
      setAllQuestionIds((prev) => {
        const filtered = prev.filter((q) => q.pageNum !== questionPage);
        const newEntries = questions.map((q) => ({ id: q.id, pageNum: questionPage }));
        return [...filtered, ...newEntries];
      });
    }
  }, [questions, questionPage]);

  useEffect(() => {
    if (!selectedSubject || !selectedYear) setAllQuestionIds([]);
  }, [selectedSubject, selectedYear]);

  /* ── Draft persistence ── */
  const isRestoringDraftRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pageCompletion, setPageCompletion] = useState<Record<number, boolean>>({});

  function getDraftKey(subject?: string, year?: string) {
    const s = subject || selectedSubject || "";
    const y = year || selectedYear || "";
    const sid = schoolId || "global";
    return `jamb_draft:${sid}:${s}:${y}`;
  }
  function getSessionKey() {
    return `jamb_session:${schoolId || "global"}`;
  }
  function saveSessionState(subject: string, year: string) {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(getSessionKey(), JSON.stringify({ subject, year, timestamp: Date.now() }));
    } catch (e) {
      console.error(e);
    }
  }
  function loadSessionState() {
    try {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(getSessionKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clearSessionState() {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(getSessionKey());
    } catch (e) { }
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
    setTotalQuestionCount(0);
    setPageCompletion({});
    setShowRestoreDialog(false);
    toast.success("Started fresh session");
  }
  function loadDraftFromLocalStorage(key?: string) {
    try {
      const k = key || getDraftKey();
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
      if (!raw) return {} as Record<string, string>;
      return JSON.parse(raw).answers || {};
    } catch (e) {
      return {} as Record<string, string>;
    }
  }
  function saveDraftToLocalStorage(data?: Record<string, string>) {
    try {
      const k = getDraftKey();
      const payload = {
        subject: selectedSubject,
        year: selectedYear,
        updatedAt: Date.now(),
        answers: data || answers,
        pageCompletion,
      };
      if (typeof window !== "undefined") window.localStorage.setItem(k, JSON.stringify(payload));
    } catch (e) { }
  }

  /* ── Load ── */
  useEffect(() => {
    if (!schoolLoading && schoolId) loadJambData();
  }, [schoolId, schoolLoading]);

  async function loadJambData() {
    if (!schoolId) return;
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user) { toast.error("Please log in"); window.location.href = "/student/login"; return; }
      const { data: student, error: studentError } = await supabase
        .from("students").select("id, first_name, last_name")
        .eq("user_id", user.id).eq("school_id", schoolId).single();
      if (studentError || !student) { toast.error("Student profile not found"); return; }
      setStudentName(`${student.first_name} ${student.last_name}`);
      const { data: jambAccess } = await supabase
        .from("jamb_student_access").select("id")
        .eq("student_id", student.id).eq("school_id", schoolId).eq("is_active", true).maybeSingle();
      if (!jambAccess) { setHasAccess(false); return; }
      setHasAccess(true);
      const savedSession = loadSessionState();
      if (savedSession?.subject && savedSession?.year) {
        setPendingSession(savedSession);
        setShowRestoreDialog(true);
      }
      await fetchSubjects();
    } catch (error: any) {
      toast.error(error.message || "Failed to load JAMB data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSubjects() {
    try {
      setSubjectLoading(true);
      const { data: catalogRows, error: catalogError } = await supabase
        .from("jamb_subjects")
        .select("slug, name")
        .order("name", { ascending: true });

      if (!catalogError && (catalogRows?.length || 0) > 0) {
        const fromCatalog = (catalogRows || [])
          .filter((row: any) => !!row.slug && !!row.name)
          .map((row: any): SubjectOption => ({ slug: row.slug, name: row.name }));
        setSubjects(fromCatalog);
      } else {
        const pageSize = 1000;
        let from = 0;
        let allRows: Array<{ subject_slug: string; subject_name: string }> = [];

        // Compatibility fallback for environments that have not migrated jamb_subjects yet.
        while (true) {
          const { data, error } = await supabase
            .from("jamb_questions")
            .select("subject_slug, subject_name")
            .order("subject_name", { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;

          const batch = (data || []) as Array<{ subject_slug: string; subject_name: string }>;
          allRows = allRows.concat(batch);
          if (batch.length < pageSize) break;
          from += pageSize;
        }

        const subjectMap = new Map<string, SubjectOption>(
          allRows
            .filter((row) => !!row.subject_slug && !!row.subject_name)
            .map((row): [string, SubjectOption] => [
              row.subject_slug,
              { slug: row.subject_slug, name: row.subject_name },
            ])
        );
        setSubjects(Array.from(subjectMap.values()));
      }
      setSubjectPage(1);
      setSubjectTotalPages(1);
    } catch (error: any) {
      toast.error(error.message || "Failed to load subjects");
    } finally {
      setSubjectLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedSubject) {
      setYears([]); setSelectedYear(""); setQuestions([]); setAnswers({}); setAttemptResult(null); setQuestionDebug(null); setTotalQuestionCount(0);
      setPageCompletion({});
      return;
    }
    if (!(pendingSession && pendingSession.subject === selectedSubject)) setSelectedYear("");
    setQuestions([]); setAnswers({}); setAttemptResult(null); setQuestionDebug(null); setTotalQuestionCount(0); setPageCompletion({});
    void loadAvailableFilters(selectedSubject).catch((err: any) => toast.error(err.message || "Failed to load years"));
  }, [selectedSubject, pendingSession]);

  const filteredSubjectLabel = useMemo(
    () => subjects.find((s) => s.slug === selectedSubject)?.name || "JAMB",
    [selectedSubject, subjects]
  );

  /* ── Computed totals ── */
  const answeredOnPage = useMemo(
    () => questions.reduce((c, q) => (answers[q.id] ? c + 1 : c), 0),
    [answers, questions]
  );
  const totalQuestions = useMemo(() => totalQuestionCount, [totalQuestionCount]);
  const totalAnsweredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progressPercent = useMemo(
    () => (totalQuestions ? Math.round((totalAnsweredCount / totalQuestions) * 100) : 0),
    [totalAnsweredCount, totalQuestions]
  );

  const isPageComplete = (p: number) => pageCompletion[p] === true;
  const getPageAnsweredCount = (p: number) =>
    p === questionPage ? answeredOnPage : pageCompletion[p] ? QUESTIONS_PER_PAGE : 0;

  /* ── Global question number helpers ── */
  const globalQuestionNumber = (pageNum: number, indexOnPage: number) =>
    (pageNum - 1) * QUESTIONS_PER_PAGE + indexOnPage + 1;

  const activeQuestion = questions[activeQuestionIndex] ?? null;
  const activeGlobalNumber = globalQuestionNumber(questionPage, activeQuestionIndex);

  function scrollToQuestionCard() {
    if (typeof window === "undefined") return;
    const card = document.getElementById(QUESTION_CARD_ID);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Navigation ── */
  function goToQuestion(pageNum: number, indexOnPage: number) {
    if (pageNum === questionPage) {
      setActiveQuestionIndex(indexOnPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      loadQuestions(pageNum, indexOnPage);
    }
  }

  function handlePrevQuestion() {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex(activeQuestionIndex - 1);
      requestAnimationFrame(() => scrollToQuestionCard());
    } else if (questionPage > 1) {
      loadQuestions(questionPage - 1, QUESTIONS_PER_PAGE - 1);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToQuestionCard()));
    }
  }

  function handleNextQuestion() {
    if (activeQuestionIndex < questions.length - 1) {
      setActiveQuestionIndex(activeQuestionIndex + 1);
      requestAnimationFrame(() => scrollToQuestionCard());
    } else if (questionPage < questionTotalPages) {
      loadQuestions(questionPage + 1, 0);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToQuestionCard()));
    }
  }

  const isFirstQuestion = questionPage === 1 && activeQuestionIndex === 0;
  const isLastQuestion =
    questionPage === questionTotalPages && activeQuestionIndex === questions.length - 1;

  /* ── Filters ── */
  async function loadAvailableFilters(subjectSlug: string) {
    const { data, error } = await supabase
      .from("jamb_questions").select("exam_year").eq("subject_slug", subjectSlug).order("exam_year", { ascending: false });
    if (error) throw error;
    const uniqueYears: number[] = Array.from(new Set((data || []).map((row: any) => row.exam_year)))
      .filter((y: any) => Number.isFinite(y)).map((y: any) => Number(y)).sort((a, b) => b - a);
    setYears(uniqueYears);
  }

  async function loadQuestions(page = 1, targetIndex = 0) {
    if (!selectedSubject || !selectedYear) { toast.error("Please select a subject and year"); return; }
    try {
      setLoadingQuestions(true);
      const offset = (page - 1) * QUESTIONS_PER_PAGE;
      const { count: totalCount, error: countError } = await supabase
        .from("jamb_questions").select("id", { count: "exact", head: true })
        .eq("subject_slug", selectedSubject).eq("exam_year", Number(selectedYear));
      if (countError) throw countError;
      const { data, error } = await supabase
        .from("jamb_questions")
        .select("id, question_text, options, subject_slug, subject_name, exam_year, image_url")
        .eq("subject_slug", selectedSubject).eq("exam_year", Number(selectedYear))
        .order("id", { ascending: true }).range(offset, offset + QUESTIONS_PER_PAGE - 1);
      if (error) throw error;
      const loadedQuestions: QuestionRow[] = (data || []).map((row: any) => ({
        id: row.id,
        question_text: row.question_text,
        options: Array.isArray(row.options) ? row.options : [],
        subject_slug: row.subject_slug,
        subject_name: row.subject_name,
        exam_year: row.exam_year,
        image_url: row.image_url || null,
      }));
      const totalPages = Math.ceil((totalCount || 0) / QUESTIONS_PER_PAGE);
      const hasMore = page < totalPages;
      if (loadedQuestions.length === 0 && page === 1) toast.info("No questions matched the selected filters");
      setTotalQuestionCount(totalCount || 0);
      setQuestions(loadedQuestions);
      try {
        const saved = loadDraftFromLocalStorage();
        if (saved && Object.keys(saved).length) setAnswers((cur) => ({ ...cur, ...saved }));
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(getDraftKey()) : null;
        if (raw) { const parsed = JSON.parse(raw); if (parsed.pageCompletion) setPageCompletion(parsed.pageCompletion); }
      } catch (e) { }
      setAttemptResult(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      isRestoringDraftRef.current = false;
      setQuestionPage(page);
      setQuestionTotalPages(totalPages || 1);
      setHasMoreQuestions(hasMore);
      setQuestionDebug({ page, totalPages: totalPages || 1, count: loadedQuestions.length, hasMore });
      setActiveQuestionIndex(Math.min(targetIndex, loadedQuestions.length - 1));
      if (loadedQuestions.length > 0) { setIsSessionActive(true); }
    } catch (error: any) {
      toast.error(error.message || "Failed to load questions");
    } finally {
      setLoadingQuestions(false);
    }
  }

  function applyFilterChange(type: "subject" | "year", value: string) {
    if (type === "subject") setSelectedSubject(value);
    else setSelectedYear(value);
  }
  function handleFilterChange(type: "subject" | "year", value: string) {
    const currentValue = type === "subject" ? selectedSubject : selectedYear;
    if (value === currentValue) return;
    if (isSessionActive && Object.keys(answers).length > 0) {
      setPendingFilterChange({ type, value });
      setShowTerminationDialog(true);
      return;
    }
    applyFilterChange(type, value);
  }
  function handleConfirmTermination() {
    if (pendingFilterChange) {
      setAnswers({}); setQuestions([]); setAllQuestionIds([]); setAttemptResult(null); setTotalQuestionCount(0);
      setPageCompletion({});
      setIsSessionActive(false); clearSessionState();
      applyFilterChange(pendingFilterChange.type, pendingFilterChange.value);
      setPendingFilterChange(null); setShowTerminationDialog(false);
      toast.success("Session terminated. Starting fresh.");
    }
  }
  function handleSaveAndExit() { clearSessionState(); toast.success("Progress saved."); window.location.href = "/student"; }

  function recordAnswer(id: string, option: string) {
    setAnswers((prev) => ({ ...prev, [id]: option }));
    setAttemptResult(null);
  }

  useEffect(() => {
    if (questions.length === QUESTIONS_PER_PAGE && questionPage) {
      const allAnswered = questions.every((q) => answers[q.id]);
      if (allAnswered !== pageCompletion[questionPage]) {
        setPageCompletion((prev) => ({ ...prev, [questionPage]: allAnswered }));
      }
    }
  }, [answers, questions, questionPage, pageCompletion]);

  useEffect(() => {
    if (!selectedSubject || !selectedYear) return;
    if (isRestoringDraftRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    // @ts-ignore
    saveTimerRef.current = window.setTimeout(() => { saveDraftToLocalStorage(); saveTimerRef.current = null; }, 800);
    return () => { if (saveTimerRef.current) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; } };
  }, [answers, selectedSubject, selectedYear]);

  useEffect(() => {
    function handleBeforeUnload() { if (!isRestoringDraftRef.current) saveDraftToLocalStorage(); }
    if (typeof window !== "undefined") window.addEventListener("beforeunload", handleBeforeUnload);
    return () => { if (typeof window !== "undefined") window.removeEventListener("beforeunload", handleBeforeUnload); };
  }, [answers, selectedSubject, selectedYear]);

  useEffect(() => {
    if (selectedSubject && selectedYear) { saveSessionState(selectedSubject, selectedYear); void loadQuestions(1, 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubject, selectedYear]);

  async function submitAttempt() {
    if (!allQuestionIds.length && !questions.length) return;
    try {
      setSubmitting(true); setShowPreSubmitReview(false);
      const questionIdsToSubmit = allQuestionIds.length > 0 ? allQuestionIds.map((q) => q.id) : questions.map((q) => q.id);
      const answersPayload = questionIdsToSubmit.map((questionId) => ({ questionId, selectedOption: answers[questionId] || null }));
      const response = await fetch("/api/student/jamb/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectSlug: selectedSubject, subjectName: filteredSubjectLabel,
          examYear: Number(selectedYear), answers: answersPayload,
          totalQuestions, totalPages: questionTotalPages, questionsPerPage: QUESTIONS_PER_PAGE,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to submit attempt");
      const prevResponse = await fetch(
        `/api/student/jamb/previous-attempt?subject=${encodeURIComponent(selectedSubject)}&year=${selectedYear}`,
        { cache: "no-store" }
      );
      const prevResult = prevResponse.ok ? await prevResponse.json() : null;
      setAttemptResult({ ...result.data, previousAttempt: prevResult?.data });
      setShowResultWizard(true); setIsSessionActive(false); clearSessionState();
      toast.success("Attempt submitted successfully");
    } catch (error: any) {
      toast.error(error.message || "Unable to save attempt");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Loading state ── */
  if (loading || schoolLoading) {
    return (
      <DashboardLayout role="student">
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  /* ── No access ── */
  if (!hasAccess) {
    return (
      <DashboardLayout role="student">
        <div className="mx-auto max-w-2xl space-y-6 py-12 px-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 flex gap-4 items-start">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900">Access Restricted</p>
              <p className="mt-1 text-sm text-amber-700">JAMB CBT practice has not been enabled for your account yet. Contact your administrator to get access.</p>
            </div>
          </div>
          <Button asChild variant="outline"><Link href="/student">← Back to dashboard</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────── */
  /* Main render                                                             */
  /* ─────────────────────────────────────────────────────────────────────── */

  const hasQuestions = questions.length > 0;

  return (
    <DashboardLayout role="student">
      {/* ── Dialogs ── */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Resume previous session?</AlertDialogTitle>
          <AlertDialogDescription>
            We found a saved practice session. Would you like to pick up where you left off?
            {pendingSession && (
              <div className="mt-3 rounded-lg bg-slate-100 p-3 text-sm space-y-1">
                <div><span className="font-medium text-gray-700">Subject:</span> {subjects.find((s) => s.slug === pendingSession.subject)?.name || pendingSession.subject}</div>
                <div><span className="font-medium text-gray-700">Year:</span> {pendingSession.year}</div>
              </div>
            )}
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel onClick={handleStartFresh}>Start Fresh</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreSession}>Resume Session</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showTerminationDialog} onOpenChange={setShowTerminationDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>End current session?</AlertDialogTitle>
          <AlertDialogDescription>
            You have an active session in progress. Changing the subject or year will clear your answers — this cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-3 justify-end mt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmTermination} className="bg-red-600 hover:bg-red-700">End & Change</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Page body ── */}
      <div className="space-y-8 pb-16">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="success" className="gap-1.5 text-xs">
                <ShieldCheck className="h-3 w-3" />
                Access enabled
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">JAMB CBT Practice</h1>
            <p className="mt-0.5 text-sm text-gray-500">Welcome, {studentName}. Select a subject and year to begin.</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-md">
            <p className="text-xs text-blue-200 leading-none mb-1">Exam type</p>
            <p className="text-xl font-bold leading-none">JAMB</p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Subject */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">1</span>
                Subject
              </label>
              <Select value={selectedSubject} onValueChange={(v) => handleFilterChange("subject", v)}>
                <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Year */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${selectedSubject ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}>2</span>
                Exam Year
              </label>
              <Select value={selectedYear} onValueChange={(v) => handleFilterChange("year", v)} disabled={!selectedSubject}>
                <SelectTrigger className={!selectedSubject ? "opacity-50 cursor-not-allowed" : ""}>
                  <SelectValue placeholder={selectedSubject ? "Choose a year" : "Select subject first"} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedSubject && selectedYear && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-800">
              <BookOpen className="h-4 w-4 text-blue-500 shrink-0" />
              <span>{filteredSubjectLabel} · {selectedYear} · {totalQuestions} questions</span>
            </div>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {loadingQuestions && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-500">Loading questions…</p>
            </div>
          </div>
        )}

        {/* ── Question View ── */}
        {!loadingQuestions && hasQuestions && activeQuestion && (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">

            {/* Left: question card */}
            <div className="space-y-4">

              {/* Progress bar */}
              <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Question <span className="text-blue-600 font-bold">{activeGlobalNumber}</span> of {totalQuestions}
                  </span>
                  <span className="text-sm text-gray-500">{progressPercent}% complete</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                  <span>{totalAnsweredCount} answered</span>
                  <span>{totalQuestions - totalAnsweredCount} remaining</span>
                </div>
              </div>

              {/* Question card */}
              <div id={QUESTION_CARD_ID} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between gap-4 border-b bg-gradient-to-r from-slate-50 to-blue-50 px-6 py-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-blue-500">
                      {activeQuestion.subject_name} · {activeQuestion.exam_year}
                    </p>
                    <h2 className="mt-0.5 text-lg font-semibold text-gray-900">
                      Question {activeGlobalNumber}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {answers[activeQuestion.id] ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Answered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <HelpCircle className="h-3 w-3" /> Unanswered
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">JAMB CBT</Badge>
                  </div>
                </div>

                <div className="space-y-6 p-6">
                  {/* Image */}
                  {activeQuestion.image_url && (
                    <div className="flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <img
                        src={activeQuestion.image_url}
                        alt={`Question ${activeGlobalNumber}`}
                        className="max-h-64 max-w-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Question text */}
                  <div className="text-base font-medium leading-relaxed text-gray-900">
                    <MathText content={activeQuestion.question_text} />
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    {activeQuestion.options.map((option, idx) => {
                      const selected = answers[activeQuestion.id] === option;
                      const displayText = stripLeadingOptionLabel(option);
                      return (
                        <button
                          key={`${activeQuestion.id}-${idx}`}
                          type="button"
                          onClick={() => recordAnswer(activeQuestion.id, option)}
                          className={`group w-full flex items-start gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all duration-150 ${selected
                              ? "border-blue-500 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30"
                            }`}
                        >
                          <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${selected ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700"
                            }`}>
                            {OPTION_LABELS[idx]}
                          </span>
                          <span className="flex-1 text-base text-gray-800">
                            <MathText content={displayText} />
                          </span>
                          {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Question navigation */}
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={handlePrevQuestion}
                  disabled={isFirstQuestion || loadingQuestions}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>

                <button
                  onClick={() => setShowQuestionGrid(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-slate-100 transition-colors"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Jump to question
                </button>

                {isLastQuestion ? (
                  <Button
                    onClick={() => setShowPreSubmitReview(true)}
                    disabled={submitting}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    Submit Attempt
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion} disabled={loadingQuestions} className="gap-2">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Right: sticky sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-4">

                {/* Summary card */}
                <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
                  <p className="text-sm font-semibold text-gray-700">Session Summary</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
                      <p className="text-xs text-emerald-600 font-medium">Answered</p>
                      <p className="text-2xl font-bold text-emerald-700">{totalAnsweredCount}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
                      <p className="text-xs text-amber-600 font-medium">Remaining</p>
                      <p className="text-2xl font-bold text-amber-700">{Math.max(totalQuestions - totalAnsweredCount, 0)}</p>
                    </div>
                  </div>

                  {/* Page pills */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Pages</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: questionTotalPages }, (_, i) => i + 1).map((pn) => {
                        const complete = isPageComplete(pn);
                        const current = pn === questionPage;
                        const partial = getPageAnsweredCount(pn) > 0 && !complete;
                        return (
                          <button
                            key={pn}
                            onClick={() => loadQuestions(pn, 0)}
                            disabled={loadingQuestions}
                            title={`Page ${pn}: Q${(pn - 1) * QUESTIONS_PER_PAGE + 1}–${Math.min(pn * QUESTIONS_PER_PAGE, totalQuestions)}`}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold transition-colors ${current
                                ? "bg-blue-600 text-white"
                                : complete
                                  ? "bg-emerald-500 text-white"
                                  : partial
                                    ? "bg-amber-200 text-amber-900"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                          >
                            {pn}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question dots for current page */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Page {questionPage} questions
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {questions.map((q, idx) => {
                        const answered = !!answers[q.id];
                        const active = idx === activeQuestionIndex;
                        const gNum = globalQuestionNumber(questionPage, idx);
                        return (
                          <button
                            key={q.id}
                            onClick={() => setActiveQuestionIndex(idx)}
                            title={`Q${gNum}${answered ? " (answered)" : ""}`}
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold border-2 transition-all ${active
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : answered
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                              }`}
                          >
                            {gNum}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={() => setShowPreSubmitReview(true)}
                    disabled={submitting}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                    Submit Attempt
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSaveAndExit} className="w-full">
                    Save & Exit
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ── Result card ── */}
        {attemptResult && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Attempt saved</p>
              <h2 className="text-2xl font-bold text-emerald-900">{attemptResult.correctCount} / {attemptResult.totalQuestions} correct</h2>
              <p className="text-emerald-700">Score: {attemptResult.score}%</p>
            </div>
            <Button variant="outline" asChild><Link href="/student">Back to dashboard</Link></Button>
          </div>
        )}
      </div>

      {/* ── Question grid modal ── */}
      <Dialog open={showQuestionGrid} onOpenChange={setShowQuestionGrid}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Jump to Question</DialogTitle>
            <DialogDescription>Select any question to navigate directly to it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {Array.from({ length: questionTotalPages }, (_, pi) => pi + 1).map((pn) => (
              <div key={pn}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Page {pn} · Q{(pn - 1) * QUESTIONS_PER_PAGE + 1}–{Math.min(pn * QUESTIONS_PER_PAGE, totalQuestions)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: pn < questionTotalPages ? QUESTIONS_PER_PAGE : (totalQuestions - (questionTotalPages - 1) * QUESTIONS_PER_PAGE) }, (_, qi) => qi).map((qi) => {
                    const gNum = (pn - 1) * QUESTIONS_PER_PAGE + qi + 1;
                    const qId = pn === questionPage ? questions[qi]?.id : null;
                    const answered = qId ? !!answers[qId] : false;
                    const isActive = pn === questionPage && qi === activeQuestionIndex;
                    return (
                      <button
                        key={gNum}
                        onClick={() => { goToQuestion(pn, qi); setShowQuestionGrid(false); }}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold border-2 transition-all ${isActive
                            ? "border-blue-500 bg-blue-100 text-blue-700"
                            : answered
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                      >
                        {gNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-2 border-t text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-blue-500 bg-blue-100 inline-block" /> Current</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-emerald-400 bg-emerald-50 inline-block" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-slate-200 bg-white inline-block" /> Unanswered</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Pre-submit review ── */}
      <Dialog open={showPreSubmitReview} onOpenChange={setShowPreSubmitReview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Review Before Submitting
            </DialogTitle>
            <DialogDescription>
              Check your progress across all pages. Unanswered questions will be marked incorrect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-emerald-50 p-4 text-center">
                <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Answered</p>
                <p className="mt-1 text-3xl font-bold text-emerald-800">{totalAnsweredCount}</p>
              </div>
              <div className="rounded-xl border bg-amber-50 p-4 text-center">
                <p className="text-xs text-amber-700 font-medium uppercase tracking-wide">Unanswered</p>
                <p className="mt-1 text-3xl font-bold text-amber-800">{Math.max(totalQuestions - totalAnsweredCount, 0)}</p>
              </div>
              <div className="rounded-xl border bg-blue-50 p-4 text-center">
                <p className="text-xs text-blue-700 font-medium uppercase tracking-wide">Total</p>
                <p className="mt-1 text-3xl font-bold text-blue-800">{totalQuestions}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Overall Completion</p>
                <p className="text-sm font-semibold text-gray-900">{progressPercent}%</p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            {totalAnsweredCount < totalQuestions ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  You have {Math.max(totalQuestions - totalAnsweredCount, 0)} unanswered question(s). They will count as incorrect.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  All questions answered — you're ready to submit!
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setShowPreSubmitReview(false)}>Go Back & Review</Button>
            <Button onClick={submitAttempt} disabled={submitting} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Confirm & Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Results wizard ── */}
      <Dialog open={showResultWizard} onOpenChange={setShowResultWizard}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Results</DialogTitle>
            <DialogDescription>Your score and missed questions</DialogDescription>
          </DialogHeader>
          {attemptResult && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="text-sm font-medium text-emerald-700">Your Score</p>
                <h2 className="mt-1 text-5xl font-bold text-emerald-900">{attemptResult.score}%</h2>
                <p className="mt-2 text-sm text-emerald-700">{attemptResult.correctCount} out of {attemptResult.totalQuestions} correct</p>
              </div>
              {attemptResult.previousAttempt && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-700 mb-3">vs. Previous Attempt</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-blue-600">Previous score</p>
                      <p className="text-2xl font-bold text-blue-900">{attemptResult.previousAttempt.score}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600">Change</p>
                      <p className={`text-2xl font-bold ${attemptResult.score >= attemptResult.previousAttempt.score ? "text-emerald-600" : "text-red-600"}`}>
                        {attemptResult.score > attemptResult.previousAttempt.score ? "+" : ""}{(attemptResult.score - attemptResult.previousAttempt.score).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {(attemptResult.unansweredCount ?? 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-amber-600" />
                    Unanswered ({attemptResult.unansweredCount ?? 0})
                  </p>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                    {attemptResult.unansweredQuestions?.join(", ") || `${attemptResult.unansweredCount ?? 0} questions`}
                  </div>
                </div>
              )}
              {(attemptResult.missedCount ?? 0) > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Incorrect Answers ({attemptResult.missedCount ?? 0})
                  </p>
                  <div className="space-y-3">
                    {attemptResult.missedQuestions?.map((item: any, idx: number) => (
                      <div key={idx} className="rounded-xl border bg-white p-4 space-y-3">
                        <p className="text-sm font-semibold text-gray-900">Question {item.questionNumber || idx + 1}</p>
                        {item.questionText && <div className="text-sm text-gray-700"><MathText content={item.questionText} /></div>}
                        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                          <p className="text-red-700 font-medium text-xs mb-0.5">Your answer</p>
                          <p className="text-red-900"><MathText content={item.userAnswer} /></p>
                        </div>
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                          <p className="text-emerald-700 font-medium text-xs mb-0.5">Correct answer</p>
                          <p className="text-emerald-900">{item.correctAnswer}</p>
                        </div>
                        {item.explanation && (
                          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
                            <p className="text-blue-700 font-medium text-xs mb-0.5">Explanation</p>
                            <div className="text-blue-900"><MathText content={item.explanation} /></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 justify-end border-t pt-4">
                <Button variant="outline" onClick={() => setShowResultWizard(false)}>Close</Button>
                <Button asChild><Link href="/student">Back to dashboard</Link></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
