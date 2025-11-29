"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Loader2, Users, TrendingUp, TrendingDown, Award, BookOpen, } from "lucide-react";
import { AvatarImage } from "@/components/ui/avatar";
export default function SubjectAnalyticsPage({ params }: any) {
    const subjectId = params.id;

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
    const [highestPerTerm, setHighestPerTerm] = useState<any[]>([]);
    // NEW STATES
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [topStudentsPerTerm, setTopStudentsPerTerm] = useState<any[]>([]);
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
    }, []);

    async function loadInitial() {
        setIsLoading(true);

        const { data: sessionData } = await supabase.from("sessions").select("*").order("name");
        const { data: termData } = await supabase.from("terms").select("*").order("name");
        const { data: subjectData } = await supabase.from("subjects").select("*").eq("id", subjectId).single();

        setSessions(sessionData || []);
        setTerms(termData || []);
        setSubject(subjectData || null);

        const currentSession = sessionData?.find((s) => s.is_current);
        const currentTerm = termData?.find((t) => t.is_current);

        setSelectedSession(currentSession?.id || "");
        setSelectedTerm(currentTerm?.id || "");

        loadResults(subjectId, currentSession?.id, currentTerm?.id);
        await loadHistoricalPerformance(subjectId);
        await loadTopStudentsPerTerm(subjectId);
        await loadGenderComparison(subjectId);

    }

    async function loadResults(subId: string, sessionId?: string, termId?: string) {
        let query: any = supabase
            .from("results")
            .select(`*, students(first_name, last_name, student_id, gender)`)
            .eq("subject_id", subId);

        if (sessionId) query = query.eq("session_id", sessionId);
        if (termId) query = query.eq("term_id", termId);

        const { data } = await query;
        setResults(data || []);

        // ⭐ NEW: LOAD SESSION TREND (average score across sessions)
        const { data: allSessions } = await supabase
            .from("results")
            .select(`session_id, total, sessions(name)`)
            .eq("subject_id", subId);

        const grouped = allSessions?.reduce((acc: any, r: any) => {
            if (!acc[r.session_id]) acc[r.session_id] = { name: r.sessions.name, scores: [] };
            acc[r.session_id].scores.push(r.total);
            return acc;
        }, {});

        setSessionTrend(
            Object.values(grouped || {}).map((g: any) => ({
                session: g.name,
                avg: (g.scores.reduce((a: number, b: number) => a + b, 0) / g.scores.length).toFixed(1),
            }))
        );

        // ⭐ NEW: HIGHEST SCORING STUDENT IN EACH TERM
        if (sessionId) {
            const { data: termResults } = await supabase
                .from("results")
                .select(`*, terms(name), students(first_name, last_name, student_id)`)
                .eq("subject_id", subId)
                .eq("session_id", sessionId);

            const byTerm: any = {};
            termResults?.forEach((r: any) => {
                if (!byTerm[r.term_id] || r.total > byTerm[r.term_id].total) {
                    byTerm[r.term_id] = r;
                }
            });

            setHighestPerTerm(Object.values(byTerm));
        }

        // ⭐ NEW: TERM TREND WITHIN SELECTED SESSION
        if (sessionId) {
            const { data: termData } = await supabase
                .from("results")
                .select(`term_id, total, terms(name)`)
                .eq("subject_id", subId)
                .eq("session_id", sessionId);

            const groupedTerms = termData?.reduce((acc: any, r: any) => {
                if (!acc[r.term_id]) acc[r.term_id] = { name: r.terms.name, scores: [] };
                acc[r.term_id].scores.push(r.total);
                return acc;
            }, {});

            setTermTrend(
                Object.values(groupedTerms || {}).map((g: any) => ({
                    term: g.name,
                    avg: (g.scores.reduce((a: number, b: number) => a + b, 0) / g.scores.length).toFixed(1),
                }))
            );
        }

        // ⭐ NEW: MALE vs FEMALE PERFORMANCE
        const males = (data || []).filter((r: any) => r.students?.gender?.toLowerCase() === "male");
        const females = (data || []).filter((r: any) => r.students?.gender?.toLowerCase() === "female");

        setGenderStats({
            male: males.length ? (males.reduce((a: any, b: any) => a + b.total, 0) / males.length).toFixed(1) : 0,
            female: females.length ? (females.reduce((a: any, b: any) => a + b.total, 0) / females.length).toFixed(1) : 0,
        });

        setIsLoading(false);
    }

    async function loadHistoricalPerformance(subId: string) {
        const { data } = await supabase
            .from("results")
            .select(`
            total,
            sessions (id, name)
        `)
            .eq("subject_id", subId);

        if (!data) return;

        const map: Record<string, number[]> = {};

        data.forEach((r: any) => {
            const sessionName = r.sessions?.name;
            if (!sessionName) return;

            if (!map[sessionName]) map[sessionName] = [];
            map[sessionName].push(r.total);
        });

        const formatted = Object.keys(map).map((session) => ({
            session,
            avg: (map[session].reduce((a, b) => a + b, 0) / map[session].length).toFixed(1),
        }));

        setHistoryData(formatted);
    }

    async function loadTopStudentsPerTerm(subId: string) {
        const { data } = await supabase
            .from("results")
            .select(`
            id,
            total,
            term_id,
            terms (name),
            students (first_name, last_name, student_id)
        `)
            .eq("subject_id", subId);

        if (!data) return;

        const map: Record<string, any> = {}; // term_id → top result

        data.forEach((r: any) => {
            const termId = r.term_id;
            if (!map[termId] || r.total > map[termId].total) {
                map[termId] = r;
            }
        });

        const formatted = Object.values(map).map((r: any) => ({
            term_id: r.term_id,
            term_name: r.terms?.name,
            name: `${r.students.first_name} ${r.students.last_name}`,
            student_id: r.students.student_id,
            total: r.total,
        }));

        setTopStudentsPerTerm(formatted);
    }

    async function loadGenderComparison(subId: string) {
        const { data } = await supabase
            .from("results")
            .select(`
            total,
            students (gender)
        `)
            .eq("subject_id", subId);

        if (!data) return;

        const males: number[] = [];
        const females: number[] = [];

        data.forEach((r: any) => {
            const gender = r.students?.gender?.toLowerCase();

            if (gender === "male") males.push(r.total);
            if (gender === "female") females.push(r.total);
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

    return (
        <DashboardLayout role="teacher">
            <div className="space-y-8">

                {/* HEADER */}
                <h1 className="text-3xl font-bold">Subject Analytics</h1>
                <p className="text-gray-600">Detailed performance report for: {subject?.name}</p>

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
                                loadResults(subjectId, val, selectedTerm);
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
                                loadResults(subjectId, selectedSession, val);
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

                {/* 3. ASSESSMENT COMPONENT BREAKDOWN */}
                <Card>
                    <CardHeader>
                        <CardTitle>Assessment Component Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={[
                                    { name: "Welcome Test", avg: results.length ? (results.reduce((a, b) => a + b.welcome_test, 0) / results.length).toFixed(1) : 0 },
                                    { name: "Mid Term", avg: results.length ? (results.reduce((a, b) => a + b.mid_term_test, 0) / results.length).toFixed(1) : 0 },
                                    { name: "Vetting", avg: results.length ? (results.reduce((a, b) => a + b.vetting, 0) / results.length).toFixed(1) : 0 },
                                    { name: "Exams", avg: results.length ? (results.reduce((a, b) => a + b.exam, 0) / results.length).toFixed(1) : 0 },
                                ]}
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

                {/* 5. TOP PERFORMING STUDENTS */}
                <Card>
                    <CardHeader>
                        <CardTitle>Top Performing Students</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results.length === 0 ? (
                            <p className="text-gray-500">No results found.</p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-2 text-left">Student</th>
                                            <th className="p-2 text-left">Score</th>
                                            <th className="p-2 text-left">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results
                                            .sort((a, b) => b.total - a.total)
                                            .slice(0, 10)
                                            .map((r) => (


                                                <tr key={r.id} className="border-t">
                                                    <td className="p-2 flex items-center gap-3">
                                                        <span className="w-6 text-sm text-right text-gray-600">
                                                            {results.filter(s => s.total > r.total).length + 1}.
                                                        </span>

                                                        <AvatarImage src={r.students.photo_url} />

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
                                                        <img
                                                            src={
                                                                r.students.photo_url ||
                                                                (r.students.gender
                                                                    ? r.students.gender.toLowerCase() === "male"
                                                                        ? "/images/male-avatar.jpg"
                                                                        : "/images/female-avatar.jpg"
                                                                    : "/images/default-avatar.png")
                                                            }
                                                            alt={`${r.students.first_name} ${r.students.last_name}`}
                                                            className="h-8 w-8 rounded-full object-cover"
                                                        />
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

                {/* 7. HISTORICAL PERFORMANCE OVER SESSIONS */}
                <Card>
                    <CardHeader>
                        <CardTitle>Historical Performance (All Sessions)</CardTitle>
                        <p className="text-gray-500 text-sm">Average student performance across past sessions</p>
                    </CardHeader>

                    <CardContent>
                        {historyData.length === 0 ? (
                            <p className="text-gray-500">No historical records found.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={historyData}>
                                    <XAxis dataKey="session" />
                                    <YAxis />
                                    <Tooltip />
                                    <BarChart />
                                    <Bar dataKey="avg" fill="#3b82f6" />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* 8. HIGHEST SCORING STUDENT PER TERM */}
                <Card>
                    <CardHeader>
                        <CardTitle>Highest Scoring Student Per Term</CardTitle>
                        <p className="text-gray-500 text-sm">Top performer for each term historically</p>
                    </CardHeader>

                    <CardContent>
                        {topStudentsPerTerm.length === 0 ? (
                            <p className="text-gray-500">No data found.</p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-2 text-left">Term</th>
                                            <th className="p-2 text-left">Student</th>
                                            <th className="p-2 text-left">Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topStudentsPerTerm.map((t: any) => (
                                            <tr key={t.term_id} className="border-t">
                                                <td className="p-2">{t.term_name}</td>
                                                <td className="p-2">{t.name} ({t.student_id})</td>
                                                <td className="p-2">{t.total}</td>
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
