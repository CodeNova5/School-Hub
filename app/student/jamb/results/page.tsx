"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, HelpCircle, Trophy, XCircle, ShieldCheck, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { loadJambExamResult, type CachedJambResult } from "@/lib/jamb-session-storage";
import { toast } from "sonner";

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
      console.error("Failed to normalize result content", error);
    }
  }
  return normalized.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

type ResultShape = CachedJambResult & {
  attemptId?: string;
  subjectSlug?: string;
  subjectName?: string;
  examYear?: number;
};

export default function StudentJambResultsPage() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId") || "";
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ResultShape | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;

    async function loadResult() {
      try {
        const cached = loadJambExamResult();
        if (cached && (!attemptId || cached.attemptId === attemptId)) {
          if (active) {
            setResult(cached);
            setError(null);
            setLoading(false);
          }
          return;
        }

        if (!attemptId) {
          if (active) {
            setError("No submission was found for this results page.");
            setLoading(false);
          }
          return;
        }

        const response = await fetch(`/api/student/jamb/attempts/${encodeURIComponent(attemptId)}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load attempt details");
        }

        if (active) {
          setResult(payload.data);
          setError(null);
        }
      } catch (loadError: any) {
        console.error("[student/jamb/results] load error", loadError);
        if (active) {
          setError(loadError?.message || "Failed to load result");
          toast.error(loadError?.message || "Failed to load result");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadResult();

    return () => {
      active = false;
    };
  }, [attemptId]);

  const unansweredCount = result?.unansweredCount || 0;
  const missedCount = result?.missedCount || 0;

  return (
    <DashboardLayout role="student">
      <div className="mx-auto max-w-6xl space-y-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="gap-1.5 bg-emerald-100 text-emerald-800 border-emerald-200">
                <ShieldCheck className="h-3 w-3" /> Submission complete
              </Badge>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">JAMB results</h1>
            <p className="mt-1 text-sm text-slate-500">Review your score, missed items, and the next step from here.</p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/student/jamb">Back to JAMB</Link>
            </Button>
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
              <Link href="/student">Dashboard</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
              <p className="text-slate-600">Loading your result…</p>
            </div>
          </div>
        ) : error || !result ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || "Your latest attempt could not be found. Go back to the JAMB page to start a new session."}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Final score</p>
                <div className="mt-2 flex items-end gap-2">
                  <h2 className="text-6xl font-black tracking-tight text-slate-900">{result.score}<span className="text-3xl text-slate-400">%</span></h2>
                </div>
                <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                  {result.correctCount} / {result.totalQuestions} correct
                </p>

                {result.previousAttempt ? (
                  <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-800">Vs previous attempt</p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-black text-blue-900">{result.previousAttempt.score}%</p>
                        <p className="text-xs text-blue-700">Prior score</p>
                      </div>
                      <div className={`rounded-lg px-3 py-1 text-sm font-bold ${result.score >= result.previousAttempt.score ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {result.score >= result.previousAttempt.score ? "+" : ""}{(result.score - result.previousAttempt.score).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Summary</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Answered</p>
                    <p className="mt-1 text-3xl font-black text-emerald-800">{result.answeredCount || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Unanswered</p>
                    <p className="mt-1 text-3xl font-black text-amber-800">{unansweredCount}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  You missed {missedCount} question{missedCount === 1 ? "" : "s"}. Review the detailed breakdown below.
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Detailed review</h3>

              {unansweredCount > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-bold text-amber-900 flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-amber-600" /> Unanswered questions
                  </p>
                  <p className="mt-1 text-sm text-amber-800">
                    Questions skipped: {result.unansweredQuestions?.join(", ") || "None"}
                  </p>
                </div>
              ) : null}

              {missedCount > 0 ? (
                <div className="space-y-4">
                  {result.missedQuestions?.map((item, index) => (
                    <div key={`${item.questionId}-${index}`} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Question {item.questionNumber || index + 1}</p>
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200">
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Missed
                        </Badge>
                      </div>

                      <div className="text-base font-medium leading-relaxed text-slate-900">
                        <MathText content={item.questionText} />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Your answer</p>
                          <p className="mt-2 text-sm font-medium text-rose-900">
                            <MathText content={item.userAnswer || "None"} />
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Correct answer</p>
                          <p className="mt-2 text-sm font-medium text-emerald-900">
                            <MathText content={item.correctOption} />
                          </p>
                        </div>
                      </div>

                      {item.explanation ? (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-800">Explanation</p>
                          <div className="mt-2 text-sm text-blue-950">
                            <MathText content={item.explanation} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Everything was answered correctly
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">You can return to the dashboard or start another JAMB session.</p>
                </div>
              )}
            </div>

            <Alert className="border-slate-200 bg-white">
              <BookOpen className="h-4 w-4" />
              <AlertDescription>
                This result page is backed by your saved attempt, so it can be reopened later as long as the attempt record exists.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
