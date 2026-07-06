"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Users,
  TrendingUp,
  Award,
  AlertCircle,
  Loader2,
  Filter,
  BookOpen,
  GraduationCap,
  UserCheck,
  ExternalLink,
} from "lucide-react";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface SubjectAnalyticsTabProps {
  subjectId: string;
  schoolId: string;
  subjectName: string;
}

interface Session {
  id: string;
  name: string;
  is_current: boolean;
}

interface Term {
  id: string;
  name: string;
  session_id: string;
  is_current: boolean;
}

interface SubjectClassInfo {
  id: string;
  subject_code?: string;
  class: { name: string } | null;
  teacher: { first_name: string; last_name: string } | null;
}

interface ClassSummary {
  className: string;
  teacherName: string;
  studentCount: number;
  avg: string;
  passRate: number;
  highest: number;
  lowest: number;
  subjectCode?: string;
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export function SubjectAnalyticsTab({ subjectId, schoolId, subjectName }: SubjectAnalyticsTabProps) {
  const router = useRouter();

  /* ── Data States ── */
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  const [subjectClasses, setSubjectClasses] = useState<SubjectClassInfo[]>([]);
  const [classSummaries, setClassSummaries] = useState<Record<string, ClassSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);

  /* ═══════════════════════════════════════
     DATA LOADING
  ═══════════════════════════════════════ */

