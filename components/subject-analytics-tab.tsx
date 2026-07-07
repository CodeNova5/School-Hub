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
  Filter,
  BookOpen,
  GraduationCap,
  UserCheck,
  ExternalLink,
  BarChart3,
  SortAsc,
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
   Constants
───────────────────────────────────────────── */
const STAT_ENTRY_DELAYS = [0, 80, 160, 240];
const CHART_COLORS = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

function getAvgColor(avg: number) {
  if (avg >= 70) return "text-emerald-600";
  if (avg >= 40) return "text-amber-600";
  return "text-red-600";
}

function getPassRateColor(rate: number) {
  if (rate >= 70) return "bg-emerald-500";
  if (rate >= 40) return "bg-amber-500";
  return "bg-red-500";
}

/* ─────────────────────────────────────────────
   Skeleton Sub-component
───────────────────────────────────────────── */
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className ?? ""}`} />;
}

function StatCardSkeleton() {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 flex flex-col items-center text-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

function ClassCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-3 w-40" />
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1"><Skeleton className="h-6 w-8 mx-auto" /><Skeleton className="h-2 w-12 mx-auto" /></div>
          <div className="space-y-1"><Skeleton className="h-6 w-8 mx-auto" /><Skeleton className="h-2 w-12 mx-auto" /></div>
          <div className="space-y-1"><Skeleton className="h-6 w-8 mx-auto" /><Skeleton className="h-2 w-12 mx-auto" /></div>
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
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

  // Track data version for fade transitions on filter change
  const [dataVersion, setDataVersion] = useState(0);

  // Sort preference for class cards
  const [sortBy, setSortBy] = useState<"avg" | "passRate" | "alpha">("avg");

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

      // Start with DB defaults (is_current)
      const currentSession = sessionData.find((s) => s.is_current);
      const currentTerm = termData.find((t) => t.is_current);
      let sesId = currentSession?.id || sessionData[0]?.id || "";
      let termId = currentTerm?.id || termData[0]?.id || "";

      // Override with URL params if non-empty and valid
      const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const urlSession = urlParams?.get("session")?.trim();
      const urlTerm = urlParams?.get("term")?.trim();

      if (urlSession && sessionData.find((s) => s.id === urlSession)) sesId = urlSession;
      if (urlTerm && termData.find((t) => t.id === urlTerm)) termId = urlTerm;

      setSelectedSession(sesId);
      setSelectedTerm(termId);

      // Sync URL to reflect final selection
      const params = new URLSearchParams();
      params.set("session", sesId);
      params.set("term", termId);
      router.replace(`?${params.toString()}`, { scroll: false });

      const classes = await loadSubjectClasses();
      setSubjectClasses(classes);

      if (sesId) {
        await loadOverviewSummaries(sesId, termId, classes);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
    } finally {
      setIsLoading(false);
      setDataVersion((v) => v + 1);
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

  async function loadOverviewSummaries(sessionId?: string, termId?: string, overrideClasses?: SubjectClassInfo[]) {
    if (!schoolId) return;
    setIsOverviewLoading(true);

    try {
      const scs = overrideClasses ?? subjectClasses;
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
        setDataVersion((v) => v + 1);
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
      setDataVersion((v) => v + 1);
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
    const params = new URLSearchParams(window.location.search);
    params.set("session", val);
    params.delete("term");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function handleTermChange(val: string) {
    setSelectedTerm(val);
    loadOverviewSummaries(selectedSession, val);
    const params = new URLSearchParams(window.location.search);
    params.set("term", val);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  /* ═══════════════════════════════════════
     DERIVED DATA
  ═══════════════════════════════════════ */

  const summaryList = Object.entries(classSummaries);
  const classCount = summaryList.length;
  const totalStudents = summaryList.reduce((sum, [, s]) => sum + s.studentCount, 0);
  const overallAvg = summaryList.length > 0
    ? (summaryList.reduce((sum, [, s]) => sum + parseFloat(s.avg), 0) / summaryList.length).toFixed(1)
    : "0.0";
  const overallPassRate = summaryList.length > 0
    ? Math.round(summaryList.reduce((sum, [, s]) => sum + s.passRate, 0) / summaryList.length)
    : 0;

  // Build comparison chart data and sort by avg descending
  const comparisonData = summaryList.map(([id, s]) => ({
    id,
    className: s.className,
    avg: parseFloat(s.avg),
    passRate: s.passRate,
    students: s.studentCount,
  })).sort((a, b) => b.avg - a.avg);

  // Find current names for display
  const currentSessionName = sessions.find((s) => s.id === selectedSession)?.name || "";
  const currentTermName = terms.find((t) => t.id === selectedTerm)?.name || "";

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */

  /* ── Initial Loading Skeleton ── */
  if (isLoading && sessions.length === 0) {
    return (
      <div className="space-y-6">
        {/* Filter skeleton */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-16" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>

        {/* Class cards skeleton */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <ClassCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Content ── */
  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════
          FILTERS
      ═══════════════════════════════════ */}
      {renderFilters()}

      {/* Session/term context bar */}
      {currentSessionName && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 border rounded-lg px-3 py-2">
          <BarChart3 className="h-3.5 w-3.5 text-primary/60" />
          <span>
            Showing analytics for <span className="font-semibold text-foreground">{currentSessionName}</span>
            {currentTermName && (
              <>
                {" · "}
                <span className="font-semibold text-foreground">{currentTermName}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* ═══════════════════════════════════
          STAT CARDS
      ═══════════════════════════════════ */}
      <StatCardsSection
        classCount={classCount}
        totalStudents={totalStudents}
        overallAvg={overallAvg}
        overallPassRate={overallPassRate}
        dataVersion={dataVersion}
        isLoading={isOverviewLoading}
      />

      {/* ═══════════════════════════════════
          CHART
      ═══════════════════════════════════ */}
      {comparisonData.length > 1 && (
        <ChartSection
          comparisonData={comparisonData}
          dataVersion={dataVersion}
        />
      )}

      {/* ═══════════════════════════════════
          CLASS CARDS
      ═══════════════════════════════════ */}
      {isOverviewLoading ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <ClassCardSkeleton key={i} />)}
          </div>
        </div>
      ) : summaryList.length === 0 ? (
        <EmptyState />
      ) : (
        <ClassCardsGrid
          summaryList={summaryList}
          dataVersion={dataVersion}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      )}

      {/* ═══════════════════════════════════
          NO COMPARISON NOTE
      ═══════════════════════════════════ */}
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

  /* ═══════════════════════════════════════
     SUB-COMPONENTS (render functions)
  ═══════════════════════════════════════ */

  function renderFilters() {
    const selectedSessionName = sessions.find((s) => s.id === selectedSession)?.name || "";
    const selectedTermName = terms.find((t) => t.id === selectedTerm)?.name || "";

    return (
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          {(selectedSessionName || selectedTermName) && (
            <div className="flex items-center gap-1.5">
              {selectedSessionName && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-800 border-blue-200">
                  {selectedSessionName}
                </Badge>
              )}
              {selectedTermName && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-purple-100 text-purple-800 border-purple-200">
                  {selectedTermName}
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <GraduationCap className="h-3 w-3" />
                Academic Session
              </label>
              <Select value={selectedSession} onValueChange={handleSessionChange}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="Select Session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="flex items-center gap-2">
                      <span>{s.name}</span>
                      {s.is_current && (
                        <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                          Current
                        </Badge>
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
                onValueChange={handleTermChange}
                disabled={!selectedSession}
              >
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder={selectedSession ? "Select Term" : "Select a session first"} />
                </SelectTrigger>
                <SelectContent>
                  {terms
                    .filter((t) => t.session_id === selectedSession)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span>{t.name}</span>
                        {t.is_current && (
                          <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                            Current
                          </Badge>
                        )}
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
}

/* ═══════════════════════════════════════════════════════
   EXTRACTED SUB-COMPONENTS
╔═════════════════════════════════════════════════════════ */

function StatCardsSection({
  classCount, totalStudents, overallAvg, overallPassRate, dataVersion, isLoading,
}: {
  classCount: number;
  totalStudents: number;
  overallAvg: string;
  overallPassRate: number;
  dataVersion: number;
  isLoading: boolean;
}) {
  const avgColor = getAvgColor(parseFloat(overallAvg));
  const passColor = getPassRateColor(overallPassRate);

  const stats = [
    { label: "Classes", value: classCount, icon: BookOpen, color: "bg-blue-100 text-blue-700", iconColor: "text-blue-600" },
    { label: "Total Students", value: totalStudents, icon: Users, color: "bg-emerald-100 text-emerald-700", iconColor: "text-emerald-600" },
    { label: "Avg Score", value: overallAvg, icon: TrendingUp, color: `bg-purple-100 ${avgColor}`, iconColor: "text-purple-600", customValueColor: avgColor },
    { label: "Avg Pass Rate", value: `${overallPassRate}%`, icon: Award, color: `bg-amber-100 ${passColor.replace("bg-", "text-").replace("-500", "-700")}`, iconColor: "text-amber-600", customValueColor: passColor.replace("bg-", "text-").replace("-500", "-700") },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, idx) => (
        <div
          key={stat.label}
          className="stat-card-enter"
          style={{
            animation: isLoading ? "none" : `statFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${STAT_ENTRY_DELAYS[idx]}ms both`,
          }}
        >
          <Card className="border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <CardContent className="p-4 flex flex-col items-center text-center gap-1.5">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.color.split(" ").slice(0, 2).join(" ")}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <p className={`text-2xl font-bold ${stat.customValueColor ?? stat.color.split(" ").slice(1).join(" ")}`}>
                  {stat.value}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

/* ── Chart ── */
function ChartSection({
  comparisonData, dataVersion,
}: {
  comparisonData: { id: string; className: string; avg: number; passRate: number; students: number }[];
  dataVersion: number;
}) {
  const router = useRouter();

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-white border rounded-xl shadow-lg px-4 py-3 text-sm space-y-1.5">
        <p className="font-semibold text-foreground">{data.className}</p>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Avg Score: <span className="font-semibold text-foreground">{data.avg.toFixed(1)}</span></p>
          <p>Pass Rate: <span className="font-semibold text-foreground">{data.passRate}%</span></p>
          <p>Students: <span className="font-semibold text-foreground">{data.students}</span></p>
        </div>
        <p className="text-[10px] text-muted-foreground pt-1 border-t">Click to view details →</p>
      </div>
    );
  };

  return (
    <Card key={`chart-${dataVersion}`} className="border-slate-200 shadow-sm chart-enter">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Class Performance Comparison
        </CardTitle>
        <CardDescription className="text-xs">
          Average scores across classes sorted by performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(220, comparisonData.length * 52)}>
          <BarChart
            data={comparisonData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 85, bottom: 5 }}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="className"
              tick={{ fontSize: 11 }}
              width={80}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9" }} />
            <Bar
              dataKey="avg"
              radius={[0, 6, 6, 0]}
              cursor="pointer"
              onClick={(data: any) => {
                const entry = comparisonData.find((d) => d.className === data.className);
                if (entry) router.push(`/admin/subject-classes/${entry.id}/analytics`);
              }}
            >
              {comparisonData.map((entry, idx) => {
                const avg = parseFloat(entry.avg.toFixed(1));
                // Color based on performance threshold
                let fill = CHART_COLORS[idx % CHART_COLORS.length];
                if (avg >= 70) fill = "#10b981";
                else if (avg >= 40) fill = "#f59e0b";
                else fill = "#ef4444";
                return <Cell key={idx} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/* ── Empty State ── */
function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1">No class data available</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Make sure classes are assigned in the Classes tab and results have been entered for the selected session/term
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Class Cards Grid ── */
function ClassCardsGrid({
  summaryList, dataVersion, sortBy, onSortChange,
}: {
  summaryList: [string, ClassSummary][];
  dataVersion: number;
  sortBy: "avg" | "passRate" | "alpha";
  onSortChange: (value: "avg" | "passRate" | "alpha") => void;
}) {
  const classCount = summaryList.length;

  // Sort based on the selected criteria
  const sorted = [...summaryList].sort(([, a], [, b]) => {
    if (sortBy === "avg") return parseFloat(b.avg) - parseFloat(a.avg);
    if (sortBy === "passRate") return b.passRate - a.passRate;
    return a.className.localeCompare(b.className);
  });

  // Sort options config
  const sortOptions: { value: typeof sortBy; label: string; description: string }[] = [
    { value: "avg", label: "Avg", description: "Sort by average score" },
    { value: "passRate", label: "Pass %", description: "Sort by pass rate" },
    { value: "alpha", label: "A–Z", description: "Sort alphabetically" },
  ];

  return (
    <div key={`classes-${dataVersion}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <SortAsc className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">
            Classes Teaching This Subject
          </h3>
          <Badge variant="secondary" className="text-xs ml-1">
            {classCount} class{classCount !== 1 ? "es" : ""}
          </Badge>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-1.5 bg-muted/30 border rounded-lg p-0.5 w-fit">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={opt.description}
              onClick={() => onSortChange(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                sortBy === opt.value
                  ? "bg-white text-foreground shadow-sm border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map(([id, summary], idx) => (
          <ClassCard key={id} id={id} summary={summary} rank={idx + 1} total={classCount} />
        ))}
      </div>
    </div>
  );
}

