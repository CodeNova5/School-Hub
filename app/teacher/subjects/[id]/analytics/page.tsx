"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, TrendingDown, Award, } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSchoolContext } from "@/hooks/use-school-context";
export default function SubjectAnalyticsPage({ params }: any) {
    const subjectClassId = params.id;

    const [sessions, setSessions] = useState<any[]>([]);
    const [terms, setTerms] = useState<any[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [selectedTerm, setSelectedTerm] = useState<string>("");

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
    const { schoolId, isLoading: schoolLoading } = useSchoolContext();

    // DB-DRIVEN STATES
    const [resultComponents, setResultComponents] = useState<any[]>([]);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [genderComparison, setGenderComparison] = useState<any[]>([]);

    const GRADE_COLORS: Record<string, string> = {
        A1: "#16a34a", // green
        B2: "#4ade80",
        B3: "#86efac",
        C4: "#fef08a", // yellow
        C5: "#fde047",
        C6: "#facc15",
        D7: "#f97316", // orange
        E8: "#fb923c",
        F9: "#ef4444", // red
    };


    useEffect(() => {
        loadInitial();
    }, [schoolId]);

    async function loadInitial() {
        if (!schoolId) return;
        setIsLoading(true);

        // Load result components first
        const { data: componentData } = await supabase
            .from("result_component_templates")
            .select("component_key, component_name, max_score, display_order")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .order("display_order", { ascending: true });

        setResultComponents(componentData || []);

        const { data: sessionData } = await supabase.from("sessions").select("*").eq('school_id', schoolId).order("name");
        const { data: termData } = await supabase.from("terms").select("*").eq('school_id', schoolId).order("name");
        const { data: subjectClass } = await supabase
            .from("subject_classes")
            .select(`id, subject_code, subject:subjects!subject_classes_subject_id_fkey ( id, name ), class:classes ( id, name, class_level_id, school_class_levels:class_level_id(id, name) )`)
            .eq("id", subjectClassId)
            .eq('school_id', schoolId)
            .single();

        setSubject(subjectClass);

        setSessions(sessionData || []);
        setTerms(termData || []);
        setSubject(subjectClass || null);

        const currentSession = sessionData?.find((s: any) => s.is_current);
        const currentTerm = termData?.find((t: any) => t.is_current);

        setSelectedSession(currentSession?.id || "");
        setSelectedTerm(currentTerm?.id || "");

        loadResults(subjectClassId, currentSession?.id, currentTerm?.id);
        await loadGenderComparison(subjectClassId);


    }

    async function loadStudentBreakdown(subjectClassId: string, sessionId: string, termId: string, components: any[]) {
        if (!schoolId || components.length === 0) {
            setIsLoading(false);
            return;
        }

        try {
            // First, fetch results with student details
            const { data: results, error: resultsError } = await supabase
                .from("results")
                .select(`
                    id,
                    grade,
                    student_id,
                    students!inner (
                        id,
                        first_name,
                        last_name,
                        student_id,
                        gender,
                        photo_url
                    )
                `)
                .eq("subject_class_id", subjectClassId)
                .eq("session_id", sessionId)
                .eq("term_id", termId)
                .eq('school_id', schoolId);

            if (resultsError) {
                console.error("Error loading results:", resultsError);
                setIsLoading(false);
                return;
            }

            if (!results || results.length === 0) {
                setStudentBreakdown([]);
                setIsLoading(false);
                return;
            }

            // Get all result IDs
            const resultIds = results.map((r: any) => r.id);

            // Load component scores for all results
            const { data: componentScores, error: scoresError } = await supabase
                .from("result_component_scores")
                .select("result_id, component_key, score")
                .in("result_id", resultIds)
                .eq('school_id', schoolId);

            if (scoresError) {
                console.error("Error loading component scores:", scoresError);
            }

            // Map scores by result ID
            const scoresMap = new Map<string, Map<string, number>>();
            (componentScores || []).forEach((cs: any) => {
                if (!scoresMap.has(cs.result_id)) {
                    scoresMap.set(cs.result_id, new Map());
                }
                scoresMap.get(cs.result_id)!.set(cs.component_key, cs.score);
            });

            // Build student breakdown with dynamic components
            const sorted = results
                .map((r: any) => {
                    const componentMap = scoresMap.get(r.id) || new Map();
                    const componentScoresObj: any = {};
                    let totalScore = 0;

                    components.forEach(comp => {
                        const score = componentMap.get(comp.component_key) || 0;
                        componentScoresObj[comp.component_key] = score;
                        totalScore += score;
                    });

                    const student = r.students;
                    
                    return {
                        id: r.id,
                        name: `${student.first_name} ${student.last_name}`,
                        student_id: student.student_id,
                        photo_url: student.photo_url,
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
            // Fetch result components fresh (to avoid state timing issues)
            const { data: componentData } = await supabase
                .from("result_component_templates")
                .select("component_key, component_name, max_score, display_order")
                .eq("school_id", schoolId)
                .eq("is_active", true)
                .order("display_order", { ascending: true });
            
            const components = componentData || [];
            setResultComponents(components);
            
            // Fetch results without total (it doesn't exist in table)
            let query: any = supabase
                .from("results")
                .select(`id, grade, student_id, session_id, term_id, students(first_name, last_name, student_id, gender, photo_url)`)
                .eq("subject_class_id", subjectClassId)
                .eq('school_id', schoolId);

            if (sessionId) query = query.eq("session_id", sessionId);
            if (termId) query = query.eq("term_id", termId);

            const { data, error } = await query;
            if (error) {
                console.error("Error loading results:", error);
                setResults([]);
                setIsLoading(false);
                return;
            }

            // If no results, clear everything
            if (!data || data.length === 0) {
                setResults([]);
                setSessionTrend([]);
                setTermTrend([]);
                setGenderStats({ male: 0, female: 0 });
                setStudentBreakdown([]);
                setIsLoading(false);
                return;
            }

            const resultIds = data.map((r: any) => r.id);

            // Fetch all component scores for these results
            const { data: componentScores } = await supabase
                .from("result_component_scores")
                .select("result_id, score")
                .in("result_id", resultIds)
                .eq('school_id', schoolId);

            // Calculate totals from component scores
            const totalsMap = new Map<string, number>();
            (componentScores || []).forEach((cs: any) => {
                const current = totalsMap.get(cs.result_id) || 0;
                totalsMap.set(cs.result_id, current + cs.score);
            });

            // Enrich results with calculated totals
            const enrichedResults = data.map((r: any) => ({
                ...r,
                total: totalsMap.get(r.id) || 0
            }));

            setResults(enrichedResults);

            // ⭐ LOAD SESSION TREND (average score across sessions)
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
                    const current = allTotalsMap.get(cs.result_id) || 0;
                    allTotalsMap.set(cs.result_id, current + cs.score);
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

            // ⭐ HIGHEST SCORING STUDENT IN EACH TERM
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
                        const current = termTotalsMap.get(cs.result_id) || 0;
                        termTotalsMap.set(cs.result_id, current + cs.score);
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

            // ⭐ TERM TREND WITHIN SELECTED SESSION
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
                        const current = termDataTotalsMap.get(cs.result_id) || 0;
                        termDataTotalsMap.set(cs.result_id, current + cs.score);
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

            // ⭐ MALE vs FEMALE PERFORMANCE
            const males = enrichedResults.filter((r: any) => r.students?.gender?.toLowerCase() === "male");
            const females = enrichedResults.filter((r: any) => r.students?.gender?.toLowerCase() === "female");

            setGenderStats({
                male: males.length ? (males.reduce((a: any, b: any) => a + b.total, 0) / males.length).toFixed(1) : 0,
                female: females.length ? (females.reduce((a: any, b: any) => a + b.total, 0) / females.length).toFixed(1) : 0,
            });
            
            // Load student breakdown if session and term are selected
            if (sessionId && termId && components.length > 0) {
                await loadStudentBreakdown(subjectClassId, sessionId, termId, components);
            } else {
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error in loadResults:", error);
            setIsLoading(false);
        }
    }

    async function loadGenderComparison(subjectClassId: string) {
        if (!schoolId) return;
        
        try {
            const { data: genderResults } = await supabase
                .from("results")
                .select(`id, students(gender)`)
                .eq("subject_class_id", subjectClassId)
                .eq('school_id', schoolId);

            if (!genderResults || genderResults.length === 0) {
                setGenderComparison([
                    { gender: "Male", avg: 0 },
                    { gender: "Female", avg: 0 }
                ]);
                return;
            }

            const resultIds = genderResults.map((r: any) => r.id);
            
            // Get scores for all results
            const { data: scores } = await supabase
                .from("result_component_scores")
                .select("result_id, score")
                .in("result_id", resultIds)
                .eq('school_id', schoolId);

            // Calculate totals mapped by result ID
            const totalsMap = new Map<string, number>();
            (scores || []).forEach((cs: any) => {
                const current = totalsMap.get(cs.result_id) || 0;
                totalsMap.set(cs.result_id, current + cs.score);
            });

            const males: number[] = [];
            const females: number[] = [];

            genderResults.forEach((r: any) => {
                const gender = r.students?.gender?.toLowerCase();
                const total = totalsMap.get(r.id) || 0;

                if (gender === "male") males.push(total);
                if (gender === "female") females.push(total);
            });

            const formatted = [
                {
                    gender: "Male",
                    avg: males.length ? (males.reduce((a, b) => a + b, 0) / males.length).toFixed(1) : 0,
                },
                {
                    gender: "Female",
                    avg: females.length ? (females.reduce((a, b) => a + b, 0) / females.length).toFixed(1) : 0,
                },
            ];

            setGenderComparison(formatted);
        } catch (error) {
            console.error("Error in loadGenderComparison:", error);
            setGenderComparison([
                { gender: "Male", avg: 0 },
                { gender: "Female", avg: 0 }
            ]);
        }
    }


    const avgScore =
        results.length > 0 ? (results.reduce((a, b) => a + b.total, 0) / results.length).toFixed(1) : 0;

    const passRate =
        results.length > 0
            ? Math.round(
                (results.filter((r) => !["D7", "E8", "F9"].includes(r.grade)).length / results.length) * 100
            )
            : 0;

    const highestScore = results.length > 0 ? Math.max(...results.map((r) => r.total)) : 0;
    const lowestScore = results.length > 0 ? Math.min(...results.map((r) => r.total)) : 0;

    const gradeDistribution = ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"].map((g) => ({
        grade: g,
        count: results.filter((r) => r.grade === g).length,
    }));

    if (schoolLoading || isLoading) {
        return (
            <DashboardLayout role="teacher">
                <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-gray-500">Loading analytics...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-4 sm:space-y-6 overflow-x-hidden pb-4 sm:pb-6">

                {/* HEADER */}
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
                        Subject Analytics
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1.5 sm:mt-2 break-words">
                        {subject?.subject?.name} — {subject?.class?.name} ({subject?.class?.school_class_levels?.name})
                    </p>
                </div>

                {/* FILTERS */}
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">
                            Filters
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">

                        <Select
                            value={selectedSession}
                            onValueChange={(val) => {
                                setSelectedSession(val);
                                loadResults(subjectClassId, val, selectedTerm);
                            }}
                        >
                            <SelectTrigger className="text-sm h-9 sm:h-10">
                                <SelectValue placeholder="Select Session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map((s: any) => (
                                    <SelectItem value={s.id} key={s.id} className="text-sm">
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedTerm}
                            onValueChange={(val) => {
                                setSelectedTerm(val);
                                loadResults(subjectClassId, selectedSession, val);
                            }}
                        >
                            <SelectTrigger className="text-sm h-9 sm:h-10">
                                <SelectValue placeholder="Select Term" />
                            </SelectTrigger>
                            <SelectContent>
                                {terms
                                    .filter((t: any) => t.session_id === selectedSession)
                                    .map((t: any) => (
                                        <SelectItem value={t.id} key={t.id} className="text-sm">
                                            {t.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>

                    </CardContent>
                </Card>

                {/* SUMMARY CARDS */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">

                    <Card>
                        <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                            <Users className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 sm:mb-2 text-blue-600 shrink-0" />
                            <p className="text-lg sm:text-2xl font-bold">{results.length}</p>
                            <p className="text-gray-500 text-xs sm:text-sm">
                                Students Offering
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 sm:mb-2 text-green-600 shrink-0" />
                            <p className="text-lg sm:text-2xl font-bold">{avgScore}</p>
                            <p className="text-gray-500 text-xs sm:text-sm">
                                Average Score
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                            <Award className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 sm:mb-2 text-purple-600 shrink-0" />
                            <p className="text-lg sm:text-2xl font-bold">{highestScore}</p>
                            <p className="text-gray-500 text-xs sm:text-sm">
                                Highest Score
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-3 sm:p-4 flex flex-col items-center text-center">
                            <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 sm:mb-2 text-red-600 shrink-0" />
                            <p className="text-lg sm:text-2xl font-bold">{lowestScore}</p>
                            <p className="text-gray-500 text-xs sm:text-sm">
                                Lowest Score
                            </p>
                        </CardContent>
                    </Card>

                </div>

                {/* STUDENT PERFORMANCE */}
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">
                            Student Performance Breakdown
                        </CardTitle>
                        <p className="text-gray-500 text-xs sm:text-sm mt-1">
                            Ordered by total score (highest → lowest)
                        </p>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">

                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">

                            <Input
                                placeholder="Search by name or ID"
                                className="flex-1 min-w-0 text-sm h-9 sm:h-10"
                                value={searchQuery}
                                onChange={(e: any) => setSearchQuery(e.target.value)}
                            />

                            <select
                                className="border rounded p-2 text-xs sm:text-sm h-9 sm:h-10 bg-white min-w-fit"
                                value={genderFilter}
                                onChange={(e) => setGenderFilter(e.target.value)}
                            >
                                <option value="all">All Genders</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>

                            <select
                                className="border rounded p-2 text-xs sm:text-sm h-9 sm:h-10 bg-white min-w-fit"
                                value={scoreFilter}
                                onChange={(e) => setScoreFilter(Number(e.target.value))}
                            >
                                <option value={0}>All Scores</option>
                                <option value={40}>40+ (Pass)</option>
                                <option value={70}>70+ (Top)</option>
                                <option value={85}>85+ (Excellent)</option>
                            </select>

                        </div>

                        {/* Desktop Table */}
                        <div className="hidden lg:block border rounded-lg overflow-x-auto">
                            <div>
                                <table className="w-full text-xs sm:text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-2 text-left">#</th>
                                            <th className="p-2 text-left">Student</th>
                                            {resultComponents.map((comp) => (
                                                <th key={comp.component_key} className="p-2 text-left">{comp.component_name}</th>
                                            ))}
                                            <th className="p-2 text-left">Total</th>
                                            <th className="p-2 text-left">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentBreakdown
                                            .filter((s) =>
                                                s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                s.student_id.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .filter((s) =>
                                                genderFilter === "all" ? true : s.gender?.toLowerCase() === genderFilter
                                            )
                                            .filter((s) => s.total >= scoreFilter)
                                            .map((s, index) => (
                                                <tr key={s.id} className="border-t hover:bg-gray-50">
                                                    <td className="p-2">{index + 1}</td>
                                                    <td className="p-2 whitespace-nowrap">{s.name}</td>
                                                    {resultComponents.map((comp) => (
                                                        <td key={comp.component_key} className="p-2">{s[comp.component_key] || 0}</td>
                                                    ))}
                                                    <td className="p-2 font-semibold">{s.total}</td>
                                                    <td className="p-2 font-bold">{s.grade}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Card Layout */}
                        <div className="lg:hidden space-y-3">
                            {studentBreakdown
                                .filter((s) =>
                                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    s.student_id.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .filter((s) =>
                                    genderFilter === "all" ? true : s.gender?.toLowerCase() === genderFilter
                                )
                                .filter((s) => s.total >= scoreFilter)
                                .map((s, index) => (
                                    <div key={s.id} className="border rounded-lg p-4 space-y-2 bg-white shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium shrink-0">
                                                        {index + 1}
                                                    </span>
                                                    <p className="font-medium text-sm truncate">{s.name}</p>
                                                </div>
                                                <p className="text-xs text-muted-foreground ml-8">{s.student_id}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-bold text-blue-600">{s.total}</p>
                                                <p className="text-xs font-semibold" style={{ color: GRADE_COLORS[s.grade] || '#666' }}>{s.grade}</p>
                                            </div>
                                        </div>
                                        <div className={`grid gap-2 pt-2 border-t text-xs`} style={{ gridTemplateColumns: `repeat(${Math.min(resultComponents.length, 4)}, 1fr)` }}>
                                            {resultComponents.map((comp) => (
                                                <div key={comp.component_key} className="text-center">
                                                    <p className="text-gray-600 font-medium">{comp.component_name}</p>
                                                    <p className="font-semibold text-gray-900 mt-0.5">{s[comp.component_key] || 0}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            {studentBreakdown.filter((s) =>
                                (s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    s.student_id.toLowerCase().includes(searchQuery.toLowerCase())) &&
                                (genderFilter === "all" ? true : s.gender?.toLowerCase() === genderFilter) &&
                                s.total >= scoreFilter
                            ).length === 0 && (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                        No students match your filters
                                    </div>
                                )}
                        </div>

                    </CardContent>
                </Card>

                {/* CHARTS */}
                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">
                            Assessment Component Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 overflow-x-auto">
                        <div style={{ height: '280px', width: '100%', minWidth: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={resultComponents.map((comp) => ({
                                    name: comp.component_name,
                                    avg: studentBreakdown.length
                                        ? (studentBreakdown.reduce((sum, s) => sum + (s[comp.component_key] || 0), 0) / studentBreakdown.length).toFixed(1)
                                        : 0,
                                }))}>
                                    <XAxis dataKey="name" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip contentStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="avg" fill="#3b82f6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">
                            Grade Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 overflow-x-auto">
                        <div style={{ height: '280px', width: '100%', minWidth: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={gradeDistribution}>
                                    <XAxis dataKey="grade" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip contentStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="count" fill="#8b5cf6" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-base sm:text-lg">
                            Male vs Female Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 overflow-x-auto">
                        <div style={{ height: '280px', width: '100%', minWidth: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={genderComparison}>
                                    <XAxis dataKey="gender" fontSize={12} />
                                    <YAxis fontSize={12} />
                                    <Tooltip contentStyle={{ fontSize: 12 }} />
                                    <Bar dataKey="avg" fill="#60a5fa" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    );
}