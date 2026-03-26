"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSchoolContext } from "@/hooks/use-school-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, TrendingUp, TrendingDown, Award, } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
export default function SubjectAnalyticsPage({ params }: any) {
    const { schoolId } = useSchoolContext();
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
        if (schoolId) {
            loadInitial();
        }
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

        const { data: sessionData } = await supabase.from("sessions").select("*").eq("school_id", schoolId).order("name");
        const { data: termData } = await supabase.from("terms").select("*").eq("school_id", schoolId).order("name");
        const { data: subjectClass } = await supabase
            .from("subject_classes")
            .select(`id, subject_code,  subject:subjects ( id, name ), class:classes ( id, name, level)`)
            .eq("school_id", schoolId)
            .eq("id", subjectClassId)
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
            setStudentBreakdown([]);
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
                setStudentBreakdown([]);
                return;
            }

            if (!results || results.length === 0) {
                setStudentBreakdown([]);
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
            let query: any = supabase
                .from("results")
                .select(`id, students(gender)`)
                .eq("subject_class_id", subjectClassId)
                .eq('school_id', schoolId);

            const { data: genderResults } = await query;

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

    if (isLoading) {
        return (
            <DashboardLayout role="admin">
                <div className="flex items-center justify-center min-h-[400px]">
                    <p className="text-gray-500">Loading analytics...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="admin">
            <div className="space-y-8">

                {/* HEADER */}
                <h1 className="text-3xl font-bold">Subject Analytics</h1>
                <p className="text-gray-600">
                    {subject?.subject?.name} — {subject?.class?.name} ({subject?.class?.level})
                </p>

                {/* 1. FILTERS */}
                <Card>
                    <CardHeader>
                        <CardTitle>Filters</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">

                        {/* Session Selector */}
                        <Select
                            value={selectedSession}
                            onValueChange={(val) => {
                                setSelectedSession(val);
                                loadResults(subjectClassId, val, selectedTerm);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map((s: any) => (
                                    <SelectItem value={s.id} key={s.id}>
                                        {s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Term Selector */}
                        <Select
                            value={selectedTerm}
                            onValueChange={(val) => {
                                setSelectedTerm(val);
                                loadResults(subjectClassId, selectedSession, val);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Term" />
                            </SelectTrigger>
                            <SelectContent>
                                {terms
                                    .filter((t: any) => t.session_id === selectedSession)
                                    .map((t: any) => (
                                        <SelectItem value={t.id} key={t.id}>
                                            {t.name}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>

                    </CardContent>
                </Card>

                {/* 2. SUMMARY CARDS */}
                <div className="grid md:grid-cols-4 gap-4">

                    {/* Students Count */}
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center">
                            <Users className="h-6 w-6 mb-2 text-blue-600" />
                            <p className="text-3xl font-bold">{results.length}</p>
                            <p className="text-gray-500 text-sm">Students Offering This Subject</p>
                        </CardContent>
                    </Card>

                    {/* Average Score */}
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center">
                            <TrendingUp className="h-6 w-6 mb-2 text-green-600" />
                            <p className="text-3xl font-bold">{avgScore}</p>
                            <p className="text-gray-500 text-sm">Average Score</p>
                        </CardContent>
                    </Card>

                    {/* Highest Score */}
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center">
                            <Award className="h-6 w-6 mb-2 text-purple-600" />
                            <p className="text-3xl font-bold">{highestScore}</p>
                            <p className="text-gray-500 text-sm">Highest Score</p>
                        </CardContent>
                    </Card>

                    {/* Lowest Score */}
                    <Card>
                        <CardContent className="p-4 flex flex-col items-center">
                            <TrendingDown className="h-6 w-6 mb-2 text-red-600" />
                            <p className="text-3xl font-bold">{lowestScore}</p>
                            <p className="text-gray-500 text-sm">Lowest Score</p>
                        </CardContent>
                    </Card>

                </div>

                {/* 🔥 STUDENT RESULT BREAKDOWN */}
                <Card>
                    <CardHeader>
                        <CardTitle>Student Performance Breakdown</CardTitle>
                        <p className="text-gray-500 text-sm">
                            Ordered by total score (highest → lowest)
                        </p>
                    </CardHeader>

                    <CardContent>

                        {/* 🔍 Filters */}
                        <div className="flex gap-4 mb-4">

                            <Input
                                placeholder="Search by name or ID"
                                className="w-1/3"
                                value={searchQuery}
                                onChange={(e: any) => setSearchQuery(e.target.value)}
                            />

                            <select
                                className="border rounded p-2"
                                value={genderFilter}
                                onChange={(e) => setGenderFilter(e.target.value)}
                            >
                                <option value="all">All Genders</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>

                            <select
                                className="border rounded p-2"
                                value={scoreFilter}
                                onChange={(e) => setScoreFilter(Number(e.target.value))}
                            >
                                <option value={0}>All Scores</option>
                                <option value={40}>40+ (Pass)</option>
                                <option value={70}>70+ (Top)</option>
                                <option value={85}>85+ (Excellent)</option>
                            </select>
                        </div>

                        {/* 📊 Table */}
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
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
                                            <tr key={s.id} className="border-t">
                                                <td className="p-2">{index + 1}</td>
                                                <td className="p-2">
                                                    {/* Student Info with Avatar */}

                                                    <div className="flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage
                                                                src={
                                                                    s.photo_url
                                                                        ? s.photo_url
                                                                        : s.gender === "male"
                                                                            ? "/male-avatar.jpg"
                                                                            : "/female-avatar.jpg"
                                                                }
                                                            />
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">
                                                                {s.name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">({s.student_id})</div>
                                                        </div>
                                                    </div>
                                                </td>
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
                    </CardContent>
                </Card>

                {/* 3. ASSESSMENT COMPONENT BREAKDOWN */}
                <Card>
                    <CardHeader>
                        <CardTitle>Assessment Component Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={resultComponents.map((comp) => ({
                                    name: comp.component_name,
                                    avg: results.length ? (results.reduce((a: number, b: any) => {
                                        const val = studentBreakdown.find(sb => sb.id === b.id)?.[comp.component_key] || 0;
                                        return a + val;
                                    }, 0) / results.length).toFixed(1) : 0
                                }))}
                            >
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="avg" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 4. GRADE DISTRIBUTION */}
                <Card>
                    <CardHeader>
                        <CardTitle>Grade Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={gradeDistribution}>
                                <XAxis dataKey="grade" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count">
                                    {gradeDistribution.map((entry, index) => (
                                        <Cell key={index} fill={GRADE_COLORS[entry.grade]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>


                {/* 6. STUDENTS NEEDING ATTENTION */}
                <Card>
                    <CardHeader>
                        <CardTitle>Students Needing Attention</CardTitle>
                        <p className="text-gray-500 text-sm">
                            Students scoring below 50 or failing (D7, E8, F9)
                        </p>
                    </CardHeader>

                    <CardContent>
                        {results.filter(r => r.total < 50 || ["D7", "E8", "F9"].includes(r.grade)).length === 0 ? (
                            <p className="text-gray-500">No struggling students found.</p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-red-50">
                                        <tr>
                                            <th className="p-2 text-left">Student</th>
                                            <th className="p-2 text-left">Score</th>
                                            <th className="p-2 text-left">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results
                                            .filter(r => r.total < 50 || ["D7", "E8", "F9"].includes(r.grade))
                                            .sort((a, b) => a.total - b.total)
                                            .map((r) => (
                                                <tr key={r.id} className="border-t bg-red-50/30">
                                                    <td className="p-2 flex items-center gap-3">
                                                        <Avatar>
                                                            <AvatarImage
                                                                src={
                                                                    r.students.photo_url
                                                                        ? r.students.photo_url
                                                                        : r.students.gender === "male"
                                                                            ? "/male-avatar.jpg"
                                                                            : "/female-avatar.jpg"
                                                                }
                                                            />

                                                            <AvatarFallback className="bg-blue-100 text-blue-700">
                                                                {r.students.first_name.charAt(0)}
                                                                {r.students.last_name.charAt(0)}
                                                            </AvatarFallback>

                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">
                                                                {r.students.first_name} {r.students.last_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">({r.students.student_id})</div>
                                                        </div>
                                                    </td>
                                                    <td className="p-2">{r.total}</td>
                                                    <td className="p-2">{r.grade}</td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 9. MALE vs FEMALE PERFORMANCE */}
                <Card>
                    <CardHeader>
                        <CardTitle>Male vs Female Performance</CardTitle>
                        <p className="text-gray-500 text-sm">Average score comparison by gender</p>
                    </CardHeader>

                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={genderComparison}>
                                <XAxis dataKey="gender" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="avg" fill="#60a5fa" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>



            </div>
        </DashboardLayout>

    );
}