/* ── Single Class Card ── */
function ClassCard({ id, summary, rank, total }: {
  id: string;
  summary: ClassSummary;
  rank: number;
  total: number;
}) {
  const avgNum = parseFloat(summary.avg);
  const avgColor = getAvgColor(avgNum);
  const passRateColor = getPassRateColor(summary.passRate);

  // Rank badge color
  const rankColors = [
    "bg-amber-100 text-amber-800 border-amber-300",
    "bg-slate-100 text-slate-700 border-slate-300",
    "bg-orange-100 text-orange-800 border-orange-300",
  ];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : "bg-muted text-muted-foreground border-muted-foreground/30";

  return (
    <div className="class-card-enter">
      <Link
        href={`/admin/subject-classes/${id}/analytics`}
        className="block w-full rounded-xl border bg-card hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 transition-all duration-200 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/[0.04] to-primary/[0.08] px-4 py-3 border-b relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="h-9 w-9 rounded-lg bg-primary/[0.08] flex items-center justify-center shrink-0 group-hover:bg-primary/[0.14] transition-colors">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                {/* Rank badge */}
                <div className={`absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border flex items-center justify-center text-[9px] font-bold ${rankColor}`}>
                  {rank}
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">{summary.className}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {summary.subjectCode && (
                    <span className="text-[10px] font-mono text-muted-foreground">{summary.subjectCode}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
              <span>Open</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          </div>

          {/* Rank indicator bar */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted/50">
            <div
              className="h-full bg-primary/30 transition-all duration-500"
              style={{ width: `${((total - rank + 1) / total) * 100}%` }}
            />
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
          <div className="grid grid-cols-4 gap-1 text-center">
            <div>
              <p className="text-base font-bold">{summary.studentCount}</p>
              <p className="text-[10px] text-muted-foreground">Students</p>
            </div>
            <div>
              <p className={`text-base font-bold ${avgColor}`}>{summary.avg}</p>
              <p className="text-[10px] text-muted-foreground">Avg</p>
            </div>
            <div>
              <p className={`text-base font-bold ${avgNum >= 70 ? "text-emerald-600" : avgNum >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {summary.highest}
              </p>
              <p className="text-[10px] text-muted-foreground">Highest</p>
            </div>
            <div>
              <p className={`text-base font-bold ${avgNum >= 70 ? "text-emerald-600" : avgNum >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {summary.lowest}
              </p>
              <p className="text-[10px] text-muted-foreground">Lowest</p>
            </div>
          </div>

          {/* Pass rate bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Pass rate</span>
              <span className={`font-semibold ${avgNum >= 70 ? "text-emerald-600" : avgNum >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {summary.passRate}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${passRateColor}`}
                style={{ width: `${summary.passRate}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GLOBAL STYLES (injected in layout or via CSS-in-JS)
   ── Since we can't use Framer Motion, we use CSS
      animations via <style> tag.
╔═════════════════════════════════════════════════════════ */

// We inject keyframes once — use a module-level flag
let stylesInjected = false;

if (typeof document !== "undefined" && !stylesInjected) {
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes statFadeIn {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .stat-card-enter { animation-fill-mode: both; }

    .chart-enter {
      animation: chartSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes chartSlideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .class-card-enter {
      animation: cardFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes cardFadeIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .stat-card-enter,
      .chart-enter,
      .class-card-enter {
        animation: none !important;
        opacity: 1 !important;
      }
      .group:hover {
        transform: none !important;
      }
      [class*="hover:-translate"]:hover {
        transform: none !important;
      }
      * {
        transition-duration: 0ms !important;
        animation-duration: 0ms !important;
      }
    }
  `;
  document.head.appendChild(style);
}
