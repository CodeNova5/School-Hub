"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Users, TrendingUp, TrendingDown, Award, } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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

    // NEW STATES
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
    }, []);

    async function loadInitial() {
        setIsLoading(true);

        const { data: sessionData } = await supabase.from("sessions").select("*").order("name");
        const { data: termData } = await supabase.from("terms").select("*").order("name");
        const { data: subjectClass } = await supabase
            .from("subject_classes")
            .select(`id, subject_code,  subject:subjects ( id, name ), class:classes ( id, name, level)`)
            .eq("id", subjectClassId)
            .single();

        setSubject(subjectClass);

        setSessions(sessionData || []);
        setTerms(termData || []);
        setSubject(subjectClass || null);

        const currentSession = sessionData?.find((s) => s.is_current);
        const currentTerm = termData?.find((t) => t.is_current);

        setSelectedSession(currentSession?.id || "");
        setSelectedTerm(currentTerm?.id || "");

        loadResults(subjectClassId, currentSession?.id, currentTerm?.id);
        await loadGenderComparison(subjectClassId);


    }

    async function loadStudentBreakdown(subjectClassId: string, sessionId: string, termId: string) {
        const { data } = await supabase
            .from("results")
            .select(`
            *,
            students (first_name, last_name, student_id, gender, photo_url)
        `)
            .eq("subject_class_id", subjectClassId)
            .eq("session_id", sessionId)
            .eq("term_id", termId);

        if (!data) return;

        // Sort highest → lowest
        const sorted = data
            .map((r: any) => ({
                id: r.id,
                name: `${r.students.first_name} ${r.students.last_name}`,
                student_id: r.students.student_id,
                photo_url: r.students.photo_url,
                gender: r.students.gender,
                welcome_test: r.welcome_test ?? 0,
                mid_term: r.mid_term_test ?? 0,
                vetting: r.vetting ?? 0,
                exams: r.exam ?? 0,
                total: r.total ?? 0,
                grade: r.grade,
            }))
            .sort((a: any, b: any) => b.total - a.total);

        setStudentBreakdown(sorted);
    }


    async function loadResults(subjectClassId: string, sessionId?: string, termId?: string) {
        let query: any = supabase
            .from("results")
            .select(`*, students(first_name, last_name, student_id, gender, photo_url)`)
            .eq("subject_class_id", subjectClassId);

        if (sessionId) query = query.eq("session_id", sessionId);
        if (termId) query = query.eq("term_id", termId);

        const { data } = await query;
        setResults(data || []);

        // ⭐ NEW: LOAD SESSION TREND (average score across sessions)
        const { data: allSessions } = await supabase
            .from("results")
            .select(`session_id, total, sessions(name)`)
            .eq("subject_class_id", subjectClassId);

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
                .eq("subject_class_id", subjectClassId)
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
                .eq("subject_class_id", subjectClassId)
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
        if (sessionId && termId) {
            await loadStudentBreakdown(subjectClassId, sessionId, termId);
        }

        setIsLoading(false);
    }

    async function loadGenderComparison(subjectClassId: string) {
        const { data } = await supabase
            .from("results")
            .select(`
            total,
            students (gender)
        `)
            .eq("subject_class_id", subjectClassId);

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
                                        <th className="p-2 text-left">Welcome</th>
                                        <th className="p-2 text-left">Mid-Term</th>
                                        <th className="p-2 text-left">Vetting</th>
                                        <th className="p-2 text-left">Exams</th>
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
                                                <td className="p-2">{s.welcome_test}</td>
                                                <td className="p-2">{s.mid_term}</td>
                                                <td className="p-2">{s.vetting}</td>
                                                <td className="p-2">{s.exams}</td>
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