  useEffect(() => {
    if (schoolId) loadInitial();
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInitial() {
    if (!schoolId) return;
    setIsLoading(true);

    try {
      const [sessionRes, termRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("school_id", schoolId).order("name"),
        supabase.from("terms").select("*").eq("school_id", schoolId).order("name"),
      ]);

      const sessionData = (sessionRes.data ?? []) as Session[];
      const termData = (termRes.data ?? []) as Term[];

      setSessions(sessionData);
      setTerms(termData);

      const currentSession = sessionData.find((s) => s.is_current);
      const currentTerm = termData.find((t) => t.is_current);
      const sesId = currentSession?.id || sessionData[0]?.id || "";
      const termId = currentTerm?.id || termData[0]?.id || "";

      setSelectedSession(sesId);
      setSelectedTerm(termId);

      // Load subject classes & overview summaries
      const classes = await loadSubjectClasses();
      setSubjectClasses(classes);

      if (sesId) {
        await loadOverviewSummaries(sesId, termId);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSubjectClasses(): Promise<SubjectClassInfo[]> {
    if (!schoolId) return [];

    const { data } = await supabase
      .from("subject_classes")
      .select(`
        id,
        subject_code,
        class:classes(name),
        teacher:teachers(first_name, last_name)
      `)
      .eq("school_id", schoolId)
      .eq("subject_id", subjectId);

    return (data ?? []) as unknown as SubjectClassInfo[];
  }

  async function loadOverviewSummaries(sessionId?: string, termId?: string) {
    if (!schoolId) return;
    setIsOverviewLoading(true);

    try {
      const scs = subjectClasses;
      if (scs.length === 0) { setClassSummaries({}); setIsOverviewLoading(false); return; }

      const scIds = scs.map((sc) => sc.id);

      let query: any = supabase
        .from("results")
        .select(`id, grade, student_id, subject_class_id`)
        .in("subject_class_id", scIds)
        .eq("school_id", schoolId);

      if (sessionId) query = query.eq("session_id", sessionId);
      if (termId) query = query.eq("term_id", termId);

      const { data: allResults } = await query;
      if (!allResults || allResults.length === 0) {
        const empty: Record<string, ClassSummary> = {};
        scs.forEach((sc) => {
          empty[sc.id] = {
            className: (sc as any).class?.name || "Unknown",
            teacherName: (sc as any).teacher
              ? `${(sc as any).teacher.first_name} ${(sc as any).teacher.last_name}`
              : "No teacher",
            studentCount: 0,
            avg: "0.0",
            passRate: 0,
            highest: 0,
            lowest: 0,
            subjectCode: (sc as any).subject_code,
          };
        });
        setClassSummaries(empty);
        setIsOverviewLoading(false);
        return;
      }

      const resultIds = allResults.map((r: any) => r.id);
      const { data: scoreRows } = await supabase
        .from("result_component_scores")
        .select("result_id, score")
        .in("result_id", resultIds)
        .eq("school_id", schoolId);

      const totalsMap = new Map<string, number>();
      (scoreRows || []).forEach((cs: any) => {
        totalsMap.set(cs.result_id, (totalsMap.get(cs.result_id) || 0) + cs.score);
      });

      const grouped: Record<string, ClassSummary> = {};
      scs.forEach((sc) => {
        const classResults = allResults.filter((r: any) => r.subject_class_id === sc.id);
        const totals = classResults.map((r: any) => totalsMap.get(r.id) || 0);
        const studentIds = new Set(classResults.map((r: any) => r.student_id));
        const avg = totals.length > 0 ? (totals.reduce((a: number, b: number) => a + b, 0) / totals.length) : 0;
        const passCount = classResults.filter((r: any) => !["D7", "E8", "F9"].includes(r.grade)).length;
        const passRate = classResults.length > 0 ? Math.round((passCount / classResults.length) * 100) : 0;

        grouped[sc.id] = {
          className: (sc as any).class?.name || "Unknown",
          teacherName: (sc as any).teacher
            ? `${(sc as any).teacher.first_name} ${(sc as any).teacher.last_name}`
            : "No teacher",
          studentCount: studentIds.size,
          avg: avg.toFixed(1),
          passRate,
          highest: totals.length > 0 ? Math.max(...totals) : 0,
          lowest: totals.length > 0 ? Math.min(...totals) : 0,
          subjectCode: (sc as any).subject_code,
        };
      });

      setClassSummaries(grouped);
    } catch (err) {
      console.error("Error loading overview summaries:", err);
    } finally {
      setIsOverviewLoading(false);
    }
  }

  /* ── Handlers ── */
  function handleSessionChange(val: string) {
    setSelectedSession(val);
    setSelectedTerm("");
    loadOverviewSummaries(val);
  }

  function handleTermChange(val: string) {
    setSelectedTerm(val);
    loadOverviewSummaries(selectedSession, val);
  }

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */

  /* ── Session/Term Filter Bar ── */
  function renderFilters() {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Session</label>
              <Select value={selectedSession} onValueChange={handleSessionChange}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Select Session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Term</label>
              <Select value={selectedTerm} onValueChange={handleTermChange}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {terms
                    .filter((t) => t.session_id === selectedSession)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ── Main Content ── */
  const summaryList = Object.entries(classSummaries);
  const classCount = summaryList.length;
  const totalStudents = summaryList.reduce((sum, [, s]) => sum + s.studentCount, 0);
  const overallAvg = summaryList.length > 0
    ? (summaryList.reduce((sum, [, s]) => sum + parseFloat(s.avg), 0) / summaryList.length).toFixed(1)
    : "0.0";
  const overallPassRate = summaryList.length > 0
    ? Math.round(summaryList.reduce((sum, [, s]) => sum + s.passRate, 0) / summaryList.length)
    : 0;

  // Build comparison chart data
  const comparisonData = summaryList.map(([id, s]) => ({
    id,
    className: s.className,
    avg: parseFloat(s.avg),
    passRate: s.passRate,
    students: s.studentCount,
  })).sort((a, b) => b.avg - a.avg);

  // Initial loading state
  if (isLoading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderFilters()}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <BookOpen className="h-5 w-5 mb-1.5 text-blue-600" />
            <p className="text-2xl font-bold text-blue-700">{classCount}</p>
            <p className="text-xs text-muted-foreground">Classes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="h-5 w-5 mb-1.5 text-emerald-600" />
            <p className="text-2xl font-bold text-emerald-700">{totalStudents}</p>
            <p className="text-xs text-muted-foreground">Total Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingUp className="h-5 w-5 mb-1.5 text-purple-600" />
            <p className="text-2xl font-bold text-purple-700">{overallAvg}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Award className="h-5 w-5 mb-1.5 text-amber-600" />
            <p className="text-2xl font-bold text-amber-700">{overallPassRate}%</p>
            <p className="text-xs text-muted-foreground">Avg Pass Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Cross-Class Comparison Chart */}
      {comparisonData.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Class Performance Comparison</CardTitle>
            <CardDescription className="text-xs">
              Average scores across classes — click a bar to view detailed analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(200, comparisonData.length * 50)}>
              <BarChart
                data={comparisonData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
              >
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="className"
                  tick={{ fontSize: 12 }}
                  width={70}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  formatter={(value: number) => [value.toFixed(1), "Avg Score"]}
                />
                <Bar
                  dataKey="avg"
                  radius={[0, 4, 4, 0]}
                  fill="#8b5cf6"
                  cursor="pointer"
                  onClick={(data: any) => {
                    const entry = comparisonData.find((d) => d.className === data.className);
                    if (entry) router.push(`/admin/subject-classes/${entry.id}/analytics`);
                  }}
                >
                  {comparisonData.map((entry, idx) => {
                    const fillColors = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
                    return <Cell key={idx} fill={fillColors[idx % fillColors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Class Cards Grid */}
      {isOverviewLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground ml-2">Loading class data...</p>
        </div>
      ) : summaryList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No class data available for this subject</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure classes are assigned in the Classes tab and results have been entered for the selected session/term
            </p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Classes Teaching This Subject</h3>
            <Badge variant="secondary" className="text-xs">
              {classCount} class{classCount !== 1 ? "es" : ""}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {summaryList.map(([id, summary]) => {
              const avgNum = parseFloat(summary.avg);
              const avgColor = avgNum >= 70 ? "text-emerald-600" : avgNum >= 40 ? "text-amber-600" : "text-red-600";
              const passRateColor = summary.passRate >= 70
                ? "bg-emerald-500"
                : summary.passRate >= 40
                ? "bg-amber-500"
                : "bg-red-500";

              return (
                <Link
                  key={id}
                  href={`/admin/subject-classes/${id}/analytics`}
                  className="block w-full rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{summary.className}</p>
                          {summary.subjectCode && (
                            <p className="text-[10px] font-mono text-muted-foreground">{summary.subjectCode}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    {/* Teacher */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {summary.teacherName !== "No teacher" ? summary.teacherName : (
                          <span className="italic">No teacher assigned</span>
                        )}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{summary.studentCount}</p>
                        <p className="text-[10px] text-muted-foreground">Students</p>
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${avgColor}`}>{summary.avg}</p>
                        <p className="text-[10px] text-muted-foreground">Avg</p>
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${summary.passRate >= 70 ? "text-emerald-600" : summary.passRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
                          {summary.passRate}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">Pass</p>
                      </div>
                    </div>

                    {/* Pass rate bar */}
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${passRateColor}`}
                        style={{ width: `${summary.passRate}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No comparison data state */}
      {!isOverviewLoading && comparisonData.length <= 1 && summaryList.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-amber-800">
              Only one class is available. Assign this subject to more classes to see cross-class comparisons.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
