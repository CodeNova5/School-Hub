"use client";

import { useEffect, useMemo, useState } from "react";
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
    Download,
    Eye,
    MoreVertical,
    FileText,
    TrendingUp,
    TrendingDown,
    Minus,
} from "lucide-react";

import * as XLSX from "xlsx-js-style";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

import { Student, Session, Term } from "@/lib/types";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { ResultsPublicationDialog } from "@/components/ResultsPublicationDialog";

/* ======================================================
   TYPES
====================================================== */

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

    average_grade: string;
    class_position: number | null;

    has_results: boolean;
}

interface ResultsTabProps {
    classId: string;
    className: string;
    students: Student[];
}

/* ======================================================
   COMPONENT
====================================================== */

export function ResultsTab({ classId, className, students }: ResultsTabProps) {
    /* ================= STATE ================= */

    const [sessions, setSessions] = useState<Session[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);

    const [selectedSessionId, setSelectedSessionId] = useState("");
    const [selectedTermId, setSelectedTermId] = useState("");

    const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState("");
    const [genderFilter, setGenderFilter] = useState("all");
    const [performanceFilter, setPerformanceFilter] = useState("all");

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
    const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);

    /* ================= EFFECTS ================= */

    useEffect(() => {
        fetchSessionsAndTerms();
    }, []);

    useEffect(() => {
        if (selectedSessionId && selectedTermId) {
            fetchStudentResults();
        }
    }, [selectedSessionId, selectedTermId]);

    /* ======================================================
       DATA FETCHING
    ====================================================== */

    async function fetchSessionsAndTerms() {
        try {
            const [{ data: s }, { data: t }] = await Promise.all([
                supabase.from("sessions").select("*"),
                supabase.from("terms").select("*"),
            ]);

            setSessions(s || []);
            setTerms(t || []);

            setSelectedSessionId(s?.find((x) => x.is_current)?.id ?? "");
            setSelectedTermId(t?.find((x) => x.is_current)?.id ?? "");
        } catch {
            toast.error("Failed to load sessions/terms");
        }
    }

    async function fetchStudentResults() {
        setLoading(true);

        try {
            const { data } = await supabase
                .from("results")
                .select(
                    `
                    total,
                    grade,
                    class_position,
                    student:students!inner(id, student_id, first_name, last_name, gender),
                    subject_class:subject_classes!inner(class_id)
                `
                )
                .eq("term_id", selectedTermId)
                .eq("session_id", selectedSessionId);

            const classResults =
                data?.filter((r) => r.subject_class?.[0]?.class_id === classId) ?? [];

            const map = new Map<string, StudentResult>();

            /* init students */
            students.forEach((s) => {
                map.set(s.id, {
                    student_id: s.id,
                    student_name: `${s.first_name} ${s.last_name}`,
                    student_number: s.student_id,
                    gender: s.gender,

                    total_subjects: 0,
                    total_score: 0,
                    average_score: 0,
                    highest_score: 0,
                    lowest_score: 100,
                    average_grade: "",
                    class_position: null,
                    has_results: false,
                });
            });

            /* aggregate */
            classResults.forEach((r: any) => {
                const st = map.get(r.student.id);
                if (!st) return;

                st.has_results = true;
                st.total_subjects++;
                st.total_score += r.total;

                st.highest_score = Math.max(st.highest_score, r.total);
                st.lowest_score = Math.min(st.lowest_score, r.total);

                if (r.class_position) st.class_position = r.class_position;
            });

            const results = Array.from(map.values()).map((r) => {
                if (r.total_subjects) {
                    r.average_score = r.total_score / r.total_subjects;
                    r.average_grade = calculateGrade(r.average_score);
                }
                return r;
            });

            results.sort((a, b) => b.average_score - a.average_score);

            setStudentResults(results);
        } catch {
            toast.error("Failed to load results");
        } finally {
            setLoading(false);
        }
    }

    /* ======================================================
       HELPERS
    ====================================================== */

    function calculateGrade(score: number) {
        if (score >= 75) return "A1";
        if (score >= 70) return "B2";
        if (score >= 65) return "B3";
        if (score >= 60) return "C4";
        if (score >= 55) return "C5";
        if (score >= 50) return "C6";
        if (score >= 45) return "D7";
        if (score >= 40) return "E8";
        return "F9";
    }

    function getPerformance(score: number) {
        if (score >= 70) return { icon: TrendingUp, label: "Excellent" };
        if (score >= 60) return { icon: TrendingUp, label: "Good" };
        if (score >= 50) return { icon: Minus, label: "Average" };
        return { icon: TrendingDown, label: "Poor" };
    }

    /* ======================================================
       FILTERING
    ====================================================== */

    const filteredResults = useMemo(() => {
        return studentResults.filter((r) => {
            if (search && !r.student_name.toLowerCase().includes(search.toLowerCase()))
                return false;

            if (genderFilter !== "all" && r.gender !== genderFilter) return false;

            if (performanceFilter === "excellent" && r.average_score < 70) return false;
            if (performanceFilter === "good" && (r.average_score < 60 || r.average_score >= 70)) return false;
            if (performanceFilter === "average" && (r.average_score < 50 || r.average_score >= 60)) return false;
            if (performanceFilter === "poor" && r.average_score >= 50) return false;

            return true;
        });
    }, [studentResults, search, genderFilter, performanceFilter]);

    /* ======================================================
       EXPORT
    ====================================================== */

    function handleExport() {
        const sheet = XLSX.utils.json_to_sheet(filteredResults);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, "Results");
        XLSX.writeFile(wb, `${className}-results.xlsx`);
        toast.success("Exported");
    }

    /* ======================================================
       RENDER
    ====================================================== */

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between">
                <CardTitle>Class Results</CardTitle>

                <div className="flex gap-2">
                    <Button onClick={() => setIsPublicationDialogOpen(true)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Publish
                    </Button>

                    <Button variant="outline" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4" />
                    <Input
                        className="pl-9"
                        placeholder="Search students..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* table */}
                {loading ? (
                    <p className="text-center py-8">Loading...</p>
                ) : (
                    <table className="w-full text-sm border rounded-md">
                        <tbody>
                            {filteredResults.map((r, i) => {
                                const Perf = getPerformance(r.average_score).icon;

                                return (
                                    <tr key={r.student_id} className="border-t">
                                        <td className="p-3">{i + 1}</td>
                                        <td className="p-3">{r.student_name}</td>
                                        <td className="p-3 text-center">{r.average_score.toFixed(1)}%</td>
                                        <td className="p-3 text-center">
                                            <Perf className="w-4 h-4 inline" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </CardContent>

            <StudentDetailsModal
                student={selectedStudent}
                sessions={sessions}
                terms={terms}
                isOpen={isStudentDetailsOpen}
                onClose={() => setIsStudentDetailsOpen(false)}
            />

            <ResultsPublicationDialog
                isOpen={isPublicationDialogOpen}
                onClose={() => setIsPublicationDialogOpen(false)}
                classId={classId}
                className={className}
                sessionId={selectedSessionId}
                termId={selectedTermId}
                onPublish={fetchStudentResults}
            />
        </Card>
    );
}
