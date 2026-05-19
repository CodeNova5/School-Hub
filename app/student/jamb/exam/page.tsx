"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { getJambExamConfig, shuffleArray } from "@/lib/jamb-exam-config";
import useExamTimer from "@/hooks/use-exam-timer";
import ExamTimerWidget from "@/components/jamb/exam-timer-widget";
import {
  clearJambExamSetup,
  loadJambExamSetup,
  saveJambExamResult,
  type JambAttemptResult,
  type JambExamSetup,
} from "@/lib/jamb-session-storage";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  LayoutGrid,
  Loader2,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const QUESTIONS_PER_PAGE = 5;
const QUESTION_CARD_ID = "jamb-question-card";
const OPTION_LABELS = ["A", "B", "C", "D", "E"];

const EXAM_SETUP_FALLBACK = "jamb_exam_setup_v1";

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
    .replace(/\\\[(.+?)\\\]/gs, (_match, expr: string) => `$$${expr}$$`)
    .replace(/\\\((.+?)\\\)/g, (_match, expr: string) => `$${expr}$`)
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

type SubjectQuestionRow = {
  id: string;
  question_text: string;
  options: string[];
  subject_slug: string;
  subject_name: string;
  exam_year: number;
  image_url?: string | null;
  correct_option?: string | null;
  explanation?: string | null;
};

type ExamSetupState = JambExamSetup;

