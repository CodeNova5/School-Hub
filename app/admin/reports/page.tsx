"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Eye,
  MoreVertical,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Calculator,
  GraduationCap,
  BookOpen,
  Users,
  School,
  Loader2,
  AlertCircle,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { Session, Term, Student, Class } from "@/lib/types";
import { ResultsPublicationDialog } from "@/components/ResultsPublicationDialog";

/* ── Types ── */

interface SubjectCompletion {
  subject_class_id: string;
  subject_name: string;
  total_students: number;
  completed_count: number;
  pending_count: number;
  completion_percentage: number;
  has_any_results: boolean;
}

interface StudentResult {
  student_id: string;
  student_name: string;
  student_number: string;
  gender: string;
  total_subjects: number;
  total_score: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  grade: {
    A1: number;
    B2: number;
    B3: number;
    C4: number;
    C5: number;
    C6: number;
    D7: number;
    E8: number;
    F9: number;
  };
  average_grade: string;
  class_position: number | null;
  has_results: boolean;
  subjects_complete: number;
  is_complete: boolean;
  completion_percentage: number;
}

interface CumulativeResult {
  student_id: string;
  student_name: string;
  student_number: string;
  gender: string;
  terms_with_results: number;
  term_averages: { term_name: string; average: number }[];
  cumulative_average: number;
  cumulative_grade: string;
  cumulative_position: number | null;
  is_complete: boolean;
}

/* ── Helpers ── */

function calculateAverageGrade(averageScore: number): string {
  if (averageScore >= 75) return "A1";
  if (averageScore >= 70) return "B2";
  if (averageScore >= 65) return "B3";
  if (averageScore >= 60) return "C4";
  if (averageScore >= 55) return "C5";
  if (averageScore >= 50) return "C6";
  if (averageScore >= 45) return "D7";
  if (averageScore >= 40) return "E8";
  return "F9";
}

function getGradeColor(grade: string) {
  const prefix = grade.charAt(0).toUpperCase();
  switch (prefix) {
    case "A": return "bg-green-100 text-green-800 border-green-200";
    case "B": return "bg-blue-100 text-blue-800 border-blue-200";
    case "C": return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "D":
    case "E": return "bg-orange-100 text-orange-800 border-orange-200";
    default: return "bg-red-100 text-red-800 border-red-200";
  }
}

function getPerformanceIndicator(average: number) {
  if (average >= 70) return { icon: TrendingUp, color: "text-green-600", label: "Excellent" };
  if (average >= 60) return { icon: TrendingUp, color: "text-blue-600", label: "Good" };
  if (average >= 50) return { icon: Minus, color: "text-yellow-600", label: "Average" };
  return { icon: TrendingDown, color: "text-red-600", label: "Needs Improvement" };
}

function getPositionDisplay(position: number | null | undefined) {
  if (!position) return null;
  if (position === 1) return <span className="font-bold text-yellow-600">1st 🥇</span>;
  if (position === 2) return <span className="font-bold text-gray-600">2nd 🥈</span>;
  if (position === 3) return <span className="font-bold text-amber-700">3rd 🥉</span>;
  return <span className="font-semibold text-gray-700">{position}th</span>;
}

