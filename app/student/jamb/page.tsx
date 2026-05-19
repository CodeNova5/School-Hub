"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  AlertCircle,
  Check,
  BrainCircuit,
  Timer,
  GraduationCap
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
import useExamTimer from "@/hooks/use-exam-timer";
import ExamTimerWidget from "@/components/jamb/exam-timer-widget";
import { getJambExamConfig, shuffleArray } from "@/lib/jamb-exam-config";
import { Checkbox } from "@/components/ui/checkbox";

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
    correctOption: string;
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

function getQuestionPageNumber(index: number) {
  return Math.floor(index / QUESTIONS_PER_PAGE) + 1;
}

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
  const [mode, setMode] = useState<"study" | "practice" | "exam">("practice");
  const [examSubjects, setExamSubjects] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [, setHasMoreQuestions] = useState(false);
  const [, setQuestionDebug] = useState<{
    page: number;
    totalPages: number;
    count: number;
    hasMore: boolean;
  } | null>(null);

  const [questionPage, setQuestionPage] = useState(1);
  const [questionTotalPages, setQuestionTotalPages] = useState(1);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);

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
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);
  const [timerInitialSeconds, setTimerInitialSeconds] = useState<number | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [previewData, setPreviewData] = useState<{ totalQuestions: number | null; previousAttempt: any | null; durationSeconds: number | null }>(
    { totalQuestions: null, previousAttempt: null, durationSeconds: null }
  );

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverStartTime, setServerStartTime] = useState<Date | null>(null);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number | null>(null);

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

  /* ── Draft persistence ── */
  const isRestoringDraftRef = useRef(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [pageCompletion, setPageCompletion] = useState<Record<number, boolean>>({});
  const hasAutoSubmittedRef = useRef(false);
  const hasTimerStartedRef = useRef(false);
  const examPoolRef = useRef<{ subjectSlug: string; examYear: string; questionIds: string[] } | null>(null);

  function clearExamPool() {
    examPoolRef.current = null;
    setAllQuestionIds([]);
  }

  function getDraftKey(subject?: string, year?: string) {
    const s = subject || selectedSubject || "";
    const y = year || selectedYear || "";
    const sid = schoolId || "global";
    return `jamb_draft:${sid}:${s}:${y}`;
  }

  function handleStartFresh() {
    isRestoringDraftRef.current = false;
    setSelectedSubject("");
    setSelectedYear("");
    setAnswers({});
    setQuestions([]);
    setAllQuestionIds([]);
    setTotalQuestionCount(0);
    setPageCompletion({});
    setShowRestoreDialog(false);
    setSessionToken(null);
    setSessionId(null);
    setServerStartTime(null);
    setMaxDurationSeconds(null);
    hasAutoSubmittedRef.current = false;
    hasTimerStartedRef.current = false;
    clearExamPool();
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
      if (catalogError) throw catalogError;

      const fromCatalog = (catalogRows || [])
        .filter((row: any) => !!row.slug && !!row.name)
        .map((row: any): SubjectOption => ({ slug: row.slug, name: row.name }));
      setSubjects(fromCatalog);
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
      clearExamPool();
      return;
    }
    setSelectedYear("");
    setQuestions([]); setAnswers({}); setAttemptResult(null); setQuestionDebug(null); setTotalQuestionCount(0); setPageCompletion({});
    clearExamPool();
    void loadAvailableFilters(selectedSubject).catch((err: any) => toast.error(err.message || "Failed to load years"));
  }, [selectedSubject]);

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

  const globalQuestionNumber = (pageNum: number, indexOnPage: number) =>
    (pageNum - 1) * QUESTIONS_PER_PAGE + indexOnPage + 1;

  const activeQuestion = questions[activeQuestionIndex] ?? null;
  const activeGlobalNumber = globalQuestionNumber(questionPage, activeQuestionIndex);

  function scrollToQuestionCard() {
    if (typeof window === "undefined") return;
    const card = document.getElementById(QUESTION_CARD_ID);
    if (card) {
      const topOffset = 80;
      const elementPosition = card.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Navigation ── */
  function goToQuestion(pageNum: number, indexOnPage: number) {
    if (pageNum === questionPage) {
      setActiveQuestionIndex(indexOnPage);
      requestAnimationFrame(() => scrollToQuestionCard());
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
    const { data: yearRows, error: yearError } = await supabase
      .from("jamb_subject_years")
      .select("exam_year")
      .eq("subject_slug", subjectSlug)
      .order("exam_year", { ascending: false });
    if (yearError) throw yearError;

    const uniqueYears: number[] = Array.from(new Set((yearRows || []).map((row: any) => row.exam_year)))
      .filter((y: any) => Number.isFinite(y))
      .map((y: any) => Number(y))
      .sort((a, b) => b - a);
    setYears(uniqueYears);
  }

  async function loadQuestions(page = 1, targetIndex = 0) {
    if (mode === "exam") {
      if (!selectedYear || !(examSubjects && examSubjects.length)) { toast.error("Please select a year and exam subjects"); return; }
    } else {
      if (!selectedSubject || !selectedYear) { toast.error("Please select a subject and year"); return; }
    }
    try {
      setLoadingQuestions(true);
      const examConfig = mode === "exam" ? { questionCount: 0, durationMinutes: 120, isEnglish: false } : getJambExamConfig(selectedSubject);
      const poolMatches =
        examPoolRef.current &&
        examPoolRef.current.examYear === selectedYear &&
        Array.isArray(examPoolRef.current.questionIds) &&
        examPoolRef.current.questionIds.length > 0;

      if (!poolMatches) {
        let selectedIds: string[] = [];
        if (mode === "study") {
          const { data: idRows, error: idError } = await supabase
            .from("jamb_questions")
            .select("id")
            .eq("subject_slug", selectedSubject)
            .eq("exam_year", Number(selectedYear))
            .order("id", { ascending: true });
          if (idError) throw idError;
          selectedIds = shuffleArray((idRows || []).map((r: any) => r.id));
        } else if (mode === "practice") {
          const { data: idRows, error: idError } = await supabase
            .from("jamb_questions")
            .select("id")
            .eq("subject_slug", selectedSubject)
            .eq("exam_year", Number(selectedYear))
            .order("id", { ascending: true });
          if (idError) throw idError;
          const questionIdRows = (idRows || []) as Array<{ id: string }>;
          const shuffledIds = shuffleArray(questionIdRows.map((row) => row.id));
          selectedIds = shuffledIds.slice(0, Math.min(shuffledIds.length, examConfig.questionCount));
        } else if (mode === "exam") {
          const englishSlug = "english-language";
          const otherSlugs = Array.from(new Set([englishSlug, ...examSubjects]));
          if (!otherSlugs.includes(englishSlug)) otherSlugs.unshift(englishSlug);

          const perSubjectIds: Record<string, string[]> = {};
          for (const slug of otherSlugs) {
            const { data: idRows, error: idError } = await supabase
              .from("jamb_questions")
              .select("id")
              .eq("subject_slug", slug)
              .eq("exam_year", Number(selectedYear))
              .order("id", { ascending: true });
            if (idError) throw idError;
            perSubjectIds[slug] = shuffleArray((idRows || []).map((r: any) => r.id));
          }

          const englishIds = perSubjectIds[englishSlug] || [];
          const pickEnglish = englishIds.slice(0, Math.min(englishIds.length, 60));
          const others = otherSlugs.filter((s) => s !== englishSlug).flatMap((s) => perSubjectIds[s] || []);
          const pickOthers = shuffleArray(others).slice(0, Math.min(others.length, 40));

          selectedIds = shuffleArray([...pickEnglish, ...pickOthers]);
        }

        examPoolRef.current = {
          subjectSlug: mode === "exam" ? "exam-multi" : selectedSubject,
          examYear: selectedYear,
          questionIds: selectedIds,
        } as any;
        setAllQuestionIds(((examPoolRef.current?.questionIds) || []).map((id: string, index: number) => ({ id, pageNum: getQuestionPageNumber(index) })));
      }

      const questionIds = examPoolRef.current?.questionIds || [];
      const totalCount = questionIds.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / QUESTIONS_PER_PAGE));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const offset = (safePage - 1) * QUESTIONS_PER_PAGE;
      const pageQuestionIds = questionIds.slice(offset, offset + QUESTIONS_PER_PAGE);

      const { data, error } = await supabase
        .from("jamb_questions")
        .select("id, question_text, options, subject_slug, subject_name, exam_year, image_url, correct_option, explanation")
        .in("id", pageQuestionIds);
      if (error) throw error;
      const orderedRows = (data || []).sort(
        (left: any, right: any) => pageQuestionIds.indexOf(left.id) - pageQuestionIds.indexOf(right.id)
      );
      const loadedQuestions: QuestionRow[] = orderedRows.map((row: any) => ({
        id: row.id,
        question_text: row.question_text,
        options: Array.isArray(row.options) ? row.options : [],
        subject_slug: row.subject_slug,
        subject_name: row.subject_name,
        exam_year: row.exam_year,
        image_url: row.image_url || null,
        correct_option: row.correct_option,
      }));
      const hasMore = safePage < totalPages;
      if (loadedQuestions.length === 0 && safePage === 1) toast.info("No questions matched the selected filters");
      setTotalQuestionCount(totalCount);
      setQuestions(loadedQuestions);
      try {
        const saved = loadDraftFromLocalStorage();
        if (saved && Object.keys(saved).length) setAnswers((cur) => ({ ...cur, ...saved }));
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(getDraftKey()) : null;
        if (raw) { const parsed = JSON.parse(raw); if (parsed.pageCompletion) setPageCompletion(parsed.pageCompletion); }
      } catch (e) { }
      setAttemptResult(null);
      isRestoringDraftRef.current = false;
      setQuestionPage(safePage);
      setQuestionTotalPages(totalPages || 1);
      setHasMoreQuestions(hasMore);
      setQuestionDebug({ page: safePage, totalPages: totalPages || 1, count: loadedQuestions.length, hasMore });
      setActiveQuestionIndex(Math.min(targetIndex, loadedQuestions.length - 1));
      if (loadedQuestions.length > 0) { setIsSessionActive(true); }

      hasAutoSubmittedRef.current = false;
      hasTimerStartedRef.current = false;

      try {
        const params = new URLSearchParams();
        if (mode === "exam") {
          params.set("mode", "exam");
          params.set("duration_minutes", String(120));
          params.set("subjects", examSubjects.join(","));
          params.set("subject_slug", "exam-multi");
        } else {
          params.set("subject_slug", selectedSubject);
        }
        params.set("exam_year", selectedYear);

        const sessionResponse = await fetch(`/api/student/jamb/session/start?${params.toString()}`, { method: "GET" });

        if (!sessionResponse.ok) {
          const errorData = await sessionResponse.json();
          throw new Error(errorData.error || "Failed to start exam session");
        }

        const sessionData = await sessionResponse.json();
        const { data } = sessionData;

        setSessionToken(data.sessionToken);
        setSessionId(data.sessionId);
        setServerStartTime(new Date(data.startedAt));
        setMaxDurationSeconds(data.durationSeconds);
        setTimerInitialSeconds(data.remainingSeconds);

        if (data.isExpired) {
          toast.error("Exam time has expired");
          void submitAttempt();
        } else if (data.isResume) {
          toast.info(`Resuming session (${data.remainingSeconds} seconds remaining)`);
        }
      } catch (e: any) {
        console.error("Session initialization error:", e);
        toast.error(e.message || "Failed to initialize exam session");
      }

      requestAnimationFrame(() => scrollToQuestionCard());
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
    (async () => {
      if (type === "year" && (selectedSubject || mode === "exam")) {
        setSelectedYear(value);
        try {
          if (mode === "exam") {
            const englishSlug = "english-language";
            const otherSlugs = Array.from(new Set([englishSlug, ...examSubjects]));
            let englishCount = 0;
            let othersCount = 0;
            try {
              const { count: engCount, error: engErr } = await supabase
                .from("jamb_questions").select("id", { count: "exact", head: true })
                .eq("subject_slug", englishSlug).eq("exam_year", Number(value));
              if (engErr) throw engErr;
              englishCount = engCount || 0;
            } catch (e) { englishCount = 0; }

            for (const slug of otherSlugs.filter(s => s !== englishSlug)) {
              try {
                const { count: c, error: err } = await supabase
                  .from("jamb_questions").select("id", { count: "exact", head: true })
                  .eq("subject_slug", slug).eq("exam_year", Number(value));
                if (err) throw err;
                othersCount += c || 0;
              } catch (e) { }
            }

            const totalAvailable = Math.min(englishCount, 60) + Math.min(othersCount, 40);
            setPreviewData({
              totalQuestions: totalAvailable,
              previousAttempt: null,
              durationSeconds: 120 * 60,
            });
            setShowStartModal(true);
          } else {
            const examConfig = getJambExamConfig(selectedSubject);
            const { count: totalCount, error: countError } = await supabase
              .from("jamb_questions").select("id", { count: "exact", head: true })
              .eq("subject_slug", selectedSubject).eq("exam_year", Number(value));
            if (countError) throw countError;

            let prev: any = null;
            try {
              const prevResponse = await fetch(`/api/student/jamb/previous-attempt?subject=${encodeURIComponent(selectedSubject)}&year=${value}`, { cache: "no-store" });
              if (prevResponse.ok) prev = await prevResponse.json();
            } catch (e) { }

            setPreviewData({
              totalQuestions: Math.min(totalCount || 0, examConfig.questionCount),
              previousAttempt: prev?.data || null,
              durationSeconds: examConfig.durationMinutes * 60,
            });
            setShowStartModal(true);
          }
        } catch (err: any) {
          toast.error(err.message || "Failed to load preview");
          applyFilterChange(type, value);
        }
      } else {
        applyFilterChange(type, value);
      }
    })();
  }

  function handleConfirmTermination() {
    if (pendingFilterChange) {
      setAnswers({});
      setQuestions([]);
      setAllQuestionIds([]);
      setAttemptResult(null);
      setTotalQuestionCount(0);
      setPageCompletion({});
      setIsSessionActive(false);
      setSessionToken(null);
      setSessionId(null);
      setServerStartTime(null);
      setMaxDurationSeconds(null);
      hasAutoSubmittedRef.current = false;
      hasTimerStartedRef.current = false;
      clearExamPool();
      applyFilterChange(pendingFilterChange.type, pendingFilterChange.value);
      setPendingFilterChange(null);
      setShowTerminationDialog(false);
      toast.success("Session terminated. Starting fresh.");
    }
  }

  function handleSaveAndExit() {
    toast.success("Progress saved.");
    window.location.href = "/student";
  }

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

  async function submitAttempt() {
    if (!allQuestionIds.length && !questions.length) return;
    if (!sessionToken || !serverStartTime || !maxDurationSeconds) {
      toast.error("Session not initialized. Please reload the page.");
      return;
    }

    try {
      setSubmitting(true);
      setShowPreSubmitReview(false);

      const now = new Date();
      const elapsedSeconds = Math.floor(
        (now.getTime() - serverStartTime.getTime()) / 1000
      );

      const validationResponse = await fetch("/api/student/jamb/session/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          elapsedSeconds,
        }),
      });

      if (!validationResponse.ok) {
        const validationError = await validationResponse.json();
        throw new Error(
          validationError.error || "Session validation failed"
        );
      }

      const validationData = await validationResponse.json();
      const { data: sessionValidation } = validationData;

      const questionIdsToSubmit = allQuestionIds.length > 0
        ? allQuestionIds.map((q) => q.id)
        : questions.map((q) => q.id);
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
          mode,
          subjects: mode === "exam" ? ["english-language", ...examSubjects] : [selectedSubject],
          answers: answersPayload,
          totalQuestions,
          totalPages: questionTotalPages,
          questionsPerPage: QUESTIONS_PER_PAGE,
          sessionId,
          sessionToken,
          serverElapsedSeconds: sessionValidation.serverElapsedSeconds,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to submit attempt");

      const prevResponse = await fetch(
        `/api/student/jamb/previous-attempt?subject=${encodeURIComponent(
          selectedSubject
        )}&year=${selectedYear}`,
        { cache: "no-store" }
      );
      const prevResult = prevResponse.ok ? await prevResponse.json() : null;

      setAttemptResult({ ...result.data, previousAttempt: prevResult?.data });
      setShowResultWizard(true);
      setIsSessionActive(false);

      setSessionToken(null);
      setSessionId(null);
      setServerStartTime(null);
      setMaxDurationSeconds(null);
      hasTimerStartedRef.current = false;
      clearExamPool();

      toast.success("Attempt submitted successfully");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Unable to save attempt");
    } finally {
      setSubmitting(false);
    }
  }

  const onExpire = useCallback(() => {
    toast.info("Time's up — submitting your attempt...");
  }, []);

  const { timeRemaining, formatted, isRunning, isWarning, isCritical, start, stop } = useExamTimer(timerInitialSeconds, onExpire as any);

  useEffect(() => {
    if (!isSessionActive) return;
    if (typeof timerInitialSeconds !== "number" || timerInitialSeconds <= 0) return;
    if (isRunning || timeRemaining > 0) {
      hasTimerStartedRef.current = true;
    }
  }, [isSessionActive, timerInitialSeconds, isRunning, timeRemaining]);

  useEffect(() => {
    if (timerInitialSeconds == null || timerInitialSeconds <= 0) return;
    if (hasAutoSubmittedRef.current) return;
    if (!hasTimerStartedRef.current) return;

    if (timeRemaining === 0 && isRunning === false && isSessionActive && sessionToken && timerInitialSeconds > 0) {
      hasAutoSubmittedRef.current = true;
      void submitAttempt();
    }
  }, [timeRemaining, isRunning, isSessionActive, sessionToken, timerInitialSeconds]);

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

  const hasQuestions = questions.length > 0;

  return (
    <DashboardLayout role="student">

      {/* ── Mobile Sticky Top Bar (Only visible during active session) ── */}
      {isSessionActive && (
        <div className="lg:hidden sticky top-0 z-40 -mx-4 mb-6 bg-white border-b border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExamTimerWidget time={formatted} isWarning={isWarning} isCritical={isCritical} subject={filteredSubjectLabel} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowQuestionGrid(true)} className="h-9 w-9 p-0">
              <LayoutGrid className="h-4 w-4 text-slate-600" />
            </Button>
            <Button size="sm" onClick={() => setShowPreSubmitReview(true)} className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3">
              Submit
            </Button>
          </div>
        </div>
      )}

      {/* ── Dialogs ── */}
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
              <Badge variant="success" className="gap-1.5 text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                Access enabled
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">JAMB CBT Practice</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome back, {studentName}. Choose your preferred mode to begin.</p>
          </div>
        </div>

        {/* ── Filter / Setup Card ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          {/* Mode Selector - Redesigned */}
          <div className="mb-6">
            <label className="text-sm font-bold text-slate-800 mb-3 block">1. Select Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: "study", icon: BrainCircuit, title: "Study", desc: "No timer, learn at your pace" },
                { id: "practice", icon: Timer, title: "Practice", desc: "Timed subset of questions" },
                { id: "exam", icon: GraduationCap, title: "Exam", desc: "Full 120-min simulation" }
              ].map((m) => {
                const Icon = m.icon;
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMode(m.id as any); setExamSubjects([]); setSelectedSubject(""); setSelectedYear(""); }}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-all text-left ${isActive
                        ? "border-blue-600 bg-blue-50/50 shadow-sm"
                        : "border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-blue-50/30"
                      }`}
                  >
                    <div className={`p-2 rounded-lg ${isActive ? "bg-blue-600 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={`font-bold ${isActive ? "text-blue-900" : "text-slate-700"}`}>{m.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Subject Dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">
                2. {mode === "exam" ? "Primary Subject" : "Select Subject"}
              </label>
              <Select value={selectedSubject} onValueChange={(v) => handleFilterChange("subject", v)} disabled={mode === "exam"}>
                <SelectTrigger className="h-12 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Year Dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">
                3. Exam Year
              </label>
              <Select value={selectedYear} onValueChange={(v) => handleFilterChange("year", v)} disabled={mode === "exam" ? (examSubjects.length === 0) : !selectedSubject}>
                <SelectTrigger className={`h-12 bg-slate-50 border-slate-200 ${mode === "exam" ? (examSubjects.length === 0 ? "opacity-50" : "") : (!selectedSubject ? "opacity-50" : "")}`}>
                  <SelectValue placeholder={mode === "exam" ? (examSubjects.length === 0 ? "Select exam subjects first" : "Choose a year") : (selectedSubject ? "Choose a year" : "Select subject first")} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Exam Mode Subject Picker - Redesigned */}
          {mode === "exam" && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Select Exam Subjects</p>
                <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                  {examSubjects.length}/3 selected
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mb-4">English is automatically included. Select up to 3 additional subjects to complete your exam combination.</p>

              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                {subjects.filter(s => s.slug !== "english-language").map((s) => {
                  const isChecked = examSubjects.includes(s.slug);
                  const isDisabled = !isChecked && examSubjects.length >= 3;

                  return (
                    <button
                      key={s.slug}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        setExamSubjects((prev) => {
                          if (prev.includes(s.slug)) return prev.filter((p) => p !== s.slug);
                          if (prev.length >= 3) return prev;
                          return [...prev, s.slug];
                        });
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${isChecked
                          ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                          : isDisabled
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                        }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSubject && selectedYear && (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4 text-blue-900">
              <div className="p-2 bg-blue-100 rounded-full shrink-0">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold">{filteredSubjectLabel} <span className="mx-1 text-blue-300">•</span> {selectedYear}</p>
                <p className="text-xs text-blue-700 mt-0.5">Session configured for {totalQuestions} questions.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {loadingQuestions && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 animate-pulse">Preparing your session…</p>
            </div>
          </div>
        )}

        {/* ── Question View ── */}
        {!loadingQuestions && hasQuestions && activeQuestion && (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">

            {/* Left: question card */}
            <div className="space-y-4">

              {/* Progress bar */}
              <div className="hidden lg:block rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-700">
                    Question <span className="text-blue-600 text-lg mx-1">{activeGlobalNumber}</span> of {totalQuestions}
                  </span>
                  <span className="text-sm font-medium text-slate-500">{progressPercent}% Completed</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Question card */}
              <div id={QUESTION_CARD_ID} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {activeQuestion.subject_name} <span className="mx-1">•</span> {activeQuestion.exam_year}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {answers[activeQuestion.id] ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Answered
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                        <HelpCircle className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-8 p-6 sm:p-8">
                  {/* Image */}
                  {activeQuestion.image_url && (
                    <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                      <img
                        src={activeQuestion.image_url}
                        alt={`Question ${activeGlobalNumber}`}
                        className="max-h-72 max-w-full object-contain rounded-lg"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}

                  {/* Question text */}
                  <div className="text-lg font-medium leading-relaxed text-slate-900">
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
                          className={`group w-full flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all duration-200 ${selected
                              ? "border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600/20"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
                            }`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${selected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-slate-50 text-slate-500 group-hover:border-blue-400 group-hover:text-blue-600 group-hover:bg-blue-100"
                            }`}>
                            {OPTION_LABELS[idx]}
                          </div>
                          <span className={`flex-1 text-base ${selected ? "text-blue-950 font-medium" : "text-slate-700"}`}>
                            <MathText content={displayText} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Question navigation */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handlePrevQuestion}
                  disabled={isFirstQuestion || loadingQuestions}
                  className="gap-2 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200"
                >
                  <ChevronLeft className="h-5 w-5" /> Prev
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
                    size="lg"
                    onClick={() => setShowPreSubmitReview(true)}
                    disabled={submitting}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-bold px-8"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    Finish Test
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleNextQuestion}
                    disabled={loadingQuestions}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm px-8"
                  >
                    Next <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Right: sticky sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-6 space-y-5">
                <ExamTimerWidget time={formatted} isWarning={isWarning} isCritical={isCritical} subject={filteredSubjectLabel} />

                {/* Summary card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Session Status</p>
                    <button
                      onClick={() => setShowQuestionGrid(true)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md"
                    >
                      <LayoutGrid className="h-3 w-3" /> View Grid
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col items-center justify-center">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Answered</p>
                      <p className="text-2xl font-black text-slate-800 mt-1">{totalAnsweredCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col items-center justify-center">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Pending</p>
                      <p className="text-2xl font-black text-slate-800 mt-1">{Math.max(totalQuestions - totalAnsweredCount, 0)}</p>
                    </div>
                  </div>

                  {/* Question dots for current page */}
                  <div>
                    <p className="mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 pt-4">
                      Current Page ({questionPage}/{questionTotalPages})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {questions.map((q, idx) => {
                        const answered = !!answers[q.id];
                        const active = idx === activeQuestionIndex;
                        const gNum = globalQuestionNumber(questionPage, idx);
                        return (
                          <button
                            key={q.id}
                            onClick={() => setActiveQuestionIndex(idx)}
                            title={`Q${gNum}${answered ? " (answered)" : ""}`}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold border-2 transition-all shadow-sm ${active
                                ? "border-blue-600 bg-blue-600 text-white scale-110"
                                : answered
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
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
                <div className="space-y-3">
                  <Button
                    type="button"
                    onClick={() => setShowPreSubmitReview(true)}
                    disabled={submitting}
                    className="w-full h-12 gap-2 bg-slate-900 hover:bg-slate-800 text-white text-base font-bold shadow-md"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5 text-yellow-400" />}
                    Submit Attempt
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSaveAndExit} className="w-full h-12 font-bold text-slate-600 border-slate-200 hover:bg-slate-50">
                    Save & Exit
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        )}

      </div>

      {/* ── Start Modal ── */}
      <Dialog open={showStartModal} onOpenChange={setShowStartModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
          <div className="bg-blue-600 p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BrainCircuit className="w-32 h-32" />
            </div>
            <DialogTitle className="text-2xl font-bold relative z-10">Ready to Start?</DialogTitle>
            <DialogDescription className="text-blue-100 mt-2 relative z-10 text-base">
              Your session environment is prepared.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-6 bg-white">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-medium text-sm">Target Subject</span>
                <span className="font-bold text-slate-800">{filteredSubjectLabel}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-medium text-sm">Exam Year</span>
                <span className="font-bold text-slate-800">{selectedYear}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase">Questions</p>
                  <p className="text-xl font-black text-slate-800 mt-0.5">{previewData.totalQuestions ?? "—"}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase">Time Limit</p>
                  <p className="text-xl font-black text-slate-800 mt-0.5">{previewData.durationSeconds ? `${Math.ceil(previewData.durationSeconds / 60)}m` : "—"}</p>
                </div>
              </div>
            </div>

            {/* Ready status */}
            <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
              <Timer className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900 font-medium leading-relaxed">
                Once initiated, the timer cannot be paused. Ensure you have a stable connection.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => { setShowStartModal(false); setSelectedYear(""); }}
                className="flex-1 h-12 font-bold border-slate-200 text-slate-600"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowStartModal(false);
                  void loadQuestions(1, 0);
                }}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md"
              >
                Begin Test
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Question grid modal ── */}
      <Dialog open={showQuestionGrid} onOpenChange={setShowQuestionGrid}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-slate-100">
            <DialogTitle className="text-xl">Question Navigator</DialogTitle>
            <DialogDescription>Jump directly to any question in the set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {Array.from({ length: questionTotalPages }, (_, pi) => pi + 1).map((pn) => (
              <div key={pn} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Page {pn}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {Array.from({ length: pn < questionTotalPages ? QUESTIONS_PER_PAGE : (totalQuestions - (questionTotalPages - 1) * QUESTIONS_PER_PAGE) }, (_, qi) => qi).map((qi) => {
                    const gNum = (pn - 1) * QUESTIONS_PER_PAGE + qi + 1;
                    const qId = pn === questionPage ? questions[qi]?.id : null;
                    const answered = qId ? !!answers[qId] : false;
                    const isActive = pn === questionPage && qi === activeQuestionIndex;
                    return (
                      <button
                        key={gNum}
                        onClick={() => { goToQuestion(pn, qi); setShowQuestionGrid(false); }}
                        className={`flex h-11 w-11 items-center justify-center rounded-lg text-sm font-bold border-2 transition-all ${isActive
                          ? "border-blue-600 bg-blue-100 text-blue-700 ring-2 ring-blue-600/20"
                          : answered
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
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
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs font-medium text-slate-500 bg-white sticky bottom-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border-2 border-blue-600 bg-blue-100 inline-block" /> Current</span>
              <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border-2 border-emerald-500 bg-emerald-50 inline-block" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded border-2 border-slate-200 bg-white inline-block" /> Pending</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowQuestionGrid(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Pre-submit review ── */}
      <Dialog open={showPreSubmitReview} onOpenChange={setShowPreSubmitReview}>
        <DialogContent className="max-w-lg p-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="h-8 w-8 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl font-bold">Review Submission</DialogTitle>
            <DialogDescription className="mt-2 text-base">
              You are about to complete this session. Unanswered questions will receive 0 points.
            </DialogDescription>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                <p className="text-xs text-emerald-700 font-bold uppercase tracking-wide">Answered</p>
                <p className="mt-1 text-4xl font-black text-emerald-800">{totalAnsweredCount}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-center">
                <p className="text-xs text-amber-700 font-bold uppercase tracking-wide">Pending</p>
                <p className="mt-1 text-4xl font-black text-amber-800">{Math.max(totalQuestions - totalAnsweredCount, 0)}</p>
              </div>
            </div>

            {totalAnsweredCount < totalQuestions ? (
              <div className="rounded-xl border border-amber-200 bg-white p-4 flex gap-3 items-start shadow-sm">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-slate-700 leading-relaxed">
                  You have <strong className="text-amber-600">{Math.max(totalQuestions - totalAnsweredCount, 0)} unanswered</strong> questions. Are you sure you want to submit now?
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-white p-4 flex gap-3 items-start shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-slate-700 leading-relaxed">
                  Excellent! You've answered all questions. You're ready to submit.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-6 mt-4 border-t border-slate-100">
            <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setShowPreSubmitReview(false)}>Return to Test</Button>
            <Button onClick={submitAttempt} disabled={submitting} className="flex-1 h-12 gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Submission"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Results wizard ── */}
      <Dialog open={showResultWizard} onOpenChange={setShowResultWizard}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl">
          <div className="bg-slate-900 p-8 text-center relative shrink-0">
            <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-4 opacity-90" />
            <DialogTitle className="text-3xl font-bold text-white mb-2">Session Complete</DialogTitle>
            <DialogDescription className="text-slate-300 text-base">Here is a breakdown of your performance.</DialogDescription>
          </div>

          {attemptResult && (
            <div className="overflow-y-auto p-6 space-y-8 bg-slate-50 flex-1">

              {/* Score Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="text-center md:text-left z-10">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Final Score</p>
                  <div className="flex items-baseline justify-center md:justify-start gap-2 mt-1">
                    <h2 className="text-6xl font-black text-slate-900">{attemptResult.score}<span className="text-3xl text-slate-400">%</span></h2>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1 rounded-full inline-block">
                    {attemptResult.correctCount} / {attemptResult.totalQuestions} Correct
                  </p>
                </div>

                {attemptResult.previousAttempt && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 min-w-[200px] z-10">
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">Vs Previous Attempt</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-black text-blue-900">{attemptResult.previousAttempt.score}%</p>
                      </div>
                      <div className={`px-2 py-1 rounded font-bold text-sm ${attemptResult.score >= attemptResult.previousAttempt.score ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {attemptResult.score > attemptResult.previousAttempt.score ? "+" : ""}{(attemptResult.score - attemptResult.previousAttempt.score).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Review Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2">Detailed Review</h3>

                {(attemptResult.unansweredCount ?? 0) > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="font-bold text-amber-900 flex items-center gap-2 mb-2">
                      <HelpCircle className="h-5 w-5 text-amber-600" />
                      Unanswered Questions ({attemptResult.unansweredCount})
                    </p>
                    <p className="text-sm text-amber-800">
                      Questions skipped: {attemptResult.unansweredQuestions?.join(", ")}
                    </p>
                  </div>
                )}

                {(attemptResult.missedCount ?? 0) > 0 && (
                  <div className="space-y-4">
                    <p className="font-bold text-slate-800 flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-500" />
                      Corrections ({attemptResult.missedCount})
                    </p>
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                      {attemptResult.missedQuestions?.map((item: any, idx: number) => (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                          <p className="text-sm font-bold text-slate-500 uppercase">Question {item.questionNumber || idx + 1}</p>
                          {item.questionText && <div className="text-base font-medium text-slate-900"><MathText content={item.questionText} /></div>}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                              <p className="text-red-700 font-bold text-xs uppercase mb-1">Your Answer</p>
                              <p className="text-red-900 text-sm font-medium"><MathText content={item.userAnswer || "None"} /></p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                              <p className="text-emerald-700 font-bold text-xs uppercase mb-1">Correct Answer</p>
                              <p className="text-emerald-900 text-sm font-medium"><MathText content={item.correctOption} /></p>
                            </div>
                          </div>

                          {item.explanation && (
                            <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-4">
                              <p className="text-blue-800 font-bold text-xs uppercase mb-1">Explanation</p>
                              <div className="text-blue-900 text-sm"><MathText content={item.explanation} /></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 flex gap-3 justify-end">
            <Button variant="outline" className="font-bold h-11" onClick={() => setShowResultWizard(false)}>Close Review</Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-6">
              <Link href="/student">Return to Dashboard</Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}