export default function StudentJambExamPage() {
  const router = useRouter();
  const [setup, setSetup] = useState<ExamSetupState | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questions, setQuestions] = useState<SubjectQuestionRow[]>([]);
  const [questionPage, setQuestionPage] = useState(1);
  const [questionTotalPages, setQuestionTotalPages] = useState(1);
  const [totalQuestionCount, setTotalQuestionCount] = useState(0);
  const [allQuestionIds, setAllQuestionIds] = useState<{ id: string; pageNum: number }[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [showQuestionGrid, setShowQuestionGrid] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverStartTime, setServerStartTime] = useState<Date | null>(null);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState<number | null>(null);
  const [timerInitialSeconds, setTimerInitialSeconds] = useState<number | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const hasAutoSubmittedRef = useRef(false);
  const hasTimerStartedRef = useRef(false);
  const questionCardRef = useRef<HTMLDivElement | null>(null);
  const setupLabel = setup?.subjectName || "JAMB CBT";
  const setupYear = setup?.examYear || "";
  const setupMode = setup?.mode || "practice";

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

  const answeredOnPage = useMemo(
    () => questions.reduce((count, question) => (answers[question.id] ? count + 1 : count), 0),
    [answers, questions]
  );
  const totalAnsweredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const progressPercent = useMemo(
    () => (totalQuestionCount ? Math.round((totalAnsweredCount / totalQuestionCount) * 100) : 0),
    [totalAnsweredCount, totalQuestionCount]
  );

  const activeQuestion = questions[activeQuestionIndex] ?? null;
  const activeGlobalNumber = (questionPage - 1) * QUESTIONS_PER_PAGE + activeQuestionIndex + 1;
  const isFirstQuestion = questionPage === 1 && activeQuestionIndex === 0;
  const isLastQuestion = questionPage === questionTotalPages && activeQuestionIndex === questions.length - 1;

  const scrollToQuestionCard = useCallback(() => {
    if (typeof window === "undefined") return;
    const card = questionCardRef.current || document.getElementById(QUESTION_CARD_ID);
    if (card) {
      const topOffset = 80;
      const elementPosition = card.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const clearAndExit = useCallback(() => {
    clearJambExamSetup();
    router.push("/student/jamb");
  }, [router]);

  async function startSession(currentSetup: ExamSetupState) {
    const params = new URLSearchParams();
    if (currentSetup.mode === "exam") {
      params.set("mode", "exam");
      params.set("duration_minutes", String(120));
      params.set("subjects", currentSetup.examSubjects.join(","));
      params.set("subject_slug", "exam-multi");
    } else {
      params.set("subject_slug", currentSetup.subjectSlug);
    }
    params.set("exam_year", currentSetup.examYear);

    const sessionResponse = await fetch(`/api/student/jamb/session/start?${params.toString()}`, {
      method: "GET",
    });

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
      throw new Error("Exam time has expired. Please restart the session.");
    }
  }

  async function loadQuestions(page = 1, targetIndex = 0, currentSetup = setup) {
    if (!currentSetup) return;

    try {
      setLoadingQuestions(true);
      const examConfig =
        currentSetup.mode === "exam"
          ? { questionCount: 0, durationMinutes: 120, isEnglish: false }
          : getJambExamConfig(currentSetup.subjectSlug || "english-language");

      let selectedIds: string[] = [];

      if (currentSetup.mode === "study") {
        const { data: idRows, error: idError } = await supabase
          .from("jamb_questions")
          .select("id")
          .eq("subject_slug", currentSetup.subjectSlug)
          .eq("exam_year", Number(currentSetup.examYear))
          .order("id", { ascending: true });
        if (idError) throw idError;
        selectedIds = shuffleArray((idRows || []).map((row: any) => row.id));
      } else if (currentSetup.mode === "practice") {
        const { data: idRows, error: idError } = await supabase
          .from("jamb_questions")
          .select("id")
          .eq("subject_slug", currentSetup.subjectSlug)
          .eq("exam_year", Number(currentSetup.examYear))
          .order("id", { ascending: true });
        if (idError) throw idError;
        const questionIdRows = (idRows || []) as Array<{ id: string }>;
        const shuffledIds = shuffleArray(questionIdRows.map((row) => row.id));
        selectedIds = shuffledIds.slice(0, Math.min(shuffledIds.length, examConfig.questionCount));
      } else {
        const englishSlug = "english-language";
        const otherSlugs = Array.from(new Set([englishSlug, ...currentSetup.examSubjects]));
        if (!otherSlugs.includes(englishSlug)) otherSlugs.unshift(englishSlug);

        const perSubjectIds: Record<string, string[]> = {};
        for (const slug of otherSlugs) {
          const { data: idRows, error: idError } = await supabase
            .from("jamb_questions")
            .select("id")
            .eq("subject_slug", slug)
            .eq("exam_year", Number(currentSetup.examYear))
            .order("id", { ascending: true });
          if (idError) throw idError;
          perSubjectIds[slug] = shuffleArray((idRows || []).map((row: any) => row.id));
        }

        const englishIds = perSubjectIds[englishSlug] || [];
        const pickEnglish = englishIds.slice(0, Math.min(englishIds.length, 60));
        const others = otherSlugs
          .filter((subjectSlug) => subjectSlug !== englishSlug)
          .flatMap((subjectSlug) => perSubjectIds[subjectSlug] || []);
        const pickOthers = shuffleArray(others).slice(0, Math.min(others.length, 40));

        selectedIds = shuffleArray([...pickEnglish, ...pickOthers]);
      }

      const totalCount = selectedIds.length;
      const totalPages = Math.max(1, Math.ceil(totalCount / QUESTIONS_PER_PAGE));
      const safePage = Math.min(Math.max(page, 1), totalPages);
      const offset = (safePage - 1) * QUESTIONS_PER_PAGE;
      const pageQuestionIds = selectedIds.slice(offset, offset + QUESTIONS_PER_PAGE);

      const { data, error } = await supabase
        .from("jamb_questions")
        .select(
          "id, question_text, options, subject_slug, subject_name, exam_year, image_url, correct_option, explanation"
        )
        .in("id", pageQuestionIds);
      if (error) throw error;

      const orderedRows = (data || []).sort(
        (left: any, right: any) => pageQuestionIds.indexOf(left.id) - pageQuestionIds.indexOf(right.id)
      );

      const loadedQuestions: SubjectQuestionRow[] = orderedRows.map((row: any) => ({
        id: row.id,
        question_text: row.question_text,
        options: Array.isArray(row.options) ? row.options : [],
        subject_slug: row.subject_slug,
        subject_name: row.subject_name,
        exam_year: row.exam_year,
        image_url: row.image_url || null,
        correct_option: row.correct_option || null,
        explanation: row.explanation || null,
      }));

      setQuestions(loadedQuestions);
      setTotalQuestionCount(totalCount);
      setAllQuestionIds(selectedIds.map((id, index) => ({ id, pageNum: Math.floor(index / QUESTIONS_PER_PAGE) + 1 })));
      setQuestionPage(safePage);
      setQuestionTotalPages(totalPages);
      setActiveQuestionIndex(Math.min(targetIndex, Math.max(loadedQuestions.length - 1, 0)));
      setIsSessionActive(true);

      if (loadedQuestions.length > 0) {
        requestAnimationFrame(() => scrollToQuestionCard());
      }
    } finally {
      setLoadingQuestions(false);
    }
  }

  useEffect(() => {
    const savedSetup = loadJambExamSetup();
    if (!savedSetup) {
      setSetup(null);
      setBootstrapping(false);
      setStartError("No exam setup was found for this session.");
      return;
    }

    setSetup(savedSetup);
    setBootstrapping(true);

    (async () => {
      try {
        // For study mode we don't start a timed session or set a question limit.
        if (savedSetup.mode === "study") {
          await loadQuestions(1, 0, savedSetup);
        } else {
          await startSession(savedSetup);
          await loadQuestions(1, 0, savedSetup);
        }
      } catch (error: any) {
        console.error("[student/jamb/exam] bootstrap error", error);
        setStartError(error?.message || "Unable to start exam session");
        toast.error(error?.message || "Unable to start exam session");
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isSessionActive) return;
    if (typeof timerInitialSeconds !== "number" || timerInitialSeconds <= 0) return;
    if (timerInitialSeconds > 0) {
      hasTimerStartedRef.current = true;
    }
  }, [isSessionActive, timerInitialSeconds]);

  const onExpire = useCallback(() => {
    toast.info("Time's up - submitting your attempt...");
  }, []);

  const { timeRemaining, formatted, isRunning, isWarning, isCritical, stop } = useExamTimer(
    timerInitialSeconds,
    onExpire as any
  );

  useEffect(() => {
    if (timerInitialSeconds == null || timerInitialSeconds <= 0) return;
    if (hasAutoSubmittedRef.current) return;
    if (!hasTimerStartedRef.current) return;

    if (timeRemaining === 0 && isRunning === false && isSessionActive && sessionToken && timerInitialSeconds > 0) {
      hasAutoSubmittedRef.current = true;
      void submitAttempt();
    }
  }, [timeRemaining, isRunning, isSessionActive, sessionToken, timerInitialSeconds]);

  function recordAnswer(questionId: string, option: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: option }));
  }

  function goToQuestion(pageNum: number, indexOnPage: number) {
    if (pageNum === questionPage) {
      setActiveQuestionIndex(indexOnPage);
      requestAnimationFrame(() => scrollToQuestionCard());
      return;
    }
    void loadQuestions(pageNum, indexOnPage, setup || undefined);
  }

  function handlePrevQuestion() {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex(activeQuestionIndex - 1);
      requestAnimationFrame(() => scrollToQuestionCard());
      return;
    }

    if (questionPage > 1) {
      void loadQuestions(questionPage - 1, QUESTIONS_PER_PAGE - 1, setup || undefined);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToQuestionCard()));
    }
  }

  function handleNextQuestion() {
    if (activeQuestionIndex < questions.length - 1) {
      setActiveQuestionIndex(activeQuestionIndex + 1);
      requestAnimationFrame(() => scrollToQuestionCard());
      return;
    }

    if (questionPage < questionTotalPages) {
      void loadQuestions(questionPage + 1, 0, setup || undefined);
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToQuestionCard()));
    }
  }

  async function submitAttempt() {
    if (!questions.length && !allQuestionIds.length) return;
    if (!sessionToken || !serverStartTime || !maxDurationSeconds) {
      toast.error("Session not initialized. Please reload the page.");
      return;
    }

    try {
      setSubmitting(true);
      stop();

      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - serverStartTime.getTime()) / 1000);

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
        throw new Error(validationError.error || "Session validation failed");
      }

      const validationData = await validationResponse.json();
      const { data: sessionValidation } = validationData;
      const questionIdsToSubmit = allQuestionIds.length > 0 ? allQuestionIds.map((question) => question.id) : questions.map((question) => question.id);
      const answersPayload = questionIdsToSubmit.map((questionId) => ({
        questionId,
        selectedOption: answers[questionId] || null,
      }));

      const submissionResponse = await fetch("/api/student/jamb/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectSlug: setup?.mode === "exam" ? "exam-multi" : setup?.subjectSlug,
          subjectName: setup?.subjectName || "JAMB CBT",
          examYear: Number(setup?.examYear),
          mode: setup?.mode,
          subjects: setup?.mode === "exam" ? ["english-language", ...(setup?.examSubjects || [])] : [setup?.subjectSlug],
          answers: answersPayload,
          totalQuestions: totalQuestionCount,
          totalPages: questionTotalPages,
          questionsPerPage: QUESTIONS_PER_PAGE,
          sessionId,
          sessionToken,
          serverElapsedSeconds: sessionValidation.serverElapsedSeconds,
        }),
      });

      const result = await submissionResponse.json();
      if (!submissionResponse.ok) throw new Error(result.error || "Failed to submit attempt");

      const prevResponse = await fetch(
        `/api/student/jamb/previous-attempt?subject=${encodeURIComponent(setup?.subjectSlug || "")}&year=${setup?.examYear || ""}`,
        { cache: "no-store" }
      );
      const previousAttempt = prevResponse.ok ? await prevResponse.json() : null;

      const cachedResult: JambAttemptResult & { attemptId?: string; subjectSlug?: string; subjectName?: string; examYear?: number; mode?: string } = {
        ...result.data,
        previousAttempt: previousAttempt?.data || result.data.previousAttempt || null,
        attemptId: result.data?.attempt?.id,
        subjectSlug: setup?.subjectSlug,
        subjectName: setup?.subjectName,
        examYear: Number(setup?.examYear),
        mode: setup?.mode,
      };
      // mode may be a string here; cast to satisfy CachedJambResult type
      saveJambExamResult(cachedResult as any);
      clearJambExamSetup();
      router.replace(`/student/jamb/results?attemptId=${encodeURIComponent(String(cachedResult.attemptId || ""))}`);
      toast.success("Attempt submitted successfully");
    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Unable to save attempt");
    } finally {
      setSubmitting(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-full border border-white/10 bg-white/5 p-4 shadow-2xl shadow-slate-950/40">
            <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
          </div>
          <div>
            <p className="text-lg font-semibold">Preparing your exam</p>
            <p className="text-sm text-slate-300">Loading the session, timer, and question pool.</p>
          </div>
        </div>
      </div>
    );
  }

  if (startError || !setup) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Exam setup unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {startError || "Open the JAMB launcher page first so the subject, year, and mode can be prepared."}
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
              <Link href="/student/jamb">Back to JAMB setup</Link>
            </Button>
            <Button variant="outline" onClick={clearAndExit} className="border-white/15 bg-transparent text-white hover:bg-white/10">
              Exit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentLabel = setup.mode === "exam" ? "Exam focus mode" : setup.mode === "study" ? "Study mode" : "Practice mode";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_46%,_#f8fafc_46%,_#f8fafc_100%)] text-slate-900">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-inset ring-blue-400/20">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{setupLabel}</p>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span>{setupYear}</span>
                <span className="text-slate-500">•</span>
                <span>{currentLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {setupMode !== "study" ? (
              <ExamTimerWidget time={formatted} isWarning={isWarning} isCritical={isCritical} subject={setupLabel} />
            ) : null}
            <Button variant="outline" onClick={clearAndExit} className="hidden border-white/15 bg-transparent text-white hover:bg-white/10 sm:inline-flex">
              Exit
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        {loadingQuestions ? (
          <div className="flex min-h-[65vh] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">Preparing your question set…</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Progress</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      Question <span className="mx-1 text-blue-600">{activeGlobalNumber}</span> of {totalQuestionCount}
                    </p>
                  </div>
                  <Badge className="border-blue-100 bg-blue-50 text-blue-700">{progressPercent}% completed</Badge>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div id={QUESTION_CARD_ID} ref={questionCardRef} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      {activeQuestion?.subject_name || setupLabel} <span className="mx-1">•</span> {activeQuestion?.exam_year || setupYear}
                    </p>
                  </div>
                  <div>
                    {answers[activeQuestion?.id || ""] ? (
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

                <div className="space-y-7 p-5 sm:p-8">
                  {activeQuestion?.image_url ? (
                    <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                      <img
                        src={activeQuestion.image_url}
                        alt={`Question ${activeGlobalNumber}`}
                        className="max-h-72 max-w-full rounded-xl object-contain"
                        onError={(event) => {
                          (event.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : null}

                  <div className="text-lg font-medium leading-relaxed text-slate-900">
                    {activeQuestion ? <MathText content={activeQuestion.question_text} /> : null}
                  </div>

                  <div className="space-y-3">
                    {activeQuestion?.options?.map((option, index) => {
                      const selected = answers[activeQuestion.id] === option;
                      const displayText = stripLeadingOptionLabel(option);
                      const isStudy = setupMode === "study";
                      const correctLabel = (activeQuestion?.correct_option || "").toUpperCase();
                      const optionLabel = OPTION_LABELS[index];
                      const isCorrectOption = isStudy && correctLabel && optionLabel === correctLabel;
                      const revealed = !!revealedAnswers[activeQuestion.id];
                      return (
                        <button
                          key={`${activeQuestion.id}-${index}`}
                          type="button"
                          onClick={() => recordAnswer(activeQuestion.id, option)}
                          className={`group flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 ${revealed && isCorrectOption
                              ? "border-emerald-600 bg-emerald-50 shadow-sm"
                              : revealed && selected && !isCorrectOption
                                ? "border-rose-600 bg-rose-50 shadow-sm"
                                : selected
                                  ? "border-blue-600 bg-blue-50 shadow-sm ring-1 ring-blue-600/20"
                                  : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm"
                            }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${revealed && isCorrectOption
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : revealed && selected && !isCorrectOption
                                  ? "border-rose-600 bg-rose-600 text-white"
                                  : selected
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-slate-300 bg-slate-50 text-slate-500 group-hover:border-blue-400 group-hover:bg-blue-100 group-hover:text-blue-600"
                              }`}
                          >
                            {OPTION_LABELS[index]}
                          </div>
                          <span className={`flex-1 text-base ${selected ? "font-medium text-blue-950" : "text-slate-700"}`}>
                            <MathText content={displayText} />
                          </span>
                        </button>
                      );
                    })}
                    {setupMode === "study" ? (
                      <div className="pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRevealedAnswers((s) => ({ ...s, [activeQuestion!.id]: !s[activeQuestion!.id] }))}
                        >
                          {revealedAnswers[activeQuestion!.id] ? "Hide answer & explanation" : "Show answer & explanation"}
                        </Button>
                      </div>
                    ) : null}

                    {setupMode === "study" && revealedAnswers[activeQuestion?.id || ""] ? (
                      <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <p className="mb-2 font-bold">Correct answer</p>
                        <p className="mb-3 text-base font-semibold text-emerald-800">
                          {(() => {
                            const lbl = (activeQuestion?.correct_option || "").toUpperCase();
                            const idx = OPTION_LABELS.indexOf(lbl);
                            const text = idx >= 0 ? stripLeadingOptionLabel(activeQuestion?.options?.[idx] || "") : activeQuestion?.correct_option || "";
                            return `${lbl} — ${text}`;
                          })()}
                        </p>
                        {activeQuestion?.explanation ? (
                          <div className="prose max-w-none text-slate-800">
                            <MathText content={activeQuestion.explanation} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <Button variant="outline" size="lg" onClick={handlePrevQuestion} disabled={isFirstQuestion || loadingQuestions} className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  <ChevronLeft className="h-5 w-5" /> Prev
                </Button>

                <button
                  onClick={() => setShowQuestionGrid(true)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-100"
                >
                  <LayoutGrid className="h-4 w-4" /> Jump to question
                </button>

                {setupMode === "study" ? (
                  isLastQuestion ? (
                    <Button size="lg" onClick={clearAndExit} className="gap-2 bg-slate-700 px-8 text-white shadow-sm hover:bg-slate-800">
                      Exit Study
                    </Button>
                  ) : (
                    <Button
                      size="lg"
                      onClick={handleNextQuestion}
                      disabled={loadingQuestions}
                      className="gap-2 bg-blue-600 px-8 text-white shadow-sm hover:bg-blue-700"
                    >
                      Next <ChevronRight className="h-5 w-5" />
                    </Button>
                  )
                ) : isLastQuestion ? (
                  <Button
                    size="lg"
                    onClick={submitAttempt}
                    disabled={submitting}
                    className="gap-2 bg-emerald-600 px-8 font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trophy className="h-5 w-5" />}
                    Submit Attempt
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={handleNextQuestion}
                    disabled={loadingQuestions}
                    className="gap-2 bg-blue-600 px-8 text-white shadow-sm hover:bg-blue-700"
                  >
                    Next <ChevronRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>

            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">Session status</p>
                      <p className="text-xs text-slate-500">Answer all questions before submitting.</p>
                    </div>
                    <button
                      onClick={() => setShowQuestionGrid(true)}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      <LayoutGrid className="h-3.5 w-3.5" /> Grid
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Answered</p>
                      <p className="mt-1 text-2xl font-black text-slate-800">{totalAnsweredCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Pending</p>
                      <p className="mt-1 text-2xl font-black text-slate-800">{Math.max(totalQuestionCount - totalAnsweredCount, 0)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 border-t border-slate-100 pt-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      Current page ({questionPage}/{questionTotalPages})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {questions.map((question, index) => {
                        const answered = !!answers[question.id];
                        const active = index === activeQuestionIndex;
                        const questionNumber = (questionPage - 1) * QUESTIONS_PER_PAGE + index + 1;
                        return (
                          <button
                            key={question.id}
                            onClick={() => setActiveQuestionIndex(index)}
                            title={`Q${questionNumber}${answered ? " (answered)" : ""}`}
                            className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 text-sm font-bold shadow-sm transition-all ${active
                                ? "border-blue-600 bg-blue-600 text-white scale-110"
                                : answered
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                          >
                            {questionNumber}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck className="h-4 w-4" /> Focus mode
                  </div>
                  <p className="mt-2 leading-relaxed text-amber-800">
                    This page keeps the exam isolated so you can concentrate on the question set without the full dashboard chrome.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      <Dialog open={showQuestionGrid} onOpenChange={setShowQuestionGrid}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="text-xl">Question Navigator</DialogTitle>
            <DialogDescription>Jump directly to any question in the set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {Array.from({ length: questionTotalPages }, (_, pageIndex) => pageIndex + 1).map((pageNumber) => (
              <div key={pageNumber} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Page {pageNumber}</p>
                <div className="flex flex-wrap gap-2.5">
                  {Array.from({
                    length: pageNumber < questionTotalPages ? QUESTIONS_PER_PAGE : totalQuestionCount - (questionTotalPages - 1) * QUESTIONS_PER_PAGE,
                  }, (_, questionIndex) => questionIndex).map((questionIndex) => {
                    const globalNumber = (pageNumber - 1) * QUESTIONS_PER_PAGE + questionIndex + 1;
                    const matchingQuestion = pageNumber === questionPage ? questions[questionIndex]?.id : null;
                    const answered = matchingQuestion ? !!answers[matchingQuestion] : false;
                    const isActive = pageNumber === questionPage && questionIndex === activeQuestionIndex;
                    return (
                      <button
                        key={globalNumber}
                        onClick={() => {
                          goToQuestion(pageNumber, questionIndex);
                          setShowQuestionGrid(false);
                        }}
                        className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all ${isActive
                            ? "border-blue-600 bg-blue-100 text-blue-700 ring-2 ring-blue-600/20"
                            : answered
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                      >
                        {globalNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-100 bg-white pt-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 rounded border-2 border-blue-600 bg-blue-100" /> Current
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 rounded border-2 border-emerald-500 bg-emerald-50" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 rounded border-2 border-slate-200 bg-white" /> Pending
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowQuestionGrid(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