/* ── Stat Card ── */

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${color.replace("text-", "bg-").replace("-600", "-50").replace("-700", "-50")}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function AdminReportsPage() {
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();

  // Data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  // Filters
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedTermId, setSelectedTermId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [performanceFilter, setPerformanceFilter] = useState<"all" | "excellent" | "good" | "average" | "poor">("all");
  const [completionFilter, setCompletionFilter] = useState<"all" | "complete" | "incomplete" | "no_results">("all");

  // Results
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [cumulativeResults, setCumulativeResults] = useState<CumulativeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);
  const [isLastTerm, setIsLastTerm] = useState(false);
  const [showPositionSetting, setShowPositionSetting] = useState(true);
  const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);
  const [subjectCompletion, setSubjectCompletion] = useState<SubjectCompletion[]>([]);

  // ── Load initial data ──

  useEffect(() => {
    if (!schoolId) return;
    loadMetadata();
  }, [schoolId]);

  async function loadMetadata() {
    try {
      const [sessionsRes, termsRes, classesRes] = await Promise.all([
        supabase.from("sessions").select("*").eq("school_id", schoolId).order("name", { ascending: false }),
        supabase.from("terms").select("*").eq("school_id", schoolId).order("start_date", { ascending: false }),
        supabase.from("classes").select("*").eq("school_id", schoolId).order("name", { ascending: true }),
      ]);

      setSessions(sessionsRes.data || []);
      setTerms(termsRes.data || []);
      setClasses(classesRes.data || []);

      // Auto-select current session and term
      const currentSession = sessionsRes.data?.find((s: any) => s.is_current);
      const currentTerm = termsRes.data?.find((t: any) => t.is_current);
      if (currentSession) setSelectedSessionId(currentSession.id);
      if (currentTerm) setSelectedTermId(currentTerm.id);
    } catch (err) {
      console.error("Error loading metadata:", err);
    }
  }

  // When session changes, auto-select a valid term
  useEffect(() => {
    if (selectedSessionId) {
      const sessionTerms = terms.filter(t => t.session_id === selectedSessionId);
      if (sessionTerms.length > 0) {
        const currentTerm = sessionTerms.find(t => t.is_current);
        setSelectedTermId(currentTerm?.id || sessionTerms[0].id);
      } else {
        setSelectedTermId("");
      }
    }
  }, [selectedSessionId, terms]);

  // ── Fetch students when class or session changes ──
  // Uses class_history to resolve which students were in the selected class
  // during the selected session (for historical accuracy)

  useEffect(() => {
    if (schoolId && selectedClassId) {
      loadStudents();
    }
  }, [schoolId, selectedClassId, selectedSessionId]);

  async function loadStudents() {
    if (!schoolId || !selectedClassId) return;
    try {
      let studentIds: string[] | null = null;

      // If a session is selected, first try to find students via class_history
      if (selectedSessionId) {
        const { data: historyRows } = await supabase
          .from("class_history")
          .select("student_id")
          .eq("school_id", schoolId)
          .eq("class_id", selectedClassId)
          .eq("session_id", selectedSessionId);

        if (historyRows && historyRows.length > 0) {
          studentIds = historyRows.map((r: { student_id: string }) => r.student_id);
        }
      }

      let query = supabase
        .from("students")
        .select("*")
        .eq("school_id", schoolId);

      if (studentIds) {
        // Found students via class_history — fetch their details by IDs
        query = query.in("id", studentIds);
      } else {
        // Fallback: use current class_id (legacy data without class_history)
        query = query.eq("class_id", selectedClassId);
      }

      const { data } = await query.order("first_name", { ascending: true });

      setStudents(data || []);
    } catch (err) {
      console.error("Error loading students:", err);
    }
  }

  // ── Fetch results when session, term, and class are selected ──

  useEffect(() => {
    if (selectedSessionId && selectedTermId && selectedClassId) {
      fetchResults();

      const sessionTerms = terms
        .filter(t => t.session_id === selectedSessionId)
        .sort((a, b) => a.name.localeCompare(b.name));
      const lastTerm = sessionTerms[sessionTerms.length - 1];
      setIsLastTerm(lastTerm?.id === selectedTermId);

      if (lastTerm?.id === selectedTermId && sessionTerms.length > 0) {
        fetchCumulativeResults();
      }
    }
  }, [selectedSessionId, selectedTermId, selectedClassId, students]);

  async function getSubjectClassIds(): Promise<string[]> {
    const { data } = await supabase
      .from("subject_classes")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", selectedClassId);
    return data?.map((sc: any) => sc.id) || [];
  }

  async function fetchResults() {
    if (!schoolId || !selectedSessionId || !selectedTermId || !selectedClassId) return;
    setLoading(true);

    try {
      const currentStudentIds = students.map(s => s.id);
      if (currentStudentIds.length === 0) {
        setStudentResults([]);
        setSubjectCompletion([]);
        setLoading(false);
        return;
      }

      const subjectClassIds = await getSubjectClassIds();
      if (subjectClassIds.length === 0) {
        setStudentResults([]);
        setSubjectCompletion([]);
        setLoading(false);
        return;
      }

      // Also fetch subject names for subject classes
      const { data: subjectClassesData } = await supabase
        .from("subject_classes")
        .select(`
          id,
          subjects:subject_id(name)
        `)
        .eq("school_id", schoolId)
        .in("id", subjectClassIds);

      const subjectNameMap = new Map<string, string>();
      (subjectClassesData || []).forEach((sc: any) => {
        subjectNameMap.set(sc.id, sc.subjects?.name || "Unknown");
      });

      const [{ data: resultsData }, { data: componentTemplates }, { data: settingsRow }] = await Promise.all([
        supabase
          .from("results")
          .select("*")
          .eq("school_id", schoolId)
          .eq("term_id", selectedTermId)
          .eq("session_id", selectedSessionId)
          .in("student_id", currentStudentIds)
          .in("subject_class_id", subjectClassIds),
        supabase
          .from("result_component_templates")
          .select("component_key, is_active")
          .eq("school_id", schoolId)
          .eq("is_active", true),
        supabase
          .from("result_school_settings")
          .select("show_position")
          .eq("school_id", schoolId)
          .maybeSingle(),
      ]);

      setShowPositionSetting(settingsRow?.show_position !== false);
      const activeComponentKeys: string[] = (componentTemplates || []).map((c: any) => c.component_key);

      // Fetch component scores
      const resultIds = (resultsData || []).map((r: any) => r.id).filter(Boolean);
      let componentScoresByResultId = new Map<string, Set<string>>();

      if (resultIds.length > 0) {
        const { data: compScores } = await supabase
          .from("result_component_scores")
          .select("result_id, component_key, score")
          .eq("school_id", schoolId)
          .in("result_id", resultIds);

        (compScores || []).forEach((cs: any) => {
          if (!componentScoresByResultId.has(cs.result_id)) {
            componentScoresByResultId.set(cs.result_id, new Set());
          }
          if (Number(cs.score) > 0) {
            componentScoresByResultId.get(cs.result_id)!.add(cs.component_key);
          }
        });
      }

      function isResultComplete(resultId: string): boolean {
        if (activeComponentKeys.length === 0) return false;
        const filledComponents = componentScoresByResultId.get(resultId);
        if (!filledComponents) return false;
        return activeComponentKeys.every(key => filledComponents.has(key));
      }

      // Build results map
      const resultsMap = new Map<string, StudentResult>();
      students.forEach(s => {
        resultsMap.set(s.id, {
          student_id: s.id,
          student_name: `${s.first_name} ${s.last_name}`,
          student_number: s.student_id,
          gender: s.gender,
          total_subjects: 0,
          total_score: 0,
          average_score: 0,
          highest_score: 0,
          lowest_score: 100,
          grade: { A1: 0, B2: 0, B3: 0, C4: 0, C5: 0, C6: 0, D7: 0, E8: 0, F9: 0 },
          average_grade: "",
          class_position: null,
          has_results: false,
          subjects_complete: 0,
          is_complete: false,
          completion_percentage: 0,
        });
      });

      (resultsData || []).forEach((result: any) => {
        const sr = resultsMap.get(result.student_id);
        if (!sr) return;

        sr.has_results = true;
        sr.total_subjects += 1;
        sr.total_score += result.total || 0;

        if (result.total > sr.highest_score) sr.highest_score = result.total;
        if (result.total < sr.lowest_score && result.total > 0) sr.lowest_score = result.total;

        const grade = result.grade?.toUpperCase();
        if (grade && grade in sr.grade) {
          sr.grade[grade as keyof typeof sr.grade] += 1;
        }

        if (result.class_position && !sr.class_position) {
          sr.class_position = result.class_position;
        }

        if (isResultComplete(result.id)) {
          sr.subjects_complete += 1;
        }
      });

      // ── Fetch stored summaries from DB (source of truth) ──
      const { data: summaries } = await supabase
        .from("student_term_summaries")
        .select("*")
        .eq("school_id", schoolId)
        .eq("session_id", selectedSessionId)
        .eq("term_id", selectedTermId)
        .in("student_id", currentStudentIds);

      const summaryMap = new Map<string, any>();
      (summaries || []).forEach((s: any) => summaryMap.set(s.student_id, s));

      const totalSubjectCount = subjectClassIds.length;
      const results = Array.from(resultsMap.values()).map(r => {
        const stored = summaryMap.get(r.student_id);
        if (stored && r.has_results) {
          // Use stored summary as source of truth
          r.average_score = stored.average_score;
          r.average_grade = calculateAverageGrade(stored.average_score);
          r.completion_percentage = stored.completion_percentage;
          r.is_complete = stored.is_complete;
        } else if (r.total_subjects > 0) {
          // Fallback: compute manually (legacy data without stored summaries)
          r.average_score = r.total_score / totalSubjectCount;
          r.average_grade = calculateAverageGrade(r.average_score);
          r.completion_percentage = Math.round((r.subjects_complete / totalSubjectCount) * 100);
          r.is_complete = r.subjects_complete === totalSubjectCount;
        }
        if (!r.has_results) r.lowest_score = 0;
        return r;
      }).sort((a, b) => b.average_score - a.average_score);

      setStudentResults(results);

      // ── Compute per-subject completion ──
      const subjectCompletionMap = new Map<string, {
        total: number;
        completed: number;
        hasResults: boolean;
      }>();

      subjectClassIds.forEach(scId => {
        subjectCompletionMap.set(scId, { total: 0, completed: 0, hasResults: false });
      });

      resultsData?.forEach((result: any) => {
        const scId = result.subject_class_id;
        const entry = subjectCompletionMap.get(scId);
        if (!entry) return;
        entry.total++;
        entry.hasResults = true;
        if (isResultComplete(result.id)) {
          entry.completed++;
        }
      });

      const totalStudentCount = students.length;
      const subjectCompletionArray: SubjectCompletion[] = Array.from(subjectCompletionMap.entries())
        .map(([scId, data]) => {
          // Students without results for this subject are "pending"
          const noResultCount = totalStudentCount - data.total;
          const pending = (data.total - data.completed) + noResultCount;
          return {
            subject_class_id: scId,
            subject_name: subjectNameMap.get(scId) || "Unknown",
            total_students: totalStudentCount,
            completed_count: data.completed,
            pending_count: pending,
            completion_percentage: totalStudentCount > 0
              ? Math.round((data.completed / totalStudentCount) * 100)
              : 0,
            has_any_results: data.hasResults,
          };
        })
        .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

      setSubjectCompletion(subjectCompletionArray);
    } catch (err) {
      console.error("Error fetching results:", err);
      toast.error("Failed to load results");
    } finally {
      setLoading(false);
    }
  }

  async function fetchCumulativeResults() {
    if (!schoolId || !selectedSessionId || !selectedClassId) return;

    try {
      const currentStudentIds = students.map(s => s.id);
      if (currentStudentIds.length === 0) { setCumulativeResults([]); return; }

      const sessionTerms = terms
        .filter(t => t.session_id === selectedSessionId)
        .sort((a, b) => a.name.localeCompare(b.name));
      if (sessionTerms.length === 0) { setCumulativeResults([]); return; }

      const subjectClassIds = await getSubjectClassIds();
      if (subjectClassIds.length === 0) { setCumulativeResults([]); return; }

      const { data: allResults } = await supabase
        .from("results")
        .select("*")
        .eq("school_id", schoolId)
        .eq("session_id", selectedSessionId)
        .in("student_id", currentStudentIds)
        .in("subject_class_id", subjectClassIds);

      // ── Fetch stored term summaries (source of truth for term averages) ──
      const { data: allCumulativeSummaries } = await supabase
        .from("student_term_summaries")
        .select("student_id, term_id, average_score")
        .eq("school_id", schoolId)
        .eq("session_id", selectedSessionId)
        .in("student_id", currentStudentIds);

      // Build lookup: student_id → (term_id → average_score)
      const cumulativeSummaryMap = new Map<string, Map<string, number>>();
      (allCumulativeSummaries || []).forEach((s: any) => {
        if (!cumulativeSummaryMap.has(s.student_id)) {
          cumulativeSummaryMap.set(s.student_id, new Map());
        }
        cumulativeSummaryMap.get(s.student_id)!.set(s.term_id, s.average_score);
      });

      const cumulativeMap = new Map<string, CumulativeResult>();
      students.forEach(s => {
        cumulativeMap.set(s.id, {
          student_id: s.id,
          student_name: `${s.first_name} ${s.last_name}`,
          student_number: s.student_id,
          gender: s.gender,
          terms_with_results: 0,
          term_averages: [],
          cumulative_average: 0,
          cumulative_grade: "",
          cumulative_position: null,
          is_complete: false,
        });
      });

      const studentTermResults = new Map<string, Map<string, any[]>>();
      (allResults || []).forEach((result: any) => {
        if (!studentTermResults.has(result.student_id)) {
          studentTermResults.set(result.student_id, new Map());
        }
        const termMap = studentTermResults.get(result.student_id)!;
        if (!termMap.has(result.term_id)) termMap.set(result.term_id, []);
        termMap.get(result.term_id)!.push(result);
      });

      studentTermResults.forEach((termMap, studentId) => {
        const cr = cumulativeMap.get(studentId)!;
        const studentSummaries = cumulativeSummaryMap.get(studentId);
        let totalAverage = 0;
        let termsCount = 0;

        sessionTerms.forEach(term => {
          // Prefer stored summary as source of truth
          const storedAvg = studentSummaries?.get(term.id);
          if (storedAvg !== undefined && storedAvg > 0) {
            cr.term_averages.push({ term_name: term.name, average: storedAvg });
            totalAverage += storedAvg;
            termsCount++;
            return;
          }

          // Fall back to manual calculation from individual results
          const termResults = termMap.get(term.id);
          if (termResults && termResults.length > 0) {
            const termTotal = termResults.reduce((sum, r) => sum + (r.total || 0), 0);
            const termAverage = subjectClassIds.length > 0 ? termTotal / subjectClassIds.length : 0;
            cr.term_averages.push({ term_name: term.name, average: termAverage });
            totalAverage += termAverage;
            termsCount++;
          } else {
            cr.term_averages.push({ term_name: term.name, average: 0 });
          }
        });

        cr.terms_with_results = termsCount;
        if (termsCount > 0) {
          cr.cumulative_average = totalAverage / termsCount;
          cr.cumulative_grade = calculateAverageGrade(cr.cumulative_average);
        }
        cr.is_complete = termsCount === sessionTerms.length;
      });

      const results = Array.from(cumulativeMap.values())
        .filter(r => r.terms_with_results > 0)
        .sort((a, b) => b.cumulative_average - a.cumulative_average);

      results.forEach((r, i) => {
        r.cumulative_position = i + 1;
      });

      setCumulativeResults(results);
    } catch (err) {
      console.error("Error fetching cumulative results:", err);
    }
  }

  // ── Calculate Positions ──

  async function handleCalculatePositions() {
    if (!selectedSessionId || !selectedTermId || !selectedClassId) {
      toast.error("Please select a session, term, and class");
      return;
    }

    setLoading(true);
    try {
      const studentsWithResults = studentResults.filter(r => r.has_results);
      if (studentsWithResults.length === 0) {
        toast.error("No students with results to rank");
        setLoading(false);
        return;
      }

      const sortedStudents = [...studentsWithResults].sort((a, b) => b.average_score - a.average_score);
      const classSubjectClassIds = await getSubjectClassIds();

      const updates = sortedStudents.map((student, i) => ({
        studentId: student.student_id,
        position: i + 1,
      }));

      await Promise.all(
        updates.map(({ studentId, position }) =>
          supabase
            .from("results")
            .update({
              class_position: position,
              total_students: studentsWithResults.length,
              class_average:
                studentsWithResults.reduce((sum, r) => sum + r.average_score, 0) /
                studentsWithResults.length,
            })
            .eq("school_id", schoolId)
            .eq("student_id", studentId)
            .eq("term_id", selectedTermId)
            .eq("session_id", selectedSessionId)
            .in("subject_class_id", classSubjectClassIds)
        )
      );

      toast.success(`Positions calculated for ${studentsWithResults.length} students`);
      await fetchResults();
    } catch (err) {
      console.error("Error calculating positions:", err);
      toast.error("Failed to calculate positions");
    } finally {
      setLoading(false);
    }
  }

  // ── Filters ──

  const filteredResults = useMemo(() => {
    return studentResults.filter(r => {
      if (search && !r.student_name.toLowerCase().includes(search.toLowerCase()) &&
          !r.student_number.toLowerCase().includes(search.toLowerCase())) return false;
      if (genderFilter !== "all" && r.gender !== genderFilter) return false;
      if (performanceFilter !== "all") {
        const avg = r.average_score;
        if (performanceFilter === "excellent" && avg < 70) return false;
        if (performanceFilter === "good" && (avg < 60 || avg >= 70)) return false;
        if (performanceFilter === "average" && (avg < 50 || avg >= 60)) return false;
        if (performanceFilter === "poor" && avg >= 50) return false;
      }
      if (completionFilter !== "all") {
        if (completionFilter === "complete" && !r.is_complete) return false;
        if (completionFilter === "incomplete" && (r.is_complete || !r.has_results)) return false;
        if (completionFilter === "no_results" && r.has_results) return false;
      }
      return true;
    });
  }, [studentResults, search, genderFilter, performanceFilter, completionFilter]);

  const filteredCumulativeResults = useMemo(() => {
    return cumulativeResults.filter(r => {
      if (search && !r.student_name.toLowerCase().includes(search.toLowerCase()) &&
          !r.student_number.toLowerCase().includes(search.toLowerCase())) return false;
      if (genderFilter !== "all" && r.gender !== genderFilter) return false;
      if (performanceFilter !== "all") {
        const avg = r.cumulative_average;
        if (performanceFilter === "excellent" && avg < 70) return false;
        if (performanceFilter === "good" && (avg < 60 || avg >= 70)) return false;
        if (performanceFilter === "average" && (avg < 50 || avg >= 60)) return false;
        if (performanceFilter === "poor" && avg >= 50) return false;
      }
      if (completionFilter !== "all") {
        if (completionFilter === "complete" && !r.is_complete) return false;
        if (completionFilter === "incomplete" && r.is_complete) return false;
        if (completionFilter === "no_results") return false;
      }
      return true;
    });
  }, [cumulativeResults, search, genderFilter, performanceFilter, completionFilter]);

  // ── Handlers ──

  function handleViewReport(studentId: string) {
    window.open(`/admin/students/${studentId}/report?session=${selectedSessionId}&term=${selectedTermId}`, "_blank");
  }

  // ── Render ──

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const hasData = selectedSessionId && selectedTermId && selectedClassId;

  if (schoolLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (schoolError || !schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 font-semibold">{schoolError || "Unable to determine your school"}</p>
            <p className="text-slate-500 text-sm mt-2">Please contact your administrator or try logging in again.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <GraduationCap className="h-7 w-7 text-indigo-600" />
              Report Cards
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              View and manage student report cards across classes, sessions, and terms
            </p>
          </div>
        </div>

        {/* ── Filters Section ── */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <School className="h-4 w-4 text-indigo-500" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Session */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Session</label>
                <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 shadow-sm">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.is_current && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Term */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Term</label>
                <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSessionId}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 shadow-sm">
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.filter(t => t.session_id === selectedSessionId).map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} {t.is_current && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Class */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedTermId}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 shadow-sm">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or student ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-10 rounded-xl border-slate-200 pl-10 text-sm shadow-sm"
                  />
                </div>
              </div>

              {/* Gender Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gender</label>
                <select
                  value={genderFilter}
                  onChange={e => setGenderFilter(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              {/* Performance Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Performance</label>
                <select
                  value={performanceFilter}
                  onChange={e => setPerformanceFilter(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All Performance</option>
                  <option value="excellent">Excellent (70%+)</option>
                  <option value="good">Good (60-69%)</option>
                  <option value="average">Average (50-59%)</option>
                  <option value="poor">Needs Improvement (&lt;50%)</option>
                </select>
              </div>

              {/* Completion Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completion</label>
                <select
                  value={completionFilter}
                  onChange={e => setCompletionFilter(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All Completion</option>
                  <option value="complete">✅ Complete</option>
                  <option value="incomplete">⚠️ Incomplete</option>
                  <option value="no_results">❌ No Results</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── No Selection State ── */}
        {!hasData && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 mb-6">
              <GraduationCap className="h-12 w-12 text-slate-300 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Select a Class to View Report Cards</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Choose a session, term, and class above to see student results and access report cards.
            </p>
          </div>
        )}

        {/* ── Results Section ── */}
        {hasData && (
          <>
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedClass?.name || "Class"}
                </h2>
                <Badge variant="outline" className="text-xs font-medium text-slate-500">
                  {students.length} students
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPublicationDialogOpen(true)}
                  disabled={!selectedSessionId || !selectedTermId || !selectedClassId}
                  className="rounded-xl text-xs h-8"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Publish Results
                </Button>
                {showPositionSetting && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCalculatePositions}
                    disabled={loading || filteredResults.filter(r => r.has_results).length === 0}
                    className="rounded-xl text-xs h-8"
                  >
                    <Calculator className="h-3.5 w-3.5 mr-1" />
                    Calculate Positions
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isLastTerm && !showCumulative && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCumulative(true)}
                    className="rounded-xl text-xs h-8 border-purple-200 text-purple-700 hover:bg-purple-50"
                  >
                    <Calculator className="h-3.5 w-3.5 mr-1" />
                    Cumulative View
                  </Button>
                )}
                {showCumulative && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCumulative(false)}
                    className="rounded-xl text-xs h-8"
                  >
                    Single Term View
                  </Button>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            {!loading && filteredResults.length > 0 && !showCumulative && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <StatCard title="Total Students" value={filteredResults.length} icon={Users} color="text-slate-700" />
                <StatCard title="With Results" value={filteredResults.filter(r => r.has_results).length} icon={BookOpen} color="text-blue-600" />
                <StatCard
                  title="Class Average"
                  value={`${(
                    filteredResults.filter(r => r.is_complete).reduce((sum, r) => sum + r.average_score, 0) /
                    (filteredResults.filter(r => r.is_complete).length || 1) || 0
                  ).toFixed(1)}%`}
                  icon={GraduationCap}
                  color="text-indigo-600"
                  subtitle={`based on ${filteredResults.filter(r => r.is_complete).length} of ${filteredResults.filter(r => r.has_results).length} complete students`}
                />
                <StatCard
                  title="Highest Avg"
                  value={`${Math.max(...filteredResults.filter(r => r.is_complete).map(r => r.average_score), 0).toFixed(1)}%`}
                  icon={TrendingUp}
                  color="text-green-600"
                  subtitle={filteredResults.filter(r => !r.is_complete && r.has_results).length > 0 ? `${filteredResults.filter(r => !r.is_complete && r.has_results).length} incomplete excluded` : undefined}
                />
                <StatCard
                  title="✅ Complete"
                  value={filteredResults.filter(r => r.is_complete).length}
                  icon={FileText}
                  color="text-emerald-600"
                  subtitle={`of ${filteredResults.filter(r => r.has_results).length}`}
                />
                <StatCard
                  title="⚠️ Incomplete"
                  value={filteredResults.filter(r => r.has_results && !r.is_complete).length}
                  icon={AlertCircle}
                  color="text-amber-600"
                />
              </div>
            )}

            {/* ── Subject Completion Overview ── */}
            {!loading && subjectCompletion.length > 0 && !showCumulative && (
              <Card className="border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                  <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-amber-600" />
                    Subject Result Completion
                    <Badge variant="outline" className="ml-auto text-xs font-normal text-slate-500">
                      {subjectCompletion.filter(s => s.completion_percentage === 100).length}/{subjectCompletion.length} complete
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {subjectCompletion.map(subject => {
                      const isComplete = subject.completion_percentage === 100;
                      const isStarted = subject.completion_percentage > 0;
                      return (
                        <div
                          key={subject.subject_class_id}
                          className={`rounded-xl border p-3.5 transition-all hover:shadow-sm ${
                            isComplete
                              ? "bg-green-50/60 border-green-200"
                              : isStarted
                                ? "bg-amber-50/60 border-amber-200"
                                : "bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-sm text-slate-800 truncate">{subject.subject_name}</p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold px-1.5 py-0 ${
                                isComplete
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : isStarted
                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-500 border-slate-200"
                              }`}
                            >
                              {isComplete ? "Done" : isStarted ? "Pending" : "No data"}
                            </Badge>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isComplete
                                  ? "bg-green-500"
                                  : isStarted
                                    ? "bg-amber-400"
                                    : "bg-slate-300"
                              }`}
                              style={{ width: `${subject.completion_percentage}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span className="font-medium">
                              <span className="text-green-600 font-bold">{subject.completed_count}</span>
                              <span className="text-slate-400"> / {subject.total_students}</span>
                            </span>
                            <span>
                              {subject.pending_count > 0 ? (
                                <span className="text-amber-600 font-medium">{subject.pending_count} pending</span>
                              ) : (
                                <span className="text-green-600 font-medium">All done</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cumulative Banner */}
            {isLastTerm && !showCumulative && filteredResults.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-xl">
                      <Calculator className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-purple-900">Cumulative Results Available</h4>
                      <p className="text-sm text-purple-700 mt-0.5">
                        View student rankings across all terms in this session
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setShowCumulative(true)} className="bg-purple-600 hover:bg-purple-700 rounded-xl">
                    View Cumulative Results
                  </Button>
                </div>
              </div>
            )}

            {/* Cumulative Results View */}
            {showCumulative && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <Calculator className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-purple-900">Cumulative Results Across All Terms</h3>
                      <p className="text-sm text-purple-700 mt-1">
                        Each student's average performance across all terms in this session, ranked by cumulative average.
                      </p>
                    </div>
                  </div>
                </div>

                {filteredCumulativeResults.length > 0 && (
                  <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <StatCard title="Total Ranked" value={filteredCumulativeResults.length} icon={Users} color="text-purple-700" />
                    <StatCard
                      title="Complete (3 Terms)"
                      value={filteredCumulativeResults.filter(r => r.is_complete).length}
                      icon={FileText}
                      color="text-green-600"
                    />
                    <StatCard
                      title="Partial Results"
                      value={filteredCumulativeResults.filter(r => !r.is_complete).length}
                      icon={AlertCircle}
                      color="text-amber-600"
                    />
                    <StatCard
                      title="Average Score"
                      value={`${(
                        filteredCumulativeResults.reduce((sum, r) => sum + r.cumulative_average, 0) /
                        filteredCumulativeResults.length || 0
                      ).toFixed(1)}%`}
                      icon={GraduationCap}
                      color="text-indigo-600"
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gradient-to-r from-purple-50 to-blue-50">
                      <tr>
                        {showPositionSetting && <th className="p-3 text-left font-semibold text-slate-600">Rank</th>}
                        <th className="p-3 text-left font-semibold text-slate-600">Student</th>
                        <th className="p-3 text-center font-semibold text-slate-600">Terms</th>
                        {filteredCumulativeResults[0]?.term_averages.map(t => (
                          <th key={t.term_name} className="p-3 text-center font-semibold text-slate-600">{t.term_name}</th>
                        ))}
                        <th className="p-3 text-center font-semibold text-slate-600">Cumulative Avg</th>
                        <th className="p-3 text-center font-semibold text-slate-600">Grade</th>
                        <th className="p-3 text-center font-semibold text-slate-600">Status</th>
                        <th className="p-3 text-right font-semibold text-slate-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCumulativeResults.map(r => (
                        <tr key={r.student_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                          {showPositionSetting && (
                            <td className="p-3">{getPositionDisplay(r.cumulative_position)}</td>
                          )}
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-slate-900">{r.student_name}</p>
                              <p className="text-xs text-slate-400">{r.student_number}</p>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant="outline"
                              className={r.is_complete ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}
                            >
                              {r.terms_with_results}/{r.term_averages.length}
                            </Badge>
                          </td>
                          {r.term_averages.map((t, i) => (
                            <td key={i} className="p-3 text-center">
                              {t.average > 0 ? (
                                <span className="font-semibold text-slate-700">{t.average.toFixed(1)}%</span>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          ))}
                          <td className="p-3 text-center">
                            <span className="text-lg font-bold text-purple-700">{r.cumulative_average.toFixed(1)}%</span>
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={`text-sm font-bold ${getGradeColor(r.cumulative_grade)}`}>
                              {r.cumulative_grade}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            {r.is_complete ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300">Complete</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300">Partial</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReport(r.student_id)}
                              className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Report
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredCumulativeResults.length === 0 && (
                    <div className="p-10 text-center text-slate-400">No cumulative results available.</div>
                  )}
                </div>
              </div>
            )}

            {/* Single Term Results View */}
            {!showCumulative && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="ml-3 text-sm text-slate-500">Loading results...</span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-3 text-left font-semibold text-slate-600 w-10">#</th>
                          <th className="p-3 text-left font-semibold text-slate-600">Student</th>
                          <th className="p-3 text-center font-semibold text-slate-600">Subjects</th>
                          <th className="p-3 text-center font-semibold text-slate-600">Average</th>
                          <th className="p-3 text-center font-semibold text-slate-600">Highest</th>
                          <th className="p-3 text-center font-semibold text-slate-600">Lowest</th>
                          <th className="p-3 text-center font-semibold text-slate-600">Performance</th>
                          <th className="p-3 text-center font-semibold text-slate-600">Grade</th>
                          {showPositionSetting && <th className="p-3 text-center font-semibold text-slate-600">Position</th>}
                          <th className="p-3 text-center font-semibold text-slate-600">Completion</th>
                          <th className="p-3 text-right font-semibold text-slate-600">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((r, i) => {
                          const perf = getPerformanceIndicator(r.average_score);
                          const PerfIcon = perf.icon;
                          return (
                            <tr key={r.student_id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="p-3 text-slate-400 text-xs">{i + 1}</td>
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                                    {r.student_name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="font-medium text-slate-900">{r.student_name}</p>
                                    <p className="text-xs text-slate-400">{r.student_number}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                {r.has_results ? (
                                  <Badge variant="outline" className="font-medium">{r.total_subjects}</Badge>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {r.has_results && r.is_complete ? (
                                  <span className="font-bold text-slate-800">{r.average_score.toFixed(1)}%</span>
                                ) : r.has_results ? (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium">
                                    Incomplete
                                  </Badge>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {r.has_results && r.is_complete ? (
                                  <span className="text-green-600 font-medium">{r.highest_score.toFixed(0)}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {r.has_results && r.is_complete ? (
                                  <span className="text-orange-600 font-medium">{r.lowest_score.toFixed(0)}</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {r.has_results && r.is_complete ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <PerfIcon className={`h-4 w-4 ${perf.color}`} />
                                    <span className={`text-xs font-medium ${perf.color}`}>{perf.label}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                {r.has_results && r.is_complete ? (
                                  <Badge variant="outline" className={`text-sm font-bold ${getGradeColor(r.average_grade)}`}>
                                    {r.average_grade}
                                  </Badge>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              {showPositionSetting && (
                                <td className="p-3 text-center">
                                  {r.class_position && r.is_complete ? (
                                    getPositionDisplay(r.class_position)
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              )}
                              <td className="p-3 text-center">
                                {r.has_results ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {r.is_complete ? (
                                      <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Complete</Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                        {r.completion_percentage}%
                                      </Badge>
                                    )}
                                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${r.is_complete ? "bg-green-500" : "bg-amber-400"}`}
                                        style={{ width: `${r.completion_percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-xs">No data</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewReport(r.student_id)}
                                    className="text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Report
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4 text-slate-400" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-xl">
                                      <DropdownMenuItem onClick={() => handleViewReport(r.student_id)}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Full Report Card
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => window.open(
                                          `/admin/students/${r.student_id}/report?session=${selectedSessionId}&term=${selectedTermId}&print=true`,
                                          "_blank"
                                        )}
                                      >
                                        <Printer className="mr-2 h-4 w-4" />
                                        Print Report
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {filteredResults.length === 0 && (
                      <div className="p-10 text-center">
                        <BookOpen className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-slate-400 font-medium">
                          {search || genderFilter !== "all" || performanceFilter !== "all" || completionFilter !== "all"
                            ? "No results match your filters."
                            : "No student results found for this term."}
                        </p>
                        <p className="text-xs text-slate-300 mt-1">
                          {!students.length
                            ? "No students in this class."
                            : "Results have not been entered yet."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Publication Dialog */}
      <ResultsPublicationDialog
        isOpen={isPublicationDialogOpen}
        onClose={() => setIsPublicationDialogOpen(false)}
        classId={selectedClassId}
        className={selectedClass?.name || ""}
        sessionId={selectedSessionId}
        termId={selectedTermId}
        schoolId={schoolId}
        onPublish={() => {
          fetchResults();
        }}
      />
    </DashboardLayout>
  );
}
