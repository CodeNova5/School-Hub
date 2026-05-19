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
import { saveJambExamSetup } from "@/lib/jamb-session-storage";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck, BrainCircuit, Timer, GraduationCap } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type SubjectOption = { slug: string; name: string };

export default function StudentJambPage() {
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [hasAccess, setHasAccess] = useState(false);
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
      await fetchSubjects();
    } catch (error: any) {
      toast.error(error.message || "Failed to load JAMB data");
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    if (!selectedSubject) { setYears([]); setSelectedYear(""); return; }
    setSelectedYear("");
    void loadAvailableFilters(selectedSubject).catch((err: any) => toast.error(err.message || "Failed to load years"));
  }, [selectedSubject]);

  const filteredSubjectLabel = useMemo(() => subjects.find((s) => s.slug === selectedSubject)?.name || "JAMB", [selectedSubject, subjects]);

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
              <Select value={selectedYear} onValueChange={(v) => setSelectedYear(v)} disabled={mode === "exam" ? (examSubjects.length === 0) : !selectedSubject}>
                <SelectTrigger className={`h-12 bg-slate-50 border-slate-200 ${mode === "exam" ? (examSubjects.length === 0 ? "opacity-50" : "") : (!selectedSubject ? "opacity-50" : "")}`}>
                  <SelectValue placeholder={mode === "exam" ? (examSubjects.length === 0 ? "Select exam subjects first" : "Choose a year") : (selectedSubject ? "Choose a year" : "Select subject first")} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
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

          {selectedSubject && selectedYear && (
            <div className="mt-6 flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4 text-blue-900">
              <div className="p-2 bg-blue-100 rounded-full shrink-0">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold">{filteredSubjectLabel} <span className="mx-1 text-blue-300">•</span> {selectedYear}</p>
                <p className="text-xs text-blue-700 mt-0.5">Ready to begin. Click Begin Test to continue.</p>
              </div>
              <div className="ml-auto">
                <Button onClick={() => {
                  saveJambExamSetup({ subjectSlug: mode === "exam" ? "exam-multi" : selectedSubject, subjectName: mode === "exam" ? "JAMB Combination" : filteredSubjectLabel, examYear: selectedYear, mode, examSubjects });
                  const target = mode === "exam" ? "/student/jamb/exam" : "/student/jamb/practice";
                  window.location.href = target;
                }} className="ml-4">Begin Test</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}