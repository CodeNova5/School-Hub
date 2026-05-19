"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { useSchoolContext } from "@/hooks/use-school-context";
import { loadJambExamResult, saveJambExamSetup } from "@/lib/jamb-session-storage";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck, BrainCircuit, Timer, GraduationCap, CalendarDays, Trophy } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type SubjectOption = { slug: string; name: string };
type LastAttemptSummary = {
  id: string;
  score: number;
  subjectName: string;
  examYear: number;
  subjectSlug: string;
  createdAt: string;
  modeLabel: string;
};

export default function StudentJambPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<LastAttemptSummary | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [mode, setMode] = useState<"study" | "practice" | "exam">("practice");
  const [examSubjects, setExamSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (!schoolLoading && schoolId) void loadJambData();
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
      await fetchLastAttempt(student.id);
      await fetchSubjects();
    } catch (error: any) {
      toast.error(error.message || "Failed to load JAMB data");
    } finally {
      setLoading(false);
    }
  }

  async function fetchLastAttempt(studentId: string) {
    if (!schoolId) return;
    const { data: attempt, error } = await supabase
      .from("jamb_attempts")
      .select("id, score, subject_name, exam_year, subject_slug, created_at")
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .eq("exam_type", "jamb")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!attempt) {
      setLastAttempt(null);
      return;
    }

    const cachedResult = loadJambExamResult();
    let cachedMode: "study" | "practice" | "exam" | undefined;
    if (cachedResult && cachedResult.attemptId === attempt.id) {
      cachedMode = cachedResult.mode;
    }
    const derivedMode = cachedMode || (attempt.subject_slug === "exam-multi" ? "exam" : "practice");
    const modeLabel = derivedMode === "exam" ? "Exam" : derivedMode === "study" ? "Study" : "Practice";

    setLastAttempt({
      id: attempt.id,
      score: Number(attempt.score || 0),
      subjectName: attempt.subject_name || "JAMB",
      examYear: Number(attempt.exam_year || 0),
      subjectSlug: attempt.subject_slug || "",
      createdAt: attempt.created_at,
      modeLabel,
    });
  }

  async function fetchSubjects() {
    try {
      const { data: catalogRows, error: catalogError } = await supabase
        .from("jamb_subjects")
        .select("slug, name")
        .order("name", { ascending: true });
      if (catalogError) throw catalogError;

      const fromCatalog = (catalogRows || [])
        .filter((row: any) => !!row.slug && !!row.name)
        .map((row: any): SubjectOption => ({ slug: row.slug, name: row.name }));
      setSubjects(fromCatalog);
    } catch (error: any) {
      toast.error(error.message || "Failed to load subjects");
    }
  }

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

  async function loadExamYears(extraSubjects: string[]) {
    const allSubjects = ["english-language", ...extraSubjects];
    const { data: yearRows, error: yearError } = await supabase
      .from("jamb_subject_years")
      .select("subject_slug, exam_year")
      .in("subject_slug", allSubjects)
      .order("exam_year", { ascending: false });
    if (yearError) throw yearError;

    const yearToSubjects = new Map<number, Set<string>>();
    for (const row of yearRows || []) {
      if (!Number.isFinite(row.exam_year) || !row.subject_slug) continue;
      const current = yearToSubjects.get(Number(row.exam_year)) || new Set<string>();
      current.add(row.subject_slug);
      yearToSubjects.set(Number(row.exam_year), current);
    }

    const validYears = Array.from(yearToSubjects.entries())
      .filter(([, slugs]) => allSubjects.every((slug) => slugs.has(slug)))
      .map(([year]) => year)
      .sort((a, b) => b - a);

    setYears(validYears);
  }

  useEffect(() => {
    setSelectedYear("");
    if (mode === "exam") {
      if (examSubjects.length === 0) {
        setYears([]);
        return;
      }
      void loadExamYears(examSubjects).catch((err: any) => toast.error(err.message || "Failed to load years"));
      return;
    }

    if (!selectedSubject) {
      setYears([]);
      return;
    }

    void loadAvailableFilters(selectedSubject).catch((err: any) => toast.error(err.message || "Failed to load years"));
  }, [selectedSubject, mode, examSubjects]);

  const filteredSubjectLabel = useMemo(() => subjects.find((s) => s.slug === selectedSubject)?.name || "JAMB", [selectedSubject, subjects]);
  const examSubjectsComplete = mode !== "exam" || examSubjects.length === 3;
  const hasSelection = mode === "exam" ? examSubjects.length > 0 : !!selectedSubject;
  const canStart = mode === "exam"
    ? !!selectedYear && examSubjectsComplete
    : !!selectedSubject && !!selectedYear;

  const selectedExamSubjectNames = useMemo(() => {
    if (mode !== "exam") return "";
    return examSubjects
      .map((slug) => subjects.find((s) => s.slug === slug)?.name)
      .filter(Boolean)
      .join(", ");
  }, [mode, examSubjects, subjects]);

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

  return (
    <DashboardLayout role="student">
      <div className="space-y-8 pb-16">
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

        {lastAttempt && (
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Last Attempt</p>
                <p className="mt-1 text-sm text-slate-700">{lastAttempt.subjectName} <span className="mx-1 text-slate-300">•</span> {lastAttempt.examYear}</p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {new Date(lastAttempt.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:w-auto">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Score</p>
                  <p className="mt-1 inline-flex items-center justify-center gap-1 text-xl font-black text-emerald-800">
                    <Trophy className="h-4 w-4" />
                    {lastAttempt.score.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Mode</p>
                  <p className="mt-1 text-xl font-black text-slate-800">{lastAttempt.modeLabel}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">2. {mode === "exam" ? "Primary Subject" : "Select Subject"}</label>
              <Select value={selectedSubject} onValueChange={(v) => setSelectedSubject(v)} disabled={mode === "exam"}>
                <SelectTrigger className="h-12 bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Choose a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">3. Exam Year</label>
              <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v)} disabled={!hasSelection}>
                <SelectTrigger className={`h-12 bg-slate-50 border-slate-200 ${!hasSelection ? "opacity-50" : ""}`}>
                  <SelectValue placeholder={hasSelection ? "Choose a year" : (mode === "exam" ? "Select exam subjects first" : "Select subject first")} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasSelection && years.length === 0 && (
                <p className="text-xs text-amber-700">No available years found for the current selection. Try a different subject combination.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-800 mb-3">Readiness Checklist</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className={`text-xs rounded-lg border px-3 py-2 ${mode === "exam" ? "border-slate-300 bg-white text-slate-600" : (selectedSubject ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}`}>
                {mode === "exam" ? "Subject selection is handled below" : (selectedSubject ? "Subject selected" : "Select a subject")}
              </div>
              <div className={`text-xs rounded-lg border px-3 py-2 ${selectedYear ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {selectedYear ? `Exam year selected: ${selectedYear}` : "Select an exam year"}
              </div>
              <div className={`text-xs rounded-lg border px-3 py-2 ${examSubjectsComplete ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {mode === "exam"
                  ? (examSubjectsComplete ? "Exam subjects complete (3/3)" : `Select ${3 - examSubjects.length} more subject${3 - examSubjects.length === 1 ? "" : "s"}`)
                  : "Exam subject combo not required in this mode"}
              </div>
            </div>
          </div>

          {mode === "exam" && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Select Exam Subjects</p>
                <Badge variant="secondary" className="bg-slate-200 text-slate-700">{examSubjects.length}/3 selected</Badge>
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
                      onClick={() => setExamSubjects((prev) => prev.includes(s.slug) ? prev.filter(p => p !== s.slug) : (prev.length >=3 ? prev : [...prev, s.slug]))}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${isChecked ? "bg-blue-600 border-blue-600 text-white shadow-sm" : isDisabled ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50"}`}>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {canStart && (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4 text-blue-900">
              <div className="p-2 bg-blue-100 rounded-full shrink-0">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {mode === "exam" ? "JAMB Combination" : filteredSubjectLabel}
                  <span className="mx-1 text-blue-300">•</span>
                  {selectedYear}
                </p>
                {mode === "exam" && !!selectedExamSubjectNames && (
                  <p className="text-xs text-blue-700 mt-0.5">English Language + {selectedExamSubjectNames}</p>
                )}
                <p className="text-xs text-blue-700 mt-0.5">Ready to begin. Click Begin Test to continue.</p>
              </div>
              <div className="ml-auto">
                <Button
                  onClick={() => {
                    if (starting) return;
                    setStarting(true);
                    try {
                      saveJambExamSetup({
                        subjectSlug: mode === "exam" ? "exam-multi" : selectedSubject,
                        subjectName: mode === "exam" ? "JAMB Combination" : filteredSubjectLabel,
                        examYear: selectedYear,
                        mode,
                        examSubjects
                      });
                      const target = mode === "exam" ? "/student/jamb/exam" : "/student/jamb/exam";
                      window.location.href = target;
                    } catch (error: any) {
                      setStarting(false);
                      toast.error(error?.message || "Unable to start test. Please try again.");
                    }
                  }}
                  className="ml-4"
                  disabled={starting}
                >
                  {starting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting...
                    </span>
                  ) : (
                    "Begin Test"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}