"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { useSessionTermFilters } from "@/hooks/use-session-term-filters";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  Filter,
  GraduationCap,
  BookOpen,
  Search,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/* ─────────────────────────────────────────────
   Types & Constants
───────────────────────────────────────────── */

const GRADE_COLORS: Record<string, string> = {
  A1: "#16a34a", B2: "#4ade80", B3: "#86efac",
  C4: "#fef08a", C5: "#fde047", C6: "#facc15",
  D7: "#f97316", E8: "#fb923c", F9: "#ef4444",
};

const PASS_GRADES = ["A1", "B2", "B3", "C4", "C5", "C6"];

/* ── Skeleton Components ── */

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className ?? ""}`} />;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────
   Page Component
───────────────────────────────────────────── */

export default function SubjectAnalyticsPage({ params }: any) {
  const { schoolId } = useSchoolContext();
  const subjectClassId = params.id;

  const {
    sessions,
    terms,
    selectedSession,
    selectedTerm,
    handleSessionChange,
    handleTermChange,
    filtersReady,
  } = useSessionTermFilters(schoolId);

  const [results, setResults] = useState<any[]>([]);
  const [subject, setSubject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionTrend, setSessionTrend] = useState<any[]>([]);
  const [termTrend, setTermTrend] = useState<any[]>([]);
  const [genderStats, setGenderStats] = useState<any>(null);
  const [studentBreakdown, setStudentBreakdown] = useState<any[]>([]);
  const [scoreFilter, setScoreFilter] = useState<number>(0);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [highestPerTerm, setHighestPerTerm] = useState<any[]>([]);

  const [resultComponents, setResultComponents] = useState<any[]>([]);
  const [genderComparison, setGenderComparison] = useState<any[]>([]);

  // Data version for re-animations
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    if (schoolId && filtersReady) {
      loadInitial();
    }
  }, [schoolId, filtersReady]);

  async function loadInitial() {
    if (!schoolId) return;
    setIsLoading(true);

    const { data: subjectClass } = await supabase
      .from("subject_classes")
      .select(`id, subject_code, subject:subjects ( id, name ), class:classes ( id, name, level )`)
      .eq("school_id", schoolId)
      .eq("id", subjectClassId)
      .single();

    setSubject(subjectClass || null);

    loadResults(subjectClassId, selectedSession, selectedTerm);
    await loadGenderComparison(subjectClassId);
  }

  async function loadStudentBreakdown(subjectClassId: string, sessionId: string, termId: string, components: any[]) {
    if (!schoolId || components.length === 0) {
      setStudentBreakdown([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data: results, error: resultsError } = await supabase
        .from("results")
        .select(`
          id, grade, student_id,
          students!inner ( id, first_name, last_name, student_id, gender )
        `)
        .eq("subject_class_id", subjectClassId)
        .eq("session_id", sessionId)
        .eq("term_id", termId)
        .eq('school_id', schoolId);

      if (resultsError || !results || results.length === 0) {
        setStudentBreakdown([]);
        setIsLoading(false);
        return;
      }

      const resultIds = results.map((r: any) => r.id);
      const { data: componentScores } = await supabase
        .from("result_component_scores")
        .select("result_id, component_key, score")
        .in("result_id", resultIds)
        .eq('school_id', schoolId);

      const scoresMap = new Map<string, Map<string, number>>();
      (componentScores || []).forEach((cs: any) => {
        if (!scoresMap.has(cs.result_id)) scoresMap.set(cs.result_id, new Map());
        scoresMap.get(cs.result_id)!.set(cs.component_key, cs.score);
      });

      const sorted = results
        .map((r: any) => {
          const componentMap = scoresMap.get(r.id) || new Map();
          const componentScoresObj: any = {};
          let totalScore = 0;
          components.forEach((comp: any) => {
            const score = componentMap.get(comp.component_key) || 0;
            componentScoresObj[comp.component_key] = score;
            totalScore += score;
          });
          const student = r.students;
          return {
            id: r.id,
            name: `${student.first_name} ${student.last_name}`,
            student_id: student.student_id,
            gender: student.gender,
            ...componentScoresObj,
            total: totalScore,
            grade: r.grade || 'N/A',
          };
        })
        .sort((a: any, b: any) => b.total - a.total);

      setStudentBreakdown(sorted);
    } catch (error) {
      console.error("Error in loadStudentBreakdown:", error);
      setStudentBreakdown([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadResults(subjectClassId: string, sessionId?: string, termId?: string) {
    if (!schoolId) return;
    setIsLoading(true);

    try {
      const { data: componentData } = await supabase
        .from("result_component_templates")
        .select("component_key, component_name, max_score, display_order")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      const components = componentData || [];
      setResultComponents(components);

      let query: any = supabase
        .from("results")
        .select(`id, grade, student_id, session_id, term_id, students(first_name, last_name, student_id, gender)`)
        .eq("subject_class_id", subjectClassId)
        .eq('school_id', schoolId);

      if (sessionId) query = query.eq("session_id", sessionId);
      if (termId) query = query.eq("term_id", termId);

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        setResults([]);
        setSessionTrend([]);
        setTermTrend([]);
        setGenderStats({ male: 0, female: 0 });
        setStudentBreakdown([]);
        setIsLoading(false);
        setDataVersion(v => v + 1);
        return;
      }

      const resultIds = data.map((r: any) => r.id);
      const { data: componentScores } = await supabase
        .from("result_component_scores")
        .select("result_id, score")
        .in("result_id", resultIds)
        .eq('school_id', schoolId);

      const totalsMap = new Map<string, number>();
      (componentScores || []).forEach((cs: any) => {
        totalsMap.set(cs.result_id, (totalsMap.get(cs.result_id) || 0) + cs.score);
      });

      const enrichedResults = data.map((r: any) => ({
        ...r,
        total: totalsMap.get(r.id) || 0,
      }));

      setResults(enrichedResults);

      // Session Trend
      const { data: allSessionResults } = await supabase
        .from("results")
        .select(`id, session_id, sessions(name)`)
        .eq("subject_class_id", subjectClassId)
        .eq('school_id', schoolId);

      if (allSessionResults && allSessionResults.length > 0) {
        const allResultIds = allSessionResults.map((r: any) => r.id);
        const { data: allScores } = await supabase
          .from("result_component_scores")
          .select("result_id, score")
          .in("result_id", allResultIds)
          .eq('school_id', schoolId);

        const allTotalsMap = new Map<string, number>();
        (allScores || []).forEach((cs: any) => {
          allTotalsMap.set(cs.result_id, (allTotalsMap.get(cs.result_id) || 0) + cs.score);
        });

        const grouped = allSessionResults.reduce((acc: any, r: any) => {
          if (!acc[r.session_id]) acc[r.session_id] = { name: r.sessions.name, scores: [] };
          acc[r.session_id].scores.push(allTotalsMap.get(r.id) || 0);
          return acc;
        }, {});

        setSessionTrend(
          Object.values(grouped || {}).map((g: any) => ({
            session: g.name,
            avg: (g.scores.reduce((a: number, b: number) => a + b, 0) / g.scores.length).toFixed(1),
          }))
        );
      }

      // Highest Per Term
      if (sessionId) {
        const { data: termResults } = await supabase
          .from("results")
          .select(`id, term_id, students(first_name, last_name, student_id)`)
          .eq("subject_class_id", subjectClassId)
          .eq("session_id", sessionId)
          .eq('school_id', schoolId);

        if (termResults && termResults.length > 0) {
          const termResultIds = termResults.map((r: any) => r.id);
          const { data: termScores } = await supabase
            .from("result_component_scores")
            .select("result_id, score")
            .in("result_id", termResultIds)
            .eq('school_id', schoolId);

          const termTotalsMap = new Map<string, number>();
          (termScores || []).forEach((cs: any) => {
            termTotalsMap.set(cs.result_id, (termTotalsMap.get(cs.result_id) || 0) + cs.score);
          });

          const byTerm: any = {};
          termResults.forEach((r: any) => {
            const total = termTotalsMap.get(r.id) || 0;
            if (!byTerm[r.term_id] || total > (byTerm[r.term_id].total || 0)) {
              byTerm[r.term_id] = { ...r, total };
            }
          });
          setHighestPerTerm(Object.values(byTerm));
        }
      }

      // Term Trend
      if (sessionId) {
        const { data: termDataResults } = await supabase
          .from("results")
          .select(`id, term_id, terms(name)`)
          .eq("subject_class_id", subjectClassId)
          .eq("session_id", sessionId)
          .eq('school_id', schoolId);

        if (termDataResults && termDataResults.length > 0) {
          const termDataResultIds = termDataResults.map((r: any) => r.id);
          const { data: termDataScores } = await supabase
            .from("result_component_scores")
            .select("result_id, score")
            .in("result_id", termDataResultIds)
            .eq('school_id', schoolId);

          const termDataTotalsMap = new Map<string, number>();
          (termDataScores || []).forEach((cs: any) => {
            termDataTotalsMap.set(cs.result_id, (termDataTotalsMap.get(cs.result_id) || 0) + cs.score);
          });

          const groupedTerms = termDataResults.reduce((acc: any, r: any) => {
            if (!acc[r.term_id]) acc[r.term_id] = { name: r.terms.name, scores: [] };
            acc[r.term_id].scores.push(termDataTotalsMap.get(r.id) || 0);
            return acc;
          }, {});

          setTermTrend(
            Object.values(groupedTerms || {}).map((g: any) => ({
              term: g.name,
              avg: (g.scores.reduce((a: number, b: number) => a + b, 0) / g.scores.length).toFixed(1),
            }))
          );
        }
      }

      // Gender Stats
      const males = enrichedResults.filter((r: any) => r.students?.gender?.toLowerCase() === "male");
      const females = enrichedResults.filter((r: any) => r.students?.gender?.toLowerCase() === "female");
      setGenderStats({
        male: males.length ? (males.reduce((a: any, b: any) => a + b.total, 0) / males.length).toFixed(1) : 0,
        female: females.length ? (females.reduce((a: any, b: any) => a + b.total, 0) / females.length).toFixed(1) : 0,
      });

      if (sessionId && termId && components.length > 0) {
        await loadStudentBreakdown(subjectClassId, sessionId, termId, components);
      } else {
        setIsLoading(false);
      }
      setDataVersion(v => v + 1);
    } catch (error) {
      console.error("Error in loadResults:", error);
      setIsLoading(false);
    }
  }

  async function loadGenderComparison(subjectClassId: string) {
    if (!schoolId) return;
    try {
      let query: any = supabase
        .from("results")
        .select(`id, students(gender)`)
        .eq("subject_class_id", subjectClassId)
        .eq('school_id', schoolId);

      const { data: genderResults } = await query;
      if (!genderResults || genderResults.length === 0) {
        setGenderComparison([{ gender: "Male", avg: 0 }, { gender: "Female", avg: 0 }]);
        return;
      }

      const resultIds = genderResults.map((r: any) => r.id);
      const { data: scores } = await supabase
        .from("result_component_scores")
        .select("result_id, score")
        .in("result_id", resultIds)
        .eq('school_id', schoolId);

      const totalsMap = new Map<string, number>();
      (scores || []).forEach((cs: any) => {
        totalsMap.set(cs.result_id, (totalsMap.get(cs.result_id) || 0) + cs.score);
      });

      const males: number[] = [];
      const females: number[] = [];
      genderResults.forEach((r: any) => {
        const gender = r.students?.gender?.toLowerCase();
        const total = totalsMap.get(r.id) || 0;
        if (gender === "male") males.push(total);
        if (gender === "female") females.push(total);
      });

      setGenderComparison([
        { gender: "Male", avg: males.length ? (males.reduce((a, b) => a + b, 0) / males.length).toFixed(1) : 0 },
        { gender: "Female", avg: females.length ? (females.reduce((a, b) => a + b, 0) / females.length).toFixed(1) : 0 },
      ]);
    } catch (error) {
      console.error("Error in loadGenderComparison:", error);
      setGenderComparison([{ gender: "Male", avg: 0 }, { gender: "Female", avg: 0 }]);
    }
  }

  /* ── Derived Data ── */

  const avgScore = results.length > 0
    ? Number((results.reduce((a, b) => a + b.total, 0) / results.length).toFixed(1)) : 0;
  const passRate = results.length > 0
    ? Math.round((results.filter((r) => !["D7", "E8", "F9"].includes(r.grade)).length / results.length) * 100) : 0;
  const highestScore = results.length > 0 ? Math.max(...results.map((r) => r.total)) : 0;
  const lowestScore = results.length > 0 ? Math.min(...results.map((r) => r.total)) : 0;

  const gradeDistribution = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"].map((g) => ({
    grade: g,
    count: results.filter((r) => r.grade === g).length,
  }));

  const strugglingStudents = results.filter(r => r.total < 50 || ["D7", "E8", "F9"].includes(r.grade)).sort((a, b) => a.total - b.total);

  const currentSessionName = sessions.find((s: any) => s.id === selectedSession)?.name || "";
  const currentTermName = terms.find((t: any) => t.id === selectedTerm)?.name || "";

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */

  if (isLoading && results.length === 0) {
    return (
      <DashboardLayout role="admin">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          {/* Filter skeleton */}
          <Card>
            <CardHeader className="pb-3"><Skeleton className="h-5 w-24" /></CardHeader>
            <CardContent><div className="grid grid-cols-2 gap-4"><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-10 rounded-xl" /></div></CardContent>
          </Card>
          {/* Stat cards skeleton */}
          <div className="grid md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
          </div>
          {/* Charts skeleton */}
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2].map(i => <Card key={i}><CardContent className="p-6"><Skeleton className="h-[260px] w-full rounded-xl" /></CardContent></Card>)}
          </div>
          {/* Table skeleton */}
          <Card><CardContent className="p-6"><Skeleton className="h-[200px] w-full rounded-xl" /></CardContent></Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BookOpen className="h-4 w-4" />
              <span>Subject Analytics</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{subject?.subject?.name || "Subject"}</h1>
            <p className="text-sm text-muted-foreground">
              {subject?.class?.name} {subject?.class?.level ? `(${subject.class.level})` : ""}
              {subject?.subject_code && (
                <Badge variant="outline" className="ml-2 text-[10px] font-mono">{subject.subject_code}</Badge>
              )}
            </p>
          </div>
          {(currentSessionName || currentTermName) && (
            <div className="flex items-center gap-1.5">
              {currentSessionName && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">{currentSessionName}</Badge>
              )}
              {currentTermName && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">{currentTermName}</Badge>
              )}
            </div>
          )}
        </div>

        {/* ═══ FILTERS ═══ */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <GraduationCap className="h-3 w-3" />
                  Academic Session
                </label>
                <Select
                  value={selectedSession}
                  onValueChange={(val) => {
                    handleSessionChange(val);
                    loadResults(subjectClassId, val, selectedTerm);
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select Session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s: any) => (
                      <SelectItem value={s.id} key={s.id}>
                        <span>{s.name}</span>
                        {s.is_current && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">Current</Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-3 w-3" />
                  Term
                </label>
                <Select
                  value={selectedTerm}
                  onValueChange={(val) => {
                    handleTermChange(val);
                    loadResults(subjectClassId, selectedSession, val);
                  }}
                  disabled={!selectedSession}
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder={selectedSession ? "Select Term" : "Select a session first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {terms
                      .filter((t: any) => t.session_id === selectedSession)
                      .map((t: any) => (
                        <SelectItem value={t.id} key={t.id}>
                          <span>{t.name}</span>
                          {t.is_current && (
                            <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">Current</Badge>
                          )}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ SUMMARY CARDS ═══ */}
        <div key={dataVersion} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} value={results.length} label="Students Offering This Subject" color="blue" />
          <StatCard icon={TrendingUp} value={avgScore} label="Average Score" color="emerald" />
          <StatCard icon={Award} value={highestScore} label="Highest Score" color="purple" />
          <StatCard icon={TrendingDown} value={lowestScore} label="Lowest Score" color="red" />
        </div>

        {/* ═══ TREND CHARTS (previously hidden) ═══ */}
        {sessionTrend.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Session Trend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Performance Trend Across Sessions
                </CardTitle>
                <CardDescription className="text-xs">Average scores across all available sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sessionTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="session" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                      formatter={(value: any) => [`${value}`, "Avg Score"]} />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]} fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Term Trend */}
            {termTrend.length > 1 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Term Performance Trend
                  </CardTitle>
                  <CardDescription className="text-xs">Average scores across terms in this session</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={termTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <XAxis dataKey="term" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                        formatter={(value: any) => [`${value}`, "Avg Score"]} />
                      <Bar dataKey="avg" radius={[4, 4, 0, 0]} fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ GRADE DISTRIBUTION + GENDER ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Grade Distribution */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  Grade Distribution
                </CardTitle>
                {results.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{passRate}% pass rate</Badge>
                )}
              </div>
              <CardDescription className="text-xs">{results.length} student{results.length !== 1 ? "s" : ""}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={gradeDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="grade" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={(value: number, _: any, props: any) => {
                      const pct = results.length > 0 ? ((value / results.length) * 100).toFixed(1) : "0";
                      return [`${value} (${pct}%)`, props.payload.grade];
                    }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {gradeDistribution.map((entry) => (
                      <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade] || "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Male vs Female */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Male vs Female Performance
              </CardTitle>
              <CardDescription className="text-xs">Average score comparison by gender</CardDescription>
            </CardHeader>
            <CardContent>
              {genderStats && (parseFloat(genderStats.male) > 0 || parseFloat(genderStats.female) > 0) && (
                <div className="flex items-center gap-4 text-xs bg-muted/30 rounded-lg px-3 py-2 mb-4">
                  <span className="text-muted-foreground">Overall:</span>
                  <span className="font-semibold text-blue-600">♂ {genderStats.male}</span>
                  <span className="font-semibold text-pink-600">♀ {genderStats.female}</span>
                </div>
              )}
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={genderComparison} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="gender" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={(value: any) => [`${value}`, "Avg Score"]} />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                    {genderComparison.map((entry, idx) => (
                      <Cell key={idx} fill={idx === 0 ? "#3b82f6" : "#ec4899"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* ═══ ASSESSMENT COMPONENT BREAKDOWN ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Assessment Component Breakdown
            </CardTitle>
            <CardDescription className="text-xs">Average scores per assessment component</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={resultComponents.map((comp) => ({
                  name: comp.component_name,
                  avg: results.length ? (results.reduce((a: number, b: any) => {
                    const val = studentBreakdown.find(sb => sb.id === b.id)?.[comp.component_key] || 0;
                    return a + val;
                  }, 0) / results.length).toFixed(1) : 0,
                  max: comp.max_score,
                }))}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={(value: any, _: any, props: any) => {
                    const pct = props.payload.max > 0 ? Math.round((value / props.payload.max) * 100) : 0;
                    return [`${value} / ${props.payload.max} (${pct}%)`, props.payload.name];
                  }} />
                <Bar dataKey="avg" radius={[4, 4, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ═══ HIGHEST PER TERM ═══ */}
        {highestPerTerm.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                Highest Scorer Per Term
              </CardTitle>
              <CardDescription className="text-xs">Top performer in each term within this session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {highestPerTerm.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:shadow-sm transition-shadow">
                    <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Award className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {item.students?.first_name} {item.students?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Score: <span className="font-semibold text-amber-700">{item.total}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ STUDENT PERFORMANCE BREAKDOWN ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Student Performance Breakdown
                </CardTitle>
                <CardDescription className="text-xs">Ordered by total score (highest → lowest)</CardDescription>
              </div>
              {studentBreakdown.length > 0 && (
                <Badge variant="secondary" className="text-xs">{studentBreakdown.length} student{studentBreakdown.length !== 1 ? "s" : ""}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  className="pl-9 h-10 rounded-xl"
                  value={searchQuery}
                  onChange={(e: any) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v)}>
                <SelectTrigger className="h-10 rounded-xl w-[140px]">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(scoreFilter)} onValueChange={(v) => setScoreFilter(Number(v))}>
                <SelectTrigger className="h-10 rounded-xl w-[160px]">
                  <SelectValue placeholder="Min Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Scores</SelectItem>
                  <SelectItem value="40">40+ (Pass)</SelectItem>
                  <SelectItem value="70">70+ (Top)</SelectItem>
                  <SelectItem value="85">85+ (Excellent)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {studentBreakdown.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p>No student data available for the selected filters</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10">#</th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                        {resultComponents.map((comp) => (
                          <th key={comp.component_key} className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            {comp.component_name}
                          </th>
                        ))}
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                        <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentBreakdown
                        .filter((s) =>
                          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.student_id.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .filter((s) => genderFilter === "all" ? true : s.gender?.toLowerCase() === genderFilter)
                        .filter((s) => s.total >= scoreFilter)
                        .map((s, index) => {
                          const total = s.total;
                          const rowColor = total >= 70 ? "bg-emerald-50/30" : total >= 40 ? "" : "bg-red-50/30";
                          return (
                            <tr key={s.id} className={`border-t transition-colors hover:bg-muted/20 ${rowColor}`}>
                              <td className="p-3 text-muted-foreground text-xs">{index + 1}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                                      {s.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <div className="font-medium text-sm truncate max-w-[180px]">{s.name}</div>
                                    <div className="text-xs text-muted-foreground">{s.student_id}</div>
                                  </div>
                                </div>
                              </td>
                              {resultComponents.map((comp) => (
                                <td key={comp.component_key} className="p-3 text-sm">{s[comp.component_key] || 0}</td>
                              ))}
                              <td className="p-3 font-bold text-sm">{total}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                  ["D7", "E8", "F9"].includes(s.grade)
                                    ? "bg-red-100 text-red-800"
                                    : ["A1", "B2", "B3"].includes(s.grade)
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}>
                                  {s.grade}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ STUDENTS NEEDING ATTENTION ═══ */}
        <Card className="border-red-200">
          <CardHeader className="pb-3 border-b border-red-100 bg-red-50/30">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-900">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Students Needing Attention
              </CardTitle>
              {strugglingStudents.length > 0 && (
                <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50 text-xs">{strugglingStudents.length} student{strugglingStudents.length !== 1 ? "s" : ""}</Badge>
              )}
            </div>
            <CardDescription className="text-xs text-red-700">Students scoring below 50 or failing (D7, E8, F9)</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {strugglingStudents.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <p>No struggling students found. 🎉</p>
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-red-50/80 border-b">
                        <th className="p-3 text-left text-xs font-semibold text-red-800 uppercase tracking-wider">Student</th>
                        <th className="p-3 text-left text-xs font-semibold text-red-800 uppercase tracking-wider">Score</th>
                        <th className="p-3 text-left text-xs font-semibold text-red-800 uppercase tracking-wider">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {strugglingStudents.map((r) => (
                        <tr key={r.id} className="border-t bg-red-50/20 transition-colors hover:bg-red-50/40">
                          <td className="p-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-red-100 text-red-700 text-xs font-medium">
                                  {r.students.first_name.charAt(0)}{r.students.last_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate max-w-[200px]">{r.students.first_name} {r.students.last_name}</div>
                                <div className="text-xs text-muted-foreground">({r.students.student_id})</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-red-700">{r.total}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                              {r.grade}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ═══════════════════════════════════════
         Animations (injected once)
      ═══════════════════════════════════════ */}
      <style>{`
        .stat-card-enter {
          animation: statFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes statFadeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-card-enter { animation: none !important; }
          * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}

/* ─────────────── Stat Card Sub-component ─────────────── */

const COLOR_MAP: Record<string, { bg: string; icon: string; value: string }> = {
  blue: { bg: "bg-blue-100", icon: "text-blue-600", value: "text-blue-700" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", value: "text-emerald-700" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600", value: "text-purple-700" },
  red: { bg: "bg-red-100", icon: "text-red-600", value: "text-red-700" },
};

function StatCard({ icon: Icon, value, label, color }: {
  icon: any;
  value: string | number;
  label: string;
  color: "blue" | "emerald" | "purple" | "red";
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="stat-card-enter">
      <Card className="border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${c.bg}`}>
            <Icon className={`h-4 w-4 ${c.icon}`} />
          </div>
          <p className={`text-2xl font-bold ${c.value}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </div>
  );
}
