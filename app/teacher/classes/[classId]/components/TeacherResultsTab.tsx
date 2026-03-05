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
    Calculator,
} from "lucide-react";
import { toast } from "sonner";
import { Student, Session, Term } from "@/lib/types";
import * as XLSX from "xlsx-js-style";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { ResultsPublicationDialog } from "@/components/ResultsPublicationDialog";
import { supabase } from "@/lib/supabase";

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
    is_complete: boolean; // has all 3 terms
}

interface ResultsTabProps {
    classId: string;
    className: string;
    students: Student[];
    schoolId?: string | null;
}

export default function ResultsTab({ classId, className, students, schoolId }: ResultsTabProps) {

    const [sessions, setSessions] = useState<Session[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [selectedTermId, setSelectedTermId] = useState<string>("");
    const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
    const [cumulativeResults, setCumulativeResults] = useState<CumulativeResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCumulative, setShowCumulative] = useState(false);
    const [isLastTerm, setIsLastTerm] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
    const [performanceFilter, setPerformanceFilter] = useState<
        "all" | "excellent" | "good" | "average" | "poor"
    >("all");

    // Modal state
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
    const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);
    useEffect(() => {
        fetchSessionsAndTerms();
    }, []);

    useEffect(() => {
        if (selectedSessionId && selectedTermId) {
            fetchStudentResults();
            
            // Check if this is the last term
            const sessionTerms = terms.filter(t => t.session_id === selectedSessionId);
            const sortedTerms = sessionTerms.sort((a, b) => a.name.localeCompare(b.name));
            const lastTerm = sortedTerms[sortedTerms.length - 1];
            const isLast = lastTerm?.id === selectedTermId;
            setIsLastTerm(isLast);
            
            // Fetch cumulative results if it's the last term
            if (isLast && sessionTerms.length > 0) {
                fetchCumulativeResults();
            }
        }
    }, [selectedSessionId, selectedTermId, students, terms]);

    // When session changes, reset term selection or auto-select first term of new session
    useEffect(() => {
        if (selectedSessionId) {
            const sessionTerms = terms.filter(t => t.session_id === selectedSessionId);
            if (sessionTerms.length > 0) {
                // Auto-select first term or current term of the selected session
                const currentTerm = sessionTerms.find(t => t.is_current);
                setSelectedTermId(currentTerm?.id || sessionTerms[0].id);
            } else {
                setSelectedTermId("");
            }
        }
    }, [selectedSessionId, terms]);

    async function fetchSessionsAndTerms() {
        try {
            // Fetch sessions
            let sessionsQuery = supabase
                .from("sessions")
                .select("*");

            if (schoolId) {
                sessionsQuery = sessionsQuery.eq("school_id", schoolId);
            }

            const { data: sessionsData, error: sessionsError } = await sessionsQuery;
            if (sessionsError) throw sessionsError;

            // Fetch terms
            let termsQuery = supabase
                .from("terms")
                .select("*");

            if (schoolId) {
                termsQuery = termsQuery.eq("school_id", schoolId);
            }

            const { data: termsData, error: termsError } = await termsQuery;
            if (termsError) throw termsError;

            setSessions(sessionsData || []);
            setTerms(termsData || []);

            // Auto-select current session and term if available
            const currentSession = sessionsData?.find((s: any) => s.is_current);
            const currentTerm = termsData?.find((t: any) => t.is_current);

            if (currentSession) setSelectedSessionId(currentSession.id);
            if (currentTerm) setSelectedTermId(currentTerm.id);
        } catch (error) {
            console.error("Error fetching sessions and terms:", error);
            toast.error("Failed to load sessions and terms");
        }
    }

    async function fetchStudentResults() {
        setLoading(true);

        try {
            // Get list of current student IDs in this class
            const currentStudentIds = students.map(s => s.id);
            
            if (currentStudentIds.length === 0) {
                setStudentResults([]);
                setLoading(false);
                return;
            }

            // Get subject_class_ids for this class to filter results correctly
            let scQuery = supabase
                .from("subject_classes")
                .select("id")
                .eq("class_id", classId);

            if (schoolId) {
                scQuery = scQuery.eq("school_id", schoolId);
            }

            const { data: subjectClasses, error: scError } = await scQuery;

            if (scError) throw scError;

            const subjectClassIds = subjectClasses?.map((sc: any) => sc.id) || [];

            if (subjectClassIds.length === 0) {
                setStudentResults([]);
                setLoading(false);
                return;
            }

            // Fetch results for each student - filtered by this class's subject_classes
            let resultsQuery = supabase
                .from("results")
                .select("*")
                .eq("term_id", selectedTermId)
                .eq("session_id", selectedSessionId)
                .in("student_id", currentStudentIds)
                .in("subject_class_id", subjectClassIds);

            if (schoolId) {
                resultsQuery = resultsQuery.eq("school_id", schoolId);
            }

            const { data: resultsData, error: resultsError } = await resultsQuery;

            if (resultsError) {
                console.error("Error fetching results:", resultsError);
                throw resultsError;
            }

            // Group results by student
            const studentResultsMap = new Map<string, StudentResult>();

            // Initialize all students
            students.forEach((student) => {
                studentResultsMap.set(student.id, {
                    student_id: student.id,
                    student_name: `${student.first_name} ${student.last_name}`,
                    student_number: student.student_id,
                    gender: student.gender,
                    total_subjects: 0,
                    total_score: 0,
                    average_score: 0,
                    highest_score: 0,
                    lowest_score: 100,
                    grade: { A1: 0, B2: 0, B3: 0, C4: 0, C5: 0, C6: 0, D7: 0, E8: 0, F9: 0 },
                    average_grade: "",
                    class_position: null,
                    has_results: false,
                });
            });

            // Process results
            (resultsData || []).forEach((result: any) => {
                const studentResult = studentResultsMap.get(result.student_id);

                if (!studentResult) {
                    return;
                }

                studentResult.has_results = true;
                studentResult.total_subjects += 1;
                studentResult.total_score += result.total || 0;

                if (result.total > studentResult.highest_score) {
                    studentResult.highest_score = result.total;
                }
                if (result.total < studentResult.lowest_score) {
                    studentResult.lowest_score = result.total;
                }

                // Count grades
                const grade = result.grade?.toUpperCase();
                if (grade && grade in studentResult.grade) {
                    studentResult.grade[grade as keyof typeof studentResult.grade] += 1;
                }

                // Store class position if available (from first result)
                if (result.class_position && !studentResult.class_position) {
                    studentResult.class_position = result.class_position;
                }
            });

            // Calculate averages
            const results = Array.from(studentResultsMap.values()).map((result) => {
                if (result.total_subjects > 0) {
                    result.average_score = result.total_score / result.total_subjects;
                    result.average_grade = calculateAverageGrade(result.average_score);
                }
                if (!result.has_results) {
                    result.lowest_score = 0;
                }
                return result;
            });

            // Sort by average score (descending)
            results.sort((a, b) => b.average_score - a.average_score);

            setStudentResults(results);
        } catch (error) {
            console.error("Error processing results:", error);
            toast.error("Failed to process results");
        } finally {
            setLoading(false);
        }
    }

    async function fetchCumulativeResults() {
        try {
            const currentStudentIds = students.map(s => s.id);
            
            if (currentStudentIds.length === 0) {
                setCumulativeResults([]);
                return;
            }

            // Get all terms for this session
            const sessionTerms = terms
                .filter(t => t.session_id === selectedSessionId)
                .sort((a, b) => a.name.localeCompare(b.name));

            if (sessionTerms.length === 0) {
                setCumulativeResults([]);
                return;
            }

            // Get subject_classes for this class to filter results
            let scQuery = supabase
                .from("subject_classes")
                .select("id")
                .eq("class_id", classId);

            if (schoolId) {
                scQuery = scQuery.eq("school_id", schoolId);
            }

            const { data: subjectClasses, error: scError } = await scQuery;

            if (scError) throw scError;

            const subjectClassIds = subjectClasses?.map((sc: any) => sc.id) || [];

            if (subjectClassIds.length === 0) {
                setCumulativeResults([]);
                return;
            }

            // Fetch results for all terms in this session for this class only
            let sessionResultsQuery = supabase
                .from("results")
                .select("*")
                .eq("session_id", selectedSessionId)
                .in("student_id", currentStudentIds)
                .in("subject_class_id", subjectClassIds);

            if (schoolId) {
                sessionResultsQuery = sessionResultsQuery.eq("school_id", schoolId);
            }

            const { data: allSessionResults, error } = await sessionResultsQuery;

            if (error) throw error;

            // Process cumulative results per student
            const cumulativeMap = new Map<string, CumulativeResult>();

            students.forEach((student) => {
                cumulativeMap.set(student.id, {
                    student_id: student.id,
                    student_name: `${student.first_name} ${student.last_name}`,
                    student_number: student.student_id,
                    gender: student.gender,
                    terms_with_results: 0,
                    term_averages: [],
                    cumulative_average: 0,
                    cumulative_grade: "",
                    cumulative_position: null,
                    is_complete: false,
                });
            });

            // Group results by student and term
            const studentTermResults = new Map<string, Map<string, any[]>>();

            (allSessionResults || []).forEach((result: any) => {
                if (!studentTermResults.has(result.student_id)) {
                    studentTermResults.set(result.student_id, new Map());
                }
                const termMap = studentTermResults.get(result.student_id)!;
                if (!termMap.has(result.term_id)) {
                    termMap.set(result.term_id, []);
                }
                termMap.get(result.term_id)!.push(result);
            });

            // Calculate cumulative averages
            studentTermResults.forEach((termMap, studentId) => {
                const cumulativeResult = cumulativeMap.get(studentId)!;
                let totalAverage = 0;
                let termsCount = 0;

                sessionTerms.forEach((term) => {
                    const termResults = termMap.get(term.id);
                    if (termResults && termResults.length > 0) {
                        // Calculate average for this term
                        const termTotal = termResults.reduce((sum, r) => sum + (r.total || 0), 0);
                        const termAverage = termTotal / termResults.length;
                        
                        cumulativeResult.term_averages.push({
                            term_name: term.name,
                            average: termAverage,
                        });

                        totalAverage += termAverage;
                        termsCount++;
                    } else {
                        cumulativeResult.term_averages.push({
                            term_name: term.name,
                            average: 0,
                        });
                    }
                });

                cumulativeResult.terms_with_results = termsCount;
                if (termsCount > 0) {
                    cumulativeResult.cumulative_average = totalAverage / termsCount;
                    cumulativeResult.cumulative_grade = calculateAverageGrade(cumulativeResult.cumulative_average);
                }
                cumulativeResult.is_complete = termsCount === sessionTerms.length;
            });

            // Convert to array and sort by cumulative average
            const results = Array.from(cumulativeMap.values())
                .filter(r => r.terms_with_results > 0) // Only include students with at least one term result
                .sort((a, b) => b.cumulative_average - a.cumulative_average);

            // Assign positions
            results.forEach((result, index) => {
                if (index > 0 && Math.abs(result.cumulative_average - results[index - 1].cumulative_average) < 0.01) {
                    // Same position as previous (tie)
                    result.cumulative_position = results[index - 1].cumulative_position;
                } else {
                    result.cumulative_position = index + 1;
                }
            });

            setCumulativeResults(results);
        } catch (error) {
            console.error("Error fetching cumulative results:", error);
            toast.error("Failed to fetch cumulative results");
        }
    }

    const filteredResults = useMemo(() => {
        return studentResults.filter((result) => {
            if (
                search &&
                !result.student_name.toLowerCase().includes(search.toLowerCase()) &&
                !result.student_number.toLowerCase().includes(search.toLowerCase())
            ) {
                return false;
            }

            if (genderFilter !== "all" && result.gender !== genderFilter) {
                return false;
            }

            if (performanceFilter !== "all") {
                const avg = result.average_score;
                if (performanceFilter === "excellent" && avg < 70) return false;
                if (performanceFilter === "good" && (avg < 60 || avg >= 70)) return false;
                if (performanceFilter === "average" && (avg < 50 || avg >= 60)) return false;
                if (performanceFilter === "poor" && avg >= 50) return false;
            }

            return true;
        });
    }, [studentResults, search, genderFilter, performanceFilter]);

    const filteredCumulativeResults = useMemo(() => {
        return cumulativeResults.filter((result) => {
            if (
                search &&
                !result.student_name.toLowerCase().includes(search.toLowerCase()) &&
                !result.student_number.toLowerCase().includes(search.toLowerCase())
            ) {
                return false;
            }

            if (genderFilter !== "all" && result.gender !== genderFilter) {
                return false;
            }

            if (performanceFilter !== "all") {
                const avg = result.cumulative_average;
                if (performanceFilter === "excellent" && avg < 70) return false;
                if (performanceFilter === "good" && (avg < 60 || avg >= 70)) return false;
                if (performanceFilter === "average" && (avg < 50 || avg >= 60)) return false;
                if (performanceFilter === "poor" && avg >= 50) return false;
            }

            return true;
        });
    }, [cumulativeResults, search, genderFilter, performanceFilter]);

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

    function getPerformanceIndicator(average: number) {
        if (average >= 70)
            return { icon: TrendingUp, color: "text-green-600", label: "Excellent" };
        if (average >= 60)
            return { icon: TrendingUp, color: "text-blue-600", label: "Good" };
        if (average >= 50) return { icon: Minus, color: "text-yellow-600", label: "Average" };
        return { icon: TrendingDown, color: "text-red-600", label: "Needs Improvement" };
    }

    function getGradeColor(grade: string) {
        const gradePrefix = grade.charAt(0).toUpperCase();
        switch (gradePrefix) {
            case "A":
                return "bg-green-100 text-green-800";
            case "B":
                return "bg-blue-100 text-blue-800";
            case "C":
                return "bg-yellow-100 text-yellow-800";
            case "D":
                return "bg-orange-100 text-orange-800";
            case "E":
                return "bg-orange-100 text-orange-800";
            default:
                return "bg-red-100 text-red-800";
        }
    }

    async function handleExportResults() {
        if (showCumulative && isLastTerm) {
            // Export cumulative results
            const exportData = filteredCumulativeResults.map((result, i) => ({
                "Rank": result.cumulative_position || i + 1,
                "Student ID": result.student_number,
                "Student Name": result.student_name,
                "Gender": result.gender,
                "Terms Completed": `${result.terms_with_results}/3`,
                ...Object.fromEntries(
                    result.term_averages.map((term, idx) => [
                        `${term.term_name} Avg`,
                        term.average > 0 ? term.average.toFixed(2) : "N/A"
                    ])
                ),
                "Cumulative Average": result.cumulative_average.toFixed(2),
                "Cumulative Grade": result.cumulative_grade,
                "Status": result.is_complete ? "Complete" : "Partial",
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Cumulative Results");

            const sessionName = sessions.find((s) => s.id === selectedSessionId)?.name || "Session";
            XLSX.writeFile(wb, `${className}-${sessionName}-Cumulative-Results.xlsx`);
            toast.success("Cumulative results exported successfully");
        } else {
            // Export single term results
            const exportData = filteredResults.map((result, i) => ({
                "#": i + 1,
                "Student ID": result.student_number,
                "Student Name": result.student_name,
                Gender: result.gender,
                "Total Subjects": result.total_subjects,
                "Total Score": result.total_score.toFixed(2),
                "Average Score": result.average_score.toFixed(2),
                "Highest Score": result.highest_score.toFixed(2),
                "Lowest Score": result.lowest_score.toFixed(2),
                "Average Grade": result.average_grade || "N/A",
                Position: result.class_position || "N/A",
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Results");

            const sessionName = sessions.find((s) => s.id === selectedSessionId)?.name || "Session";
            const termName = terms.find((t) => t.id === selectedTermId)?.name || "Term";

            XLSX.writeFile(wb, `${className}-${sessionName}-${termName}-results.xlsx`);
            toast.success("Results exported successfully");
        }
    }

    function handleViewStudentReport(studentId: string) {
        // Navigate to student report page
        window.open(`/teacher/students/${studentId}/report?term=${selectedTermId}`, "_blank");
    }

    async function handleCalculatePositions() {
        if (!selectedSessionId || !selectedTermId) {
            toast.error("Please select a session and term");
            return;
        }

        setLoading(true);
        try {
            // Get all students with results for this class
            const studentsWithResults = studentResults.filter(r => r.has_results);

            if (studentsWithResults.length === 0) {
                toast.error("No students with results to rank");
                setLoading(false);
                return;
            }

            // Sort by average score (descending) to determine positions
            const sortedStudents = [...studentsWithResults].sort((a, b) => b.average_score - a.average_score);

            // Assign positions (handle ties - students with same average get same position)
            let currentPosition = 1;
            const positionUpdates: { studentId: string; position: number; average: number }[] = [];

            for (let i = 0; i < sortedStudents.length; i++) {
                const student = sortedStudents[i];

                // Check if this student has the same average as the previous one (tie)
                if (i > 0 && Math.abs(student.average_score - sortedStudents[i - 1].average_score) < 0.01) {
                    // Same position as previous student (tie)
                    positionUpdates.push({
                        studentId: student.student_id,
                        position: positionUpdates[i - 1].position,
                        average: student.average_score
                    });
                } else {
                    // New position
                    currentPosition = i + 1;
                    positionUpdates.push({
                        studentId: student.student_id,
                        position: currentPosition,
                        average: student.average_score
                    });
                }
            }

            // Get subject_class_ids for this class to update positions for this class only
            let classScQuery = supabase
                .from("subject_classes")
                .select("id")
                .eq("class_id", classId);

            if (schoolId) {
                classScQuery = classScQuery.eq("school_id", schoolId);
            }

            const { data: classSubjectClasses, error: classScError } = await classScQuery;

            if (classScError) throw classScError;

            const classSubjectClassIds = classSubjectClasses?.map((sc: any) => sc.id) || [];

            if (classSubjectClassIds.length === 0) {
                toast.error("No subject classes found for this class");
                setLoading(false);
                return;
            }

            // Update all results for each student with their position - ONLY for this class
            const updatePromises = positionUpdates.map(async ({ studentId, position }) => {
                // Update all results for this student in this term and session for THIS CLASS ONLY
                let updateQuery = supabase
                    .from("results")
                    .update({
                        class_position: position,
                        total_students: studentsWithResults.length,
                        class_average: studentsWithResults.reduce((sum, r) => sum + r.average_score, 0) / studentsWithResults.length
                    })
                    .eq("student_id", studentId)
                    .eq("term_id", selectedTermId)
                    .eq("session_id", selectedSessionId)
                    .in("subject_class_id", classSubjectClassIds);

                if (schoolId) {
                    updateQuery = updateQuery.eq("school_id", schoolId);
                }

                await updateQuery;
            });

            await Promise.all(updatePromises);

            toast.success(`Positions calculated for ${studentsWithResults.length} students`);

            // Refresh the results to show updated positions
            await fetchStudentResults();
        } catch (error) {
            console.error("Error calculating positions:", error);
            toast.error("Failed to calculate positions");
        } finally {
            setLoading(false);
        }
    }

    function getPositionDisplay(position: number | null | undefined) {
        if (!position) return null;
        if (position === 1) {
            return (
                <div className="flex items-center justify-center gap-1">
                    <span className="text-xl">🥇</span>
                    <span className="font-bold text-yellow-600">1st</span>
                </div>
            );
        }
        if (position === 2) {
            return (
                <div className="flex items-center justify-center gap-1">
                    <span className="text-xl">🥈</span>
                    <span className="font-bold text-gray-600">2nd</span>
                </div>
            );
        }
        if (position === 3) {
            return (
                <div className="flex items-center justify-center gap-1">
                    <span className="text-xl">🥉</span>
                    <span className="font-bold text-amber-700">3rd</span>
                </div>
            );
        }
        return <span className="font-semibold text-gray-700">{position}th</span>;
    }

    return (
        <Card>
            <CardHeader className="p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:gap-4">
                    <div>
                        <CardTitle className="text-lg sm:text-xl">Class Results</CardTitle>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            View and manage student results for {className}
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {isLastTerm && (
                            <Button
                                size="sm"
                                variant={showCumulative ? "default" : "outline"}
                                onClick={() => setShowCumulative(!showCumulative)}
                                className="text-xs sm:text-sm flex-1 sm:flex-initial"
                            >
                                <Calculator className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="hidden sm:inline">{showCumulative ? "Single Term" : "Cumulative"}</span>
                                <span className="sm:hidden">{showCumulative ? "Term" : "Cumulative"}</span>
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCalculatePositions}
                            disabled={loading || !selectedSessionId || !selectedTermId || filteredResults.filter(r => r.has_results).length === 0}
                            className="text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                            <Calculator className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Calculate Positions</span>
                            <span className="sm:hidden">Calculate</span>
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setIsPublicationDialogOpen(true)}
                            disabled={!selectedSessionId || !selectedTermId}
                            className="text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">Publish Results</span>
                            <span className="sm:hidden">Publish</span>
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportResults}
                            disabled={loading || (showCumulative ? filteredCumulativeResults.length === 0 : filteredResults.length === 0)}
                            className="text-xs sm:text-sm flex-1 sm:flex-initial"
                        >
                            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            Export
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                {/* Session and Term Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-xs sm:text-sm font-medium">Session</label>
                        <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                            <SelectTrigger className="h-9 sm:h-10 text-sm">
                                <SelectValue placeholder="Select session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map((session) => (
                                    <SelectItem key={session.id} value={session.id} className="text-sm">
                                        {session.name} {session.is_current && "(Current)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                        <label className="text-xs sm:text-sm font-medium">Term</label>
                        <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSessionId}>
                            <SelectTrigger className="h-9 sm:h-10 text-sm">
                                <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                                {terms
                                    .filter(term => term.session_id === selectedSessionId)
                                    .map((term) => (
                                        <SelectItem key={term.id} value={term.id} className="text-sm">
                                            {term.name} {term.is_current && "(Current)"}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <div className="relative flex-1">
                        <Search className="h-3 w-3 sm:h-4 sm:w-4 absolute left-2.5 sm:left-3 top-2.5 sm:top-3 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or ID..."
                            className="pl-8 sm:pl-9 h-9 sm:h-10 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="border rounded-md px-3 py-2 text-xs sm:text-sm h-9 sm:h-10"
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value as any)}
                    >
                        <option value="all">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>

                    <select
                        className="border rounded-md px-3 py-2 text-xs sm:text-sm h-9 sm:h-10 min-w-0"
                        value={performanceFilter}
                        onChange={(e) => setPerformanceFilter(e.target.value as any)}
                    >
                        <option value="all">All Performance</option>
                        <option value="excellent">Excellent (70%+)</option>
                        <option value="good">Good (60-69%)</option>
                        <option value="average">Average (50-59%)</option>
                        <option value="poor">Needs Improvement (&lt;50%)</option>
                    </select>
                </div>

                {/* Cumulative Results Available Banner */}
                {isLastTerm && !showCumulative && (
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-300 rounded-lg p-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Calculator className="h-5 w-5 text-purple-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-purple-900">
                                        Cumulative Results Available
                                    </h4>
                                    <p className="text-sm text-purple-700 mt-0.5">
                                        View student rankings across all terms in this session
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => setShowCumulative(true)}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                View Cumulative Results
                            </Button>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                {!loading && filteredResults.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                        <div className="p-3 sm:p-4 bg-blue-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-600 font-medium">Total Students</p>
                            <p className="text-xl sm:text-2xl font-bold text-blue-900">{filteredResults.length}</p>
                        </div>
                        <div className="p-3 sm:p-4 bg-green-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-green-600 font-medium">With Results</p>
                            <p className="text-xl sm:text-2xl font-bold text-green-900">
                                {filteredResults.filter((r) => r.has_results).length}
                            </p>
                        </div>
                        <div className="p-3 sm:p-4 bg-yellow-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-yellow-600 font-medium">Class Average</p>
                            <p className="text-xl sm:text-2xl font-bold text-yellow-900">
                                {(
                                    filteredResults.reduce((sum, r) => sum + r.average_score, 0) /
                                    filteredResults.filter((r) => r.has_results).length || 0
                                ).toFixed(1)}
                                %
                            </p>
                        </div>
                        <div className="p-3 sm:p-4 bg-purple-50 rounded-lg">
                            <p className="text-xs sm:text-sm text-purple-600 font-medium">Highest Average</p>
                            <p className="text-xl sm:text-2xl font-bold text-purple-900">
                                {Math.max(...filteredResults.map((r) => r.average_score), 0).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                {loading ? (
                    <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">Loading results...</div>
                ) : !selectedSessionId || !selectedTermId ? (
                    <div className="text-center py-8 text-sm sm:text-base text-muted-foreground">
                        Please select a session and term to view results
                    </div>
                ) : showCumulative ? (
                    /* Cumulative Results View */
                    <div className="space-y-4">
                        {/* Info Banner */}
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Calculator className="h-5 w-5 text-purple-600 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-purple-900">
                                        Cumulative Results Across All Terms
                                    </h3>
                                    <p className="text-sm text-purple-700 mt-1">
                                        This view shows each student's average performance across all terms in this session.
                                        Students are ranked based on their cumulative average.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Cumulative Stats */}
                        {filteredCumulativeResults.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                                <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                    <p className="text-xs sm:text-sm text-purple-600 font-medium">Total Ranked</p>
                                    <p className="text-xl sm:text-2xl font-bold text-purple-900">{filteredCumulativeResults.length}</p>
                                </div>
                                <div className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                                    <p className="text-xs sm:text-sm text-green-600 font-medium">Complete (3 Terms)</p>
                                    <p className="text-xl sm:text-2xl font-bold text-green-900">
                                        {filteredCumulativeResults.filter((r) => r.is_complete).length}
                                    </p>
                                </div>
                                <div className="p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
                                    <p className="text-xs sm:text-sm text-amber-600 font-medium">Partial Results</p>
                                    <p className="text-xl sm:text-2xl font-bold text-amber-900">
                                        {filteredCumulativeResults.filter((r) => !r.is_complete).length}
                                    </p>
                                </div>
                                <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                                    <p className="text-xs sm:text-sm text-blue-600 font-medium">Average Score</p>
                                    <p className="text-xl sm:text-2xl font-bold text-blue-900">
                                        {(
                                            filteredCumulativeResults.reduce((sum, r) => sum + r.cumulative_average, 0) /
                                            filteredCumulativeResults.length || 0
                                        ).toFixed(1)}%
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Cumulative Results Table */}
                        <div className="border rounded-lg overflow-hidden shadow-sm">
                            {/* Desktop Table */}
                            <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-r from-purple-100 to-blue-100">
                                    <tr>
                                        <th className="p-3 text-left">Rank</th>
                                        <th className="p-3 text-left">Student</th>
                                        <th className="p-3 text-center">Terms</th>
                                        <th className="p-3 text-center">1st Term</th>
                                        <th className="p-3 text-center">2nd Term</th>
                                        <th className="p-3 text-center">3rd Term</th>
                                        <th className="p-3 text-center">Cumulative Avg</th>
                                        <th className="p-3 text-center">Grade</th>
                                        <th className="p-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCumulativeResults.map((result) => (
                                        <tr key={result.student_id} className="border-t transition-colors">
                                            <td className="p-3">
                                                <div className="flex items-center justify-center">
                                                    {getPositionDisplay(result.cumulative_position)}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div>
                                                    <p className="font-medium">{result.student_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {result.student_number}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <Badge 
                                                    variant="outline" 
                                                    className={result.is_complete ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}
                                                >
                                                    {result.terms_with_results}/3
                                                </Badge>
                                            </td>
                                            {result.term_averages.map((term, idx) => (
                                                <td key={idx} className="p-3 text-center">
                                                    {term.average > 0 ? (
                                                        <span className="font-semibold text-gray-700">
                                                            {term.average.toFixed(1)}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">N/A</span>
                                                    )}
                                                </td>
                                            ))}
                                            <td className="p-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-lg font-bold text-purple-700">
                                                        {result.cumulative_average.toFixed(1)}%
                                                    </span>
                                                    {(() => {
                                                        const perf = getPerformanceIndicator(result.cumulative_average);
                                                        const Icon = perf.icon;
                                                        return (
                                                            <div className="flex items-center gap-1">
                                                                <Icon className={`h-3 w-3 ${perf.color}`} />
                                                                <span className={`text-xs ${perf.color}`}>
                                                                    {perf.label}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-sm font-bold ${getGradeColor(result.cumulative_grade)}`}
                                                >
                                                    {result.cumulative_grade}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.is_complete ? (
                                                    <Badge className="bg-green-100 text-green-800 border-green-300">
                                                        Complete
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                                                        Partial
                                                    </Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                        {filteredCumulativeResults.length === 0 && (
                            <div className="p-8 text-center text-sm sm:text-base text-muted-foreground">
                                {search || genderFilter !== "all" || performanceFilter !== "all"
                                    ? "No cumulative results match your filters."
                                    : "No cumulative results available."}
                            </div>
                        )}
                        </div>

                        {/* Mobile Card Layout */}
                            <div className="lg:hidden space-y-3 p-3">
                                {filteredCumulativeResults.map((result) => (
                                    <div key={result.student_id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getPositionDisplay(result.cumulative_position)}
                                                    <Badge 
                                                        variant="outline" 
                                                        className={result.is_complete ? "bg-green-50 text-green-700 border-green-200 text-xs" : "bg-amber-50 text-amber-700 border-amber-200 text-xs"}
                                                    >
                                                        {result.terms_with_results}/3 Terms
                                                    </Badge>
                                                </div>
                                                <p className="font-medium text-sm truncate">{result.student_name}</p>
                                                <p className="text-xs text-muted-foreground">{result.student_number}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-lg font-bold text-purple-700">
                                                    {result.cumulative_average.toFixed(1)}%
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs font-bold ${getGradeColor(result.cumulative_grade)}`}
                                                >
                                                    {result.cumulative_grade}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            {result.term_averages.map((term, idx) => (
                                                <div key={idx} className="bg-gray-50 rounded p-2">
                                                    <p className="text-gray-600 font-medium truncate">{term.term_name}</p>
                                                    <p className="font-semibold text-gray-900 mt-0.5">
                                                        {term.average > 0 ? `${term.average.toFixed(1)}%` : "N/A"}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t">
                                            <div className="flex items-center gap-1">
                                                {(() => {
                                                    const perf = getPerformanceIndicator(result.cumulative_average);
                                                    const Icon = perf.icon;
                                                    return (
                                                        <>
                                                            <Icon className={`h-3 w-3 ${perf.color}`} />
                                                            <span className={`text-xs ${perf.color} font-medium`}>
                                                                {perf.label}
                                                            </span>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {result.is_complete ? (
                                                <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">
                                                    Complete
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                                    Partial
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {filteredCumulativeResults.length === 0 && (
                                    <div className="p-8 text-center text-sm text-muted-foreground">
                                        {search || genderFilter !== "all" || performanceFilter !== "all"
                                            ? "No cumulative results match your filters."
                                            : "No cumulative results available."}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Single Term Results View */
                    <div className="border rounded-md overflow-hidden">
                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="p-3 text-left w-12">#</th>
                                    <th className="p-3 text-left">Student</th>
                                    <th className="p-3 text-center">Subjects</th>
                                    <th className="p-3 text-center">Average</th>
                                    <th className="p-3 text-center">Highest</th>
                                    <th className="p-3 text-center">Lowest</th>
                                    <th className="p-3 text-center">Performance</th>
                                    <th className="p-3 text-center">Average Grade</th>
                                    <th className="p-3 text-center">Position</th>
                                    <th className="p-3 text-right w-12"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((result, i) => {
                                    const performance = getPerformanceIndicator(result.average_score);
                                    const PerformanceIcon = performance.icon;

                                    return (
                                        <tr key={result.student_id} className="border-t hover:bg-muted/50">
                                            <td className="p-3">{i + 1}</td>
                                            <td className="p-3">
                                                <div>
                                                    <p className="font-medium">{result.student_name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {result.student_number}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.has_results ? (
                                                    <Badge variant="outline">{result.total_subjects}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">No results</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.has_results ? (
                                                    <span className="font-semibold">
                                                        {result.average_score.toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.has_results ? (
                                                    <span className="text-green-600 font-medium">
                                                        {result.highest_score.toFixed(0)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.has_results ? (
                                                    <span className="text-orange-600 font-medium">
                                                        {result.lowest_score.toFixed(0)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.has_results ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <PerformanceIcon className={`h-4 w-4 ${performance.color}`} />
                                                        <span className={`text-xs ${performance.color}`}>
                                                            {performance.label}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.has_results ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-sm font-bold ${getGradeColor(result.average_grade)}`}
                                                    >
                                                        {result.average_grade}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                {result.class_position ? (
                                                    getPositionDisplay(result.class_position)
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">

                                                        <DropdownMenuItem
                                                            onClick={() => handleViewStudentReport(result.student_id)}
                                                        >
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Report Card
                                                        </DropdownMenuItem>

                                                        <DropdownMenuItem
                                                            onClick={async () => {
                                                                const studentObj = students.find(s => s.id === result.student_id);
                                                                if (studentObj) {
                                                                    try {
                                                                        // Fetch attendance for this student using Supabase
                                                                    let attendanceQuery = supabase
                                                                            .from("attendance")
                                                                            .select("*")
                                                                            .eq("student_id", result.student_id);

                                                                    if (schoolId) {
                                                                        attendanceQuery = attendanceQuery.eq("school_id", schoolId);
                                                                    }

                                                                    const { data: attendance, error } = await attendanceQuery;

                                                                        if (error) throw error;

                                                                        const studentAttendance = attendance || [];
                                                                        const total = studentAttendance.length;
                                                                        const present = studentAttendance.filter(
                                                                            (r: any) =>
                                                                                r.status === "present" ||
                                                                                r.status === "late" ||
                                                                                r.status === "excused"
                                                                        ).length;

                                                                        const averageAttendance = total === 0 ? 0 : Math.round((present / total) * 100);

                                                                        // Add attendance data to student object
                                                                        const enrichedStudent = {
                                                                            ...studentObj,
                                                                            average_attendance: averageAttendance,
                                                                            total_attendance: total,
                                                                        };

                                                                        setSelectedStudent(enrichedStudent);
                                                                    } catch (error) {
                                                                        console.error("Error fetching attendance:", error);
                                                                        setSelectedStudent(studentObj);
                                                                    }
                                                                    setIsStudentDetailsOpen(true);
                                                                }
                                                            }}
                                                        >
                                                            <FileText className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {filteredResults.length === 0 && (
                            <div className="p-8 text-center text-sm sm:text-base text-muted-foreground">
                                {search || genderFilter !== "all" || performanceFilter !== "all"
                                    ? "No results match your filters."
                                    : "No student results found for this term."}
                            </div>
                        )}
                        </div>

                        {/* Mobile Card Layout */}
                        <div className="lg:hidden space-y-3 p-3">
                            {filteredResults.map((result) => {
                                const performance = getPerformanceIndicator(result.average_score);
                                const PerformanceIcon = performance.icon;

                                return (
                                    <div key={result.student_id} className="border rounded-lg p-4 space-y-3 bg-white shadow-sm">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm truncate">{result.student_name}</p>
                                                <p className="text-xs text-muted-foreground">{result.student_number}</p>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => handleViewStudentReport(result.student_id)}
                                                    >
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        View Report Card
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={async () => {
                                                            const studentObj = students.find(s => s.id === result.student_id);
                                                            if (studentObj) {
                                                                try {
                                                                    let attendanceQuery = supabase
                                                                        .from("attendance")
                                                                        .select("*")
                                                                        .eq("student_id", result.student_id);

                                                                    if (schoolId) {
                                                                        attendanceQuery = attendanceQuery.eq("school_id", schoolId);
                                                                    }

                                                                    const { data: attendance, error } = await attendanceQuery;

                                                                    if (error) throw error;

                                                                    const studentAttendance = attendance || [];
                                                                    const total = studentAttendance.length;
                                                                    const present = studentAttendance.filter(
                                                                        (r: any) =>
                                                                            r.status === "present" ||
                                                                            r.status === "late" ||
                                                                            r.status === "excused"
                                                                    ).length;

                                                                    const averageAttendance = total === 0 ? 0 : Math.round((present / total) * 100);

                                                                    const enrichedStudent = {
                                                                        ...studentObj,
                                                                        average_attendance: averageAttendance,
                                                                        total_attendance: total,
                                                                    };

                                                                    setSelectedStudent(enrichedStudent);
                                                                } catch (error) {
                                                                    console.error("Error fetching attendance:", error);
                                                                    setSelectedStudent(studentObj);
                                                                }
                                                                setIsStudentDetailsOpen(true);
                                                            }
                                                        }}
                                                    >
                                                        <FileText className="mr-2 h-4 w-4" />
                                                        View Details
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {result.has_results ? (
                                            <>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-blue-600 font-medium">Average</p>
                                                        <p className="text-lg font-bold text-blue-900">
                                                            {result.average_score.toFixed(1)}%
                                                        </p>
                                                    </div>
                                                    <div className="bg-green-50 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-green-600 font-medium">Highest</p>
                                                        <p className="text-lg font-bold text-green-900">
                                                            {result.highest_score.toFixed(0)}
                                                        </p>
                                                    </div>
                                                    <div className="bg-orange-50 rounded-lg p-2 text-center">
                                                        <p className="text-xs text-orange-600 font-medium">Lowest</p>
                                                        <p className="text-lg font-bold text-orange-900">
                                                            {result.lowest_score.toFixed(0)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-gray-600">Subjects:</span>
                                                        <Badge variant="outline" className="text-xs">{result.total_subjects}</Badge>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <PerformanceIcon className={`h-3 w-3 ${performance.color}`} />
                                                        <span className={`${performance.color} font-medium`}>
                                                            {performance.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-2 border-t">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-sm font-bold ${getGradeColor(result.average_grade)}`}
                                                    >
                                                        Grade: {result.average_grade}
                                                    </Badge>
                                                    {result.class_position ? (
                                                        <div className="flex items-center gap-1">
                                                            {getPositionDisplay(result.class_position)}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No position</span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-4 text-sm text-muted-foreground bg-gray-50 rounded-lg">
                                                No results recorded
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {filteredResults.length === 0 && (
                                <div className="p-8 text-center text-sm text-muted-foreground">
                                    {search || genderFilter !== "all" || performanceFilter !== "all"
                                        ? "No results match your filters."
                                        : "No student results found for this term."}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </CardContent>
            {/* Student Details Modal */}
            <StudentDetailsModal
                student={selectedStudent}
                sessions={sessions}
                terms={terms}
                isOpen={isStudentDetailsOpen}
                onClose={() => {
                    setIsStudentDetailsOpen(false);
                    setSelectedStudent(null);
                }}
            />

            {/* Results Publication Dialog */}
            <ResultsPublicationDialog
                isOpen={isPublicationDialogOpen}
                onClose={() => setIsPublicationDialogOpen(false)}
                classId={classId}
                className={className}
                sessionId={selectedSessionId}
                termId={selectedTermId}
                onPublish={fetchStudentResults}
                schoolId={schoolId}
            />
        </Card>


    );
}