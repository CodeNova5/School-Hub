"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from "recharts";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  BookOpen,
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

interface ResultComponent {
  component_key: string;
  component_name: string;
  max_score: number;
  display_order: number;
}



interface EnrichedResult {
  id: string;
  student_id: string;
  grade: string;
  total: number;
  session_id: string;
  term_id: string;
  students: {
    first_name: string;
    last_name: string;
    student_id: string;
    gender: string;
    photo_url?: string;
  };
}

const GRADE_COLORS: Record<string, string> = {
  A1: "#16a34a",
  B2: "#4ade80",
  B3: "#86efac",
  C4: "#fef08a",
  C5: "#fde047",
  C6: "#facc15",
  D7: "#f97316",
  E8: "#fb923c",
  F9: "#ef4444",
};

const GRADE_ORDER = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"];

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export function SubjectAnalyticsTab({ subjectId, schoolId, subjectName }: SubjectAnalyticsTabProps) {
  /* ── Data States ── */
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  const [results, setResults] = useState<EnrichedResult[]>([]);
  const [resultComponents, setResultComponents] = useState<ResultComponent[]>([]);
  const [studentBreakdown, setStudentBreakdown] = useState<any[]>([]);
  const [termTrend, setTermTrend] = useState<{ term: string; avg: string; count: number }[]>([]);
  const [sessionTrend, setSessionTrend] = useState<{ session: string; avg: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /* ── Filter States ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState(0);

  /* ── Load initial data ── */
  useEffect(() => {
    if (schoolId) loadInitial();
  }, [schoolId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInitial() {
    if (!schoolId) return;
    setIsLoading(true);

    try {
      // Load sessions and terms
      const [sessionRes, termRes, componentsRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("school_id", schoolId).order("name"),
        supabase.from("terms").select("*").eq("school_id", schoolId).order("name"),
        supabase
          .from("result_component_templates")
          .select("component_key, component_name, max_score, display_order")
          .eq("school_id", schoolId)
          .eq("is_active", true)
          .order("display_order", { ascending: true }),
      ]);

      const sessionData = (sessionRes.data ?? []) as Session[];
      const termData = (termRes.data ?? []) as Term[];
      const compData = (componentsRes.data ?? []) as ResultComponent[];

      setSessions(sessionData);
      setTerms(termData);
      setResultComponents(compData);

      // Set defaults
      const currentSession = sessionData.find((s) => s.is_current);
      const currentTerm = termData.find((t) => t.is_current);
      setSelectedSession(currentSession?.id || sessionData[0]?.id || "");
      setSelectedTerm(currentTerm?.id || termData[0]?.id || "");

      // Load results if we have sessions/terms selected
      if (currentSession?.id) {
        await loadTermTrend(currentSession.id);
        await loadSessionTrend();
        await loadResults(currentSession.id, currentTerm?.id);
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error loading analytics:", err);
      setIsLoading(false);
    }
  }

  /* ── Load term trend data (avg scores across all terms in a session) ── */
  async function loadTermTrend(sessionId?: string) {
    if (!schoolId || !sessionId) return;

    try {
      // Get all subject_class ids for this subject
      const { data: scData } = await supabase
        .from("subject_classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("subject_id", subjectId);

      const scIds = (scData ?? []).map((sc: any) => sc.id);
      if (scIds.length === 0) { setTermTrend([]); return; }

      // Fetch results by term for this session
      const { data: trendResults } = await supabase
        .from("results")
        .select(`id, term_id, terms!inner(name)`)
        .eq("school_id", schoolId)
        .eq("session_id", sessionId)
        .in("subject_class_id", scIds);

      if (!trendResults || trendResults.length === 0) {
        setTermTrend([]);
        return;
      }

      // Get totals from component scores
      const trendResultIds = trendResults.map((r: any) => r.id);
      const { data: trendScores } = await supabase
        .from("result_component_scores")
        .select("result_id, score")
        .in("result_id", trendResultIds)
        .eq("school_id", schoolId);

      const totalsMap = new Map<string, number>();
      (trendScores || []).forEach((cs: any) => {
        const current = totalsMap.get(cs.result_id) || 0;
        totalsMap.set(cs.result_id, current + cs.score);
      });

      // Group by term
      const grouped: Record<string, { name: string; scores: number[] }> = {};
      trendResults.forEach((r: any) => {
        const termName = r.terms?.name || `Term ${r.term_id.slice(0, 4)}`;
        if (!grouped[r.term_id]) {
          grouped[r.term_id] = { name: termName, scores: [] };
        }
        grouped[r.term_id].scores.push(totalsMap.get(r.id) || 0);
      });

      const trend = Object.values(grouped).map((g) => ({
        term: g.name,
        avg: g.scores.length > 0
          ? (g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(1)
          : "0.0",
        count: g.scores.length,
      }));

      setTermTrend(trend);
    } catch (err) {
      console.error("Error loading term trend:", err);
      setTermTrend([]);
    }
  }

  /* ── Load session trend data (avg scores across sessions) ── */
  async function loadSessionTrend() {
    if (!schoolId) return;

    try {
      const { data: scData } = await supabase
        .from("subject_classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("subject_id", subjectId);

      const scIds = (scData ?? []).map((sc: any) => sc.id);
      if (scIds.length === 0) { setSessionTrend([]); return; }

      const { data: sessionResults } = await supabase
        .from("results")
        .select(`id, session_id, sessions!inner(name)`)
        .eq("school_id", schoolId)
        .in("subject_class_id", scIds);

      if (!sessionResults || sessionResults.length === 0) {
        setSessionTrend([]);
        return;
      }

      const sessionResultIds = sessionResults.map((r: any) => r.id);
      const { data: sessionScores } = await supabase
        .from("result_component_scores")
        .select("result_id, score")
        .in("result_id", sessionResultIds)
        .eq("school_id", schoolId);

      const totalsMap = new Map<string, number>();
      (sessionScores || []).forEach((cs: any) => {
        const current = totalsMap.get(cs.result_id) || 0;
        totalsMap.set(cs.result_id, current + cs.score);
      });

      const grouped: Record<string, { name: string; scores: number[] }> = {};
      sessionResults.forEach((r: any) => {
        const sessionName = r.sessions?.name || `Session ${r.session_id.slice(0, 4)}`;
        if (!grouped[r.session_id]) {
          grouped[r.session_id] = { name: sessionName, scores: [] };
        }
        grouped[r.session_id].scores.push(totalsMap.get(r.id) || 0);
      });

      const trend = Object.values(grouped).map((g) => ({
        session: g.name,
        avg: g.scores.length > 0
          ? (g.scores.reduce((a, b) => a + b, 0) / g.scores.length).toFixed(1)
          : "0.0",
      }));

      setSessionTrend(trend);
    } catch (err) {
      console.error("Error loading session trend:", err);
      setSessionTrend([]);
    }
  }

  async function loadResults(sessionId?: string, termId?: string) {
    if (!schoolId) return;
    setIsLoading(true);

    try {
      // Get all subject_class ids for this subject
      let scQuery = supabase
        .from("subject_classes")
        .select("id")
        .eq("school_id", schoolId)
        .eq("subject_id", subjectId);

      const { data: scData } = await scQuery;
      const scIds = (scData ?? []).map((sc: any) => sc.id);

      if (scIds.length === 0) {
        setResults([]);
        setStudentBreakdown([]);
        setIsLoading(false);
        return;
      }

      // Fetch results across all subject_classes
      let query: any = supabase
        .from("results")
        .select(`id, grade, student_id, session_id, term_id, subject_class_id, students(first_name, last_name, student_id, gender, photo_url)`)
        .eq("school_id", schoolId)
        .in("subject_class_id", scIds);

      if (sessionId) query = query.eq("session_id", sessionId);
      if (termId) query = query.eq("term_id", termId);

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        setResults([]);
        setStudentBreakdown([]);
        setIsLoading(false);
        return;
      }

      // Get all result IDs to fetch component scores
      const resultIds = data.map((r: any) => r.id);
      const { data: componentScores } = await supabase
        .from("result_component_scores")
        .select("result_id, component_key, score")
        .in("result_id", resultIds)
        .eq("school_id", schoolId);

      // Calculate totals from component scores
      const totalsMap = new Map<string, number>();
      const scoresByResult = new Map<string, Map<string, number>>();
      (componentScores || []).forEach((cs: any) => {
        const current = totalsMap.get(cs.result_id) || 0;
        totalsMap.set(cs.result_id, current + cs.score);
        if (!scoresByResult.has(cs.result_id)) {
          scoresByResult.set(cs.result_id, new Map());
        }
        scoresByResult.get(cs.result_id)!.set(cs.component_key, cs.score);
      });

      const enriched = (data as any[]).map((r) => ({
        ...r,
        total: totalsMap.get(r.id) || 0,
      })) as EnrichedResult[];

      setResults(enriched);

      // Build student breakdown with component scores
      const sorted = enriched
        .map((r) => {
          const componentMap = scoresByResult.get(r.id) || new Map();
          const componentScoresObj: Record<string, number> = {};
          let totalScore = 0;

          resultComponents.forEach((comp) => {
            const score = componentMap.get(comp.component_key) || 0;
            componentScoresObj[comp.component_key] = score;
            totalScore += score;
          });

          return {
            id: r.id,
            name: `${r.students.first_name} ${r.students.last_name}`,
            student_id: r.students.student_id,
            photo_url: r.students.photo_url,
            gender: r.students.gender,
            subject_class_id: (r as any).subject_class_id,
            ...componentScoresObj,
            total: totalScore,
            grade: r.grade || "N/A",
          };
        })
        .sort((a, b) => b.total - a.total);

      setStudentBreakdown(sorted);
    } catch (err) {
      console.error("Error loading results:", err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSessionChange(val: string) {
    setSelectedSession(val);
    setSelectedTerm("");
    loadTermTrend(val);
    loadResults(val);
  }

  function handleTermChange(val: string) {
    setSelectedTerm(val);
    loadResults(selectedSession, val);
  }

  /* ── Derived Metrics ── */
  const metrics = useMemo(() => {
    const avg =
      results.length > 0
        ? (results.reduce((a, b) => a + b.total, 0) / results.length).toFixed(1)
        : "0.0";
    const highest = results.length > 0 ? Math.max(...results.map((r) => r.total)) : 0;
    const lowest = results.length > 0 ? Math.min(...results.map((r) => r.total)) : 0;
    const passCount = results.filter((r) => !["D7", "E8", "F9"].includes(r.grade)).length;
    const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

    return { avg, highest, lowest, passCount, passRate };
  }, [results]);

  const gradeDistribution = useMemo(
    () =>
      GRADE_ORDER.map((g) => ({
        grade: g,
        count: results.filter((r) => r.grade === g).length,
      })),
    [results]
  );

  const genderComparison = useMemo(() => {
    const males = results.filter((r) => r.students?.gender?.toLowerCase() === "male");
    const females = results.filter((r) => r.students?.gender?.toLowerCase() === "female");
    return [
      {
        gender: "Male",
        avg: males.length
          ? (males.reduce((a, b) => a + b.total, 0) / males.length).toFixed(1)
          : "0.0",
        count: males.length,
      },
      {
        gender: "Female",
        avg: females.length
          ? (females.reduce((a, b) => a + b.total, 0) / females.length).toFixed(1)
          : "0.0",
        count: females.length,
      },
    ];
  }, [results]);

  const componentAverages = useMemo(
    () =>
      resultComponents.map((comp) => {
        const total = studentBreakdown.reduce(
          (sum: number, s: any) => sum + (s[comp.component_key] || 0),
          0
        );
        return {
          name: comp.component_name,
          avg: studentBreakdown.length > 0 ? (total / studentBreakdown.length).toFixed(1) : "0.0",
          max: comp.max_score,
        };
      }),
    [resultComponents, studentBreakdown]
  );

  const strugglingStudents = useMemo(
    () =>
      studentBreakdown.filter(
        (s) => s.total < 50 || ["D7", "E8", "F9"].includes(s.grade)
      ),
    [studentBreakdown]
  );

  /* ── Render ── */
  if (isLoading && results.length === 0) {
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
      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Users className="h-5 w-5 mb-1.5 text-blue-600" />
            <p className="text-2xl font-bold text-blue-700">{results.length}</p>
            <p className="text-xs text-muted-foreground">Students</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingUp className="h-5 w-5 mb-1.5 text-emerald-600" />
            <p className="text-2xl font-bold text-emerald-700">{metrics.avg}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <Award className="h-5 w-5 mb-1.5 text-purple-600" />
            <p className="text-2xl font-bold text-purple-700">{metrics.highest}</p>
            <p className="text-xs text-muted-foreground">Highest</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col items-center text-center">
            <TrendingDown className="h-5 w-5 mb-1.5 text-red-600" />
            <p className="text-2xl font-bold text-red-700">{metrics.lowest}</p>
            <p className="text-xs text-muted-foreground">Lowest</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Pass Rate Bar ── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold">Pass Rate</p>
              <p className="text-xs text-muted-foreground">
                {metrics.passCount} of {results.length} students passed
              </p>
            </div>
            <span
              className={`text-2xl font-bold ${
                metrics.passRate >= 70
                  ? "text-emerald-600"
                  : metrics.passRate >= 40
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {metrics.passRate}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.passRate >= 70
                  ? "bg-emerald-500"
                  : metrics.passRate >= 40
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${metrics.passRate}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Student Performance Breakdown ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Student Performance Breakdown</CardTitle>
          <CardDescription className="text-xs">
            Ordered by total score — highest to lowest
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search/Filter Controls */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                className="pl-9 h-9 text-sm rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
            <select
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
              value={scoreFilter}
              onChange={(e) => setScoreFilter(Number(e.target.value))}
            >
              <option value={0}>All Scores</option>
              <option value={40}>40+ (Pass)</option>
              <option value={70}>70+ (Top)</option>
              <option value={85}>85+ (Excellent)</option>
            </select>
          </div>

          {studentBreakdown.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
              <p className="text-sm text-muted-foreground">No results found for the selected filters</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-xs text-muted-foreground font-medium">
                      <th className="p-3 text-left">#</th>
                      <th className="p-3 text-left">Student</th>
                      {resultComponents.map((comp) => (
                        <th key={comp.component_key} className="p-3 text-left whitespace-nowrap">
                          {comp.component_name}
                        </th>
                      ))}
                      <th className="p-3 text-left">Total</th>
                      <th className="p-3 text-left">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {studentBreakdown
                      .filter(
                        (s) =>
                          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.student_id.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .filter((s) => (genderFilter === "all" ? true : s.gender?.toLowerCase() === genderFilter))
                      .filter((s) => s.total >= scoreFilter)
                      .map((s, index) => (
                        <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 text-muted-foreground">{index + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={s.photo_url || ""} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {s.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">{s.name}</p>
                                <p className="text-[10px] text-muted-foreground">{s.student_id}</p>
                              </div>
                            </div>
                          </td>
                          {resultComponents.map((comp) => (
                            <td key={comp.component_key} className="p-3 text-sm">
                              {s[comp.component_key] || 0}
                            </td>
                          ))}
                          <td className="p-3 font-semibold">{s.total}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={`font-mono text-xs ${
                                ["A1", "B2", "B3"].includes(s.grade)
                                  ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                  : ["C4", "C5", "C6"].includes(s.grade)
                                  ? "border-amber-300 text-amber-700 bg-amber-50"
                                  : "border-red-300 text-red-700 bg-red-50"
                              }`}
                            >
                              {s.grade}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {studentBreakdown.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-t bg-muted/20">
                  Showing all {studentBreakdown.length} students. Use search/filters to narrow down.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Term Trend Chart (full width) ── */}
      {termTrend.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Score Trend Across Terms
            </CardTitle>
            <CardDescription className="text-xs">
              Average score progression across terms in the selected session
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={termTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="term"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  formatter={(value: string, name: string) => [value, name === "avg" ? "Avg Score" : value]}
                  labelFormatter={(label: string) => `Term: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
            {/* Data point labels */}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {termTrend.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/10 text-xs"
                >
                  <span className="font-medium text-muted-foreground">{t.term}:</span>
                  <span className="font-bold text-purple-700">{t.avg}</span>
                  <span className="text-muted-foreground">({t.count} students)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Session Trend Chart (full width) ── */}
      {sessionTrend.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Score Trend Across Sessions
            </CardTitle>
            <CardDescription className="text-xs">
              Average score progression across all academic sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sessionTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="session"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  formatter={(value: string) => [value, "Avg Score"]}
                  labelFormatter={(label: string) => `Session: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 7, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {sessionTrend.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/10 text-xs"
                >
                  <span className="font-medium text-muted-foreground">{t.session}:</span>
                  <span className="font-bold text-blue-700">{t.avg}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={gradeDistribution}>
                  <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    formatter={(value: number) => [value, "Students"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {gradeDistribution.map((entry, index) => (
                      <Cell key={index} fill={GRADE_COLORS[entry.grade]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              {GRADE_ORDER.map((g) => (
                <div key={g} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: GRADE_COLORS[g] }}
                  />
                  <span className="text-muted-foreground">{g}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gender Comparison */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Male vs Female Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={genderComparison}>
                  <XAxis dataKey="gender" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    formatter={(value: string) => [value, "Avg Score"]}
                  />
                  <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#ec4899" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                Male ({genderComparison[0]?.count || 0})
              </span>
              <span className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded-sm bg-pink-500" />
                Female ({genderComparison[1]?.count || 0})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Component Breakdown */}
        {componentAverages.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Assessment Component Averages</CardTitle>
              <CardDescription className="text-xs">
                Average scores across all assessment components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={componentAverages}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    formatter={(value: string) => [value, "Avg Score"]}
                  />
                  <Bar dataKey="avg" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Students Needing Attention ── */}
      <Card className="border-red-200">
        <CardHeader className="pb-3 bg-red-50/50 border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <CardTitle className="text-sm font-semibold text-red-900">
              Students Needing Attention ({strugglingStudents.length})
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-red-700">
            Students scoring below 50 or failing (D7, E8, F9)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {strugglingStudents.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No struggling students found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground bg-red-50/30">
                    <th className="p-3 text-left">Student</th>
                    <th className="p-3 text-left">Score</th>
                    <th className="p-3 text-left">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {strugglingStudents
                    .sort((a, b) => a.total - b.total)
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-red-50/20 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={s.photo_url || ""} />
                              <AvatarFallback className="text-[10px] bg-red-100 text-red-700">
                                {s.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{s.name}</p>
                              <p className="text-[10px] text-muted-foreground">{s.student_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-red-700">{s.total}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className="border-red-300 text-red-700 bg-red-50 font-mono text-xs"
                          >
                            {s.grade}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
