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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { apiClient } from "@/lib/api-client";
import { Student, Session, Term } from "@/lib/types";
import * as XLSX from "xlsx-js-style";
import { StudentDetailsModal } from "@/components/student-details-modal";
import { ResultsPublicationDialog } from "@/components/ResultsPublicationDialog";

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

interface TeacherResultsTabProps {
    classId: string;
    className: string;
    students: Student[];
    sessions: Session[];
    terms: Term[];
}

export default function TeacherResultsTab({
    classId,
    className,
    students,
    sessions,
    terms,
}: TeacherResultsTabProps) {
    const [selectedSessionId, setSelectedSessionId] = useState<string>("");
    const [selectedTermId, setSelectedTermId] = useState<string>("");
    const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
    const [performanceFilter, setPerformanceFilter] = useState<
        "all" | "excellent" | "good" | "average" | "poor"
    >("all");

    // Modal state
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isStudentDetailsOpen, setIsStudentDetailsOpen] = useState(false);
    const [isCalculatePositionDialogOpen, setIsCalculatePositionDialogOpen] = useState(false);
    const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);
    const [scoreCalculationMode, setScoreCalculationMode] = useState<'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all'>('all');

    useEffect(() => {
        // Auto-select current session and term if available
        const currentSession = sessions?.find((s: any) => s.is_current);
        const currentTerm = terms?.find((t: any) => t.is_current);

        if (currentSession) setSelectedSessionId(currentSession.id);
        if (currentTerm) setSelectedTermId(currentTerm.id);
    }, [sessions, terms]);

    useEffect(() => {
        if (selectedSessionId && selectedTermId) {
            fetchStudentResults();
        }
    }, [selectedSessionId, selectedTermId]);

    async function fetchStudentResults() {
        setLoading(true);

        try {
            // Fetch all results for this class in the selected term
            const resultsData = await apiClient.apiRead({
                table: "results",
                select: `
          *,
          student:students!inner(id, student_id, first_name, last_name, gender, class_id),
          subject_class:subject_classes!inner(
            id,
            class_id,
            subject:subjects(name)
          )
        `,
                filters: {
                    term_id: selectedTermId,
                    session_id: selectedSessionId,
                },
            });

            // Filter by class on client side since results doesn't have class_id
            const classResults = resultsData?.filter((r: any) => r.subject_class?.class_id === classId) || [];

            // Group results by student
            const studentResultsMap = new Map<string, StudentResult>();

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
                    average_grade: '',
                    class_position: null,
                    has_results: false,
                });
            });

            // Process results
            classResults.forEach((result: any) => {
                const studentId = result.student.id;
                const studentResult = studentResultsMap.get(studentId);

                if (studentResult) {
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

                    // Store class position if available
                    if (result.class_position) {
                        studentResult.class_position = result.class_position;
                    }
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

    function handleViewStudentReport(studentId: string) {
        // Navigate to student report page
        window.location.href = `/teacher/students/${studentId}/report?term=${selectedTermId}&session=${selectedSessionId}`;
    }

    async function handleCalculatePositions() {
        if (!selectedSessionId || !selectedTermId) {
            toast.error("Please select a session and term");
            return;
        }

        setLoading(true);
        try {
            // Calculate total score for each student based on selected mode
            const studentsWithScores = studentResults.map(result => {
                if (!result.has_results) return null;
                
                // We need to recalculate based on the selected mode
                // For now, we'll use average_score, but this should be recalculated
                // based on the actual component scores from the results table
                return {
                    ...result,
                    calculatedScore: result.average_score // This will be updated below
                };
            }).filter(Boolean) as (StudentResult & { calculatedScore: number })[];

            if (studentsWithScores.length === 0) {
                toast.error("No students with results to rank");
                setLoading(false);
                return;
            }

            // Fetch actual results data to recalculate scores based on mode
            const resultsData = await apiClient.apiRead({
                table: "results",
                select: "student_id, welcome_test, mid_term_test, vetting, exam",
                filters: {
                    term_id: selectedTermId,
                    session_id: selectedSessionId,
                },
            });

            // Calculate scores per student based on mode
            const studentScoresMap = new Map<string, number>();
            
            studentsWithScores.forEach(student => {
                const studentResults = resultsData?.filter((r: any) => r.student_id === student.student_id) || [];
                
                if (studentResults.length === 0) {
                    studentScoresMap.set(student.student_id, 0);
                    return;
                }

                let totalScore = 0;
                let maxPossibleScore = 0;

                studentResults.forEach((result: any) => {
                    let subjectScore = 0;
                    
                    switch (scoreCalculationMode) {
                        case 'welcome_only':
                            subjectScore = result.welcome_test || 0;
                            maxPossibleScore += 10;
                            break;
                        case 'welcome_midterm':
                            subjectScore = (result.welcome_test || 0) + (result.mid_term_test || 0);
                            maxPossibleScore += 30;
                            break;
                        case 'welcome_midterm_vetting':
                            subjectScore = (result.welcome_test || 0) + (result.mid_term_test || 0) + (result.vetting || 0);
                            maxPossibleScore += 40;
                            break;
                        case 'all':
                        default:
                            subjectScore = (result.welcome_test || 0) + (result.mid_term_test || 0) + (result.vetting || 0) + (result.exam || 0);
                            maxPossibleScore += 100;
                            break;
                    }
                    
                    totalScore += subjectScore;
                });

                // Calculate average percentage
                const averagePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
                studentScoresMap.set(student.student_id, averagePercentage);
            });

            // Update students with calculated scores
            studentsWithScores.forEach(student => {
                student.calculatedScore = studentScoresMap.get(student.student_id) || 0;
            });

            // Sort by calculated score (descending) to determine positions
            const sortedStudents = [...studentsWithScores].sort((a, b) => b.calculatedScore - a.calculatedScore);

            // Assign positions (handle ties - students with same score get same position)
            let currentPosition = 1;
            const positionUpdates: { studentId: string; position: number; score: number }[] = [];

            for (let i = 0; i < sortedStudents.length; i++) {
                const student = sortedStudents[i];

                // Check if this student has the same score as the previous one (tie)
                if (i > 0 && Math.abs(student.calculatedScore - sortedStudents[i - 1].calculatedScore) < 0.01) {
                    // Same position as previous student (tie)
                    positionUpdates.push({
                        studentId: student.student_id,
                        position: positionUpdates[i - 1].position,
                        score: student.calculatedScore
                    });
                } else {
                    // New position
                    currentPosition = i + 1;
                    positionUpdates.push({
                        studentId: student.student_id,
                        position: currentPosition,
                        score: student.calculatedScore
                    });
                }
            }

            // Calculate class average
            const classAvg = sortedStudents.reduce((sum, s) => sum + s.calculatedScore, 0) / sortedStudents.length;

            // Update all results for each student with their position
            const updatePromises = positionUpdates.map(async ({ studentId, position }) => {
                // Update all results for this student in this term and session
                await apiClient.apiWrite({
                    table: "results",
                    operation: "update",
                    data: {
                        class_position: position,
                        total_students: sortedStudents.length,
                        class_average: classAvg
                    },
                    filters: {
                        student_id: studentId,
                        term_id: selectedTermId,
                        session_id: selectedSessionId
                    }
                });
            });

            await Promise.all(updatePromises);

            const modeLabels = {
                'welcome_only': 'Welcome Test Only',
                'welcome_midterm': 'Welcome + Mid-Term',
                'welcome_midterm_vetting': 'Welcome + Mid-Term + Vetting',
                'all': 'All Components'
            };

            toast.success(`Positions calculated for ${sortedStudents.length} students using ${modeLabels[scoreCalculationMode]}`);
            
            // Close dialog and refresh results
            setIsCalculatePositionDialogOpen(false);
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
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Class Results</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            View and manage student results for {className}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => setIsPublicationDialogOpen(true)}
                            disabled={!selectedSessionId || !selectedTermId}
                        >
                            <Eye className="h-4 w-4 mr-1" />
                            Publish Results
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIsCalculatePositionDialogOpen(true)}
                            disabled={loading || !selectedSessionId || !selectedTermId || studentResults.filter(r => r.has_results).length === 0}
                        >
                            <Calculator className="h-4 w-4 mr-1" />
                            Calculate Positions
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleExportResults}
                            disabled={loading || filteredResults.length === 0}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Export
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Session and Term Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Session</label>
                        <div className="p-3 bg-white border rounded-md text-sm font-medium">
                            {sessions.find(s => s.id === selectedSessionId)?.name || "Current Session"}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Term</label>
                        <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                                {terms.filter(term => term.session_id === selectedSessionId).map((term) => (
                                    <SelectItem key={term.id} value={term.id}>
                                        {term.name} {term.is_current && "(Current)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or student ID..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className="border rounded-md p-2"
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value as any)}
                    >
                        <option value="all">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>

                    <select
                        className="border rounded-md p-2"
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

                {/* Summary Stats */}
                {!loading && filteredResults.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-600 font-medium">Total Students</p>
                            <p className="text-2xl font-bold text-blue-900">{filteredResults.length}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-600 font-medium">With Results</p>
                            <p className="text-2xl font-bold text-green-900">
                                {filteredResults.filter((r) => r.has_results).length}
                            </p>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg">
                            <p className="text-sm text-yellow-600 font-medium">Class Average</p>
                            <p className="text-2xl font-bold text-yellow-900">
                                {(
                                    filteredResults.reduce((sum, r) => sum + r.average_score, 0) /
                                    filteredResults.filter((r) => r.has_results).length || 0
                                ).toFixed(1)}
                                %
                            </p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                            <p className="text-sm text-purple-600 font-medium">Highest Average</p>
                            <p className="text-2xl font-bold text-purple-900">
                                {Math.max(...filteredResults.map((r) => r.average_score), 0).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                )}

                {/* Results Table */}
                {loading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading results...</div>
                ) : !selectedSessionId || !selectedTermId ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Please select a session and term to view results
                    </div>
                ) : (
                    <div className="border rounded-md overflow-hidden">
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
                                                                    // Fetch attendance for this student
                                                                    try {
                                                                        const attendanceRes = await fetch('/api/admin-read', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({
                                                                                table: 'attendance',
                                                                                operation: 'select',
                                                                            }),
                                                                        }).then(r => r.json());

                                                                        const attendance = Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes?.data || []);
                                                                        const studentAttendance = attendance.filter((a: any) => a.student_id === result.student_id);
                                                                        
                                                                        const total = studentAttendance.length;
                                                                        const present = studentAttendance.filter(
                                                                            (r: any) => r.status === "present" || r.status === "late" || r.status === "excused"
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
                            <div className="p-8 text-center text-muted-foreground">
                                {search || genderFilter !== "all" || performanceFilter !== "all"
                                    ? "No results match your filters."
                                    : "No student results found for this term."}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Calculate Positions Dialog */}
            <Dialog open={isCalculatePositionDialogOpen} onOpenChange={setIsCalculatePositionDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Calculate Class Positions</DialogTitle>
                        <DialogDescription>
                            Select which components of the results to use for calculating student positions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Calculation Method</label>
                            <Select value={scoreCalculationMode} onValueChange={(value: any) => setScoreCalculationMode(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select calculation method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="welcome_only">
                                        Welcome Test Only (10 marks)
                                    </SelectItem>
                                    <SelectItem value="welcome_midterm">
                                        Welcome + Mid-Term (30 marks)
                                    </SelectItem>
                                    <SelectItem value="welcome_midterm_vetting">
                                        Welcome + Mid-Term + Vetting (40 marks)
                                    </SelectItem>
                                    <SelectItem value="all">
                                        All Components (100 marks)
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-2">
                                This will calculate positions based on the selected components and update all student results.
                            </p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> This will recalculate and update positions for all {studentResults.filter(r => r.has_results).length} students with results in this term.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsCalculatePositionDialogOpen(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCalculatePositions}
                            disabled={loading}
                        >
                            {loading ? "Calculating..." : "Calculate Positions"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
            />
        </Card>
    );
}
