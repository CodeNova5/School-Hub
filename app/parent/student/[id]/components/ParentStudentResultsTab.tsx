"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import ResultEntry from "@/components/ResultEntry";

interface PublicationLookup {
    [key: string]: boolean;
}
import {
    TrendingUp,
    Award,
    BookOpen,
    BarChart
} from "lucide-react";

interface Result {
    id: string;
    subject_class_id: string;
    term_id: string;
    session_id: string;
    exam: number;
    total: number;
    grade: string;
    remark: string;
    position: number | null;
    subject_classes?: {
        subjects: {
            name: string;
        };
        class_id: string;
    };
    terms?: {
        name: string;
    };
    sessions?: {
        name: string;
    };
}

interface ParentStudentResultsTabProps {
    studentId: string;
}

export default function ParentStudentResultsTab({ studentId }: ParentStudentResultsTabProps) {
    const [results, setResults] = useState<Result[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState("");
    const [selectedTerm, setSelectedTerm] = useState("");
    const [sessions, setSessions] = useState<any[]>([]);
    const [terms, setTerms] = useState<any[]>([]);
    const [parentVisibility, setParentVisibility] = useState<PublicationLookup>({});
    const [allTerms, setAllTerms] = useState<any[]>([]); // Store all terms for filtering

    useEffect(() => {
        loadData();
    }, [studentId]);

    // Auto-assign session and term based on the active one
    useEffect(() => {
        if (sessions.length > 0) {
            // Prefer is_current, fallback to is_active
            const currentSession = sessions.find((s) => s.is_current) || sessions.find((s) => s.is_active);
            if (currentSession) setSelectedSession(currentSession.id);
        }
    }, [sessions]);

    useEffect(() => {
        if (terms.length > 0) {
            // Prefer is_current, fallback to is_active
            const currentTerm = terms.find((t) => t.is_current) || terms.find((t) => t.is_active);
            if (currentTerm) setSelectedTerm(currentTerm.id);
        }
    }, [terms]);

    async function loadData() {
        setIsLoading(true);
        try {
            // Get sessions and all terms
            const [sessionsRes, termsRes] = await Promise.all([
                supabase.from("sessions").select("*").order("name", { ascending: false }),
                supabase.from("terms").select("*").order("start_date", { ascending: false }),
            ]);

            setSessions(sessionsRes.data || []);
            setAllTerms(termsRes.data || []);

            // Get results
                        const { data: resultsData, error } = await supabase
                                .from("results")
                                .select(`
                    *,
                    subject_classes!inner(
                        class_id,
                        subjects(name)
                    ),
                    terms(name, session_id, is_current),
                    sessions(name, is_current)
                `)
                                .eq("student_id", studentId)
                                .order("created_at", { ascending: false });

            if (error) throw error;
            setResults(resultsData || []);

            // Get all unique class_id, session_id, term_id combinations from results
            const uniqueKeys = new Set<string>();
            (resultsData || []).forEach((r: any) => {
                if (r.subject_classes && r.session_id && r.term_id) {
                    uniqueKeys.add(`${r.subject_classes.class_id}|${r.session_id}|${r.term_id}`);
                }
            });
            const keysArr = Array.from(uniqueKeys);
            // Prepare filters for publication query
            let pubFilters = [];
            keysArr.forEach(key => {
                const [class_id, session_id, term_id] = key.split("|");
                pubFilters.push({ class_id, session_id, term_id });
            });
            let publicationRows: any[] = [];
            if (pubFilters.length > 0) {
                // Supabase doesn't support or() with objects, so fetch all and filter in JS
                const { data: pubs } = await supabase
                    .from("results_publication")
                    .select("class_id, session_id, term_id, is_published_to_parents");
                if (pubs) {
                    publicationRows = pubs;
                }
            }
            // Build lookup
            const pubLookup: PublicationLookup = {};
            publicationRows.forEach(row => {
                pubLookup[`${row.class_id}|${row.session_id}|${row.term_id}`] = !!row.is_published_to_parents;
            });
            setParentVisibility(pubLookup);

            // Filter terms for selected session
            // If selectedSession is not set yet, fallback to is_current or is_active session
            let sessionId = selectedSession;
            if (!sessionId && sessionsRes.data) {
                const currentSession = sessionsRes.data.find((s: any) => s.is_current) || sessionsRes.data.find((s: any) => s.is_active);
                if (currentSession) sessionId = currentSession.id;
            }
            // Only show terms for the selected session
            const filteredTerms = (termsRes.data || []).filter((t: any) => t.session_id === sessionId);
            setTerms(filteredTerms);
        } catch (error: any) {
            toast.error("Failed to load results: " + error.message);
        } finally {
            setIsLoading(false);
        }
    }

    if (isLoading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center h-64">
                        <p className="text-gray-500">Loading results...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const filteredResults = results.filter((r) => {
        if (selectedSession && r.session_id !== selectedSession) return false;
        if (selectedTerm && r.term_id !== selectedTerm) return false;
        // Check parent visibility from publication table
        const classId = r.subject_classes?.class_id;
        if (!classId) return false;
        const pubKey = `${classId}|${r.session_id}|${r.term_id}`;
        if (!parentVisibility[pubKey]) return false;
        return true;
    });

    const averageScore = filteredResults.length === 0 ? 0 :
        Math.round(filteredResults.reduce((sum, r) => sum + r.total, 0) / filteredResults.length);

    const passedSubjects = filteredResults.filter(r => r.total >= 40).length;
    const failedSubjects = filteredResults.filter(r => r.total < 40).length;

    return (

        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Filter Results</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium mb-2">Session</label>
                            <select
                                value={selectedSession}
                                onChange={e => {
                                    setSelectedSession(e.target.value);
                                    // When session changes, update terms to only those for that session
                                    const filteredTerms = allTerms.filter((t: any) => t.session_id === e.target.value);
                                    setTerms(filteredTerms);
                                    // Auto-select is_current term for new session
                                    const currentTerm = filteredTerms.find((t: any) => t.is_current);
                                    setSelectedTerm(currentTerm ? currentTerm.id : "");
                                }}
                                className="w-full px-3 py-2 border rounded-md"
                            >
                                <option value="">All Sessions</option>
                                {sessions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Term</label>
                            <select
                                value={selectedTerm}
                                onChange={(e) => setSelectedTerm(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md"
                            >
                                <option value="">All Terms</option>
                                {terms.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* ...existing code... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                        <BarChart className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{averageScore}%</div>
                    </CardContent>
                </Card>
                {/* ...existing code... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
                        <BookOpen className="h-4 w-4 text-gray-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredResults.length}</div>
                    </CardContent>
                </Card>
                {/* ...existing code... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Passed</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{passedSubjects}</div>
                    </CardContent>
                </Card>
                {/* ...existing code... */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                        <Award className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{failedSubjects}</div>
                    </CardContent>
                </Card>
            </div>

            {filteredResults.length > 0 && selectedSession && selectedTerm ? (
                <ResultEntry
                    studentId={studentId}
                    role="parent"
                    canEditPrincipalComment={false}
                    canEdit={false}
                    isReadOnly={true}
                    sessionId={selectedSession}
                    termId={selectedTerm}
                />
            ) : (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center">
                            <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">
                                {!selectedSession || !selectedTerm 
                                    ? "Please select a session and term to view results" 
                                    : "No published results found"}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
