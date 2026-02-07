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

interface AnnualResult {
    student_id: string;
    student_name: string;
    student_number: string;
    gender: string;
    term1_average: number | null;
    term2_average: number | null;
    term3_average: number | null;
    annual_average: number;
    annual_grade: string;
    annual_position: number | null;
    completed_terms: number; // How many terms have results (1, 2, or 3)
    data_completeness: 'complete' | 'partial' | 'incomplete'; // 3 terms, 2 terms, 1 term
}

interface ResultsTabProps {
    classId: string;
    className: string;
    students: Student[];
}

export function ResultsTab({ classId, className, students }: ResultsTabProps) {

    const [sessions, setSessions] = useState<Session[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
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
    const [isPublicationDialogOpen, setIsPublicationDialogOpen] = useState(false);

    // Annual results state
    const [annualResults, setAnnualResults] = useState<AnnualResult[]>([]);
    const [showAnnualResults, setShowAnnualResults] = useState(false);
    const [isThirdTerm, setIsThirdTerm] = useState(false);
    const [annualLoading, setAnnualLoading] = useState(false);
    const [annualTableReady, setAnnualTableReady] = useState(false);
        // Effect to check if annual results table is in the DOM when annual results are shown
        useEffect(() => {
            if (showAnnualResults && isThirdTerm && !annualLoading) {
                // Wait for next tick to ensure DOM is updated
                const timeout = setTimeout(() => {
                    const table = document.getElementById('annual-results-table');
                    setAnnualTableReady(!!table);
                }, 100);
                return () => clearTimeout(timeout);
            } else {
                setAnnualTableReady(false);
            }
        }, [showAnnualResults, isThirdTerm, annualLoading, annualResults]);
    useEffect(() => {
        fetchSessionsAndTerms();
    }, []);

    useEffect(() => {
        if (selectedSessionId && selectedTermId) {
            fetchStudentResults();
        }
    }, [selectedSessionId, selectedTermId, students]);

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
    }, [selectedSessionId]);

    // Check if current term is the third term when term is selected
    useEffect(() => {
        if (selectedSessionId && selectedTermId) {
            const sessionTerms = terms
                .filter(t => t.session_id === selectedSessionId)
                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
            
            const isThird = sessionTerms.length === 3 && sessionTerms[2].id === selectedTermId;
            setIsThirdTerm(isThird);

            // Load annual results if it's the third term
            if (isThird) {
                fetchAnnualResults();
            }
        }
    }, [selectedSessionId, selectedTermId, terms]);

    async function fetchSessionsAndTerms() {
        try {
            // Fetch sessions
            const { data: sessionsData, error: sessionsError } = await supabase
                .from("sessions")
                .select("*");
            if (sessionsError) throw sessionsError;

            // Fetch terms
            const { data: termsData, error: termsError } = await supabase
                .from("terms")
                .select("*");
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

            // Fetch results for each student
            const { data: resultsData, error: resultsError } = await supabase
                .from("results")
                .select("*")
                .eq("term_id", selectedTermId)
                .eq("session_id", selectedSessionId)
                .in("student_id", currentStudentIds);

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

    async function fetchAnnualResults() {
        setAnnualLoading(true);

        try {
            const currentStudentIds = students.map(s => s.id);
            
            if (currentStudentIds.length === 0) {
                setAnnualResults([]);
                setAnnualLoading(false);
                return;
            }

            // Get all three terms for this session
            const sessionTerms = terms
                .filter(t => t.session_id === selectedSessionId)
                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

            if (sessionTerms.length < 3) {
                toast.error("Less than 3 terms in this session");
                setAnnualLoading(false);
                return;
            }

            const term1Id = sessionTerms[0].id;
            const term2Id = sessionTerms[1].id;
            const term3Id = sessionTerms[2].id;

            // Fetch results for all three terms
            const [results1, results2, results3] = await Promise.all([
                supabase
                    .from("results")
                    .select("*")
                    .eq("term_id", term1Id)
                    .eq("session_id", selectedSessionId)
                    .in("student_id", currentStudentIds),
                supabase
                    .from("results")
                    .select("*")
                    .eq("term_id", term2Id)
                    .eq("session_id", selectedSessionId)
                    .in("student_id", currentStudentIds),
                supabase
                    .from("results")
                    .select("*")
                    .eq("term_id", term3Id)
                    .eq("session_id", selectedSessionId)
                    .in("student_id", currentStudentIds),
            ]);

            // Calculate averages for each term
            const calculateTermAverage = (resultsArray: any[]) => {
                const map = new Map<string, number[]>();
                resultsArray.forEach((result: any) => {
                    if (!map.has(result.student_id)) {
                        map.set(result.student_id, []);
                    }
                    map.get(result.student_id)!.push(result.total || 0);
                });

                const averages = new Map<string, number>();
                map.forEach((scores, studentId) => {
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    averages.set(studentId, avg);
                });
                return averages;
            };

            const term1Averages = calculateTermAverage(results1.data || []);
            const term2Averages = calculateTermAverage(results2.data || []);
            const term3Averages = calculateTermAverage(results3.data || []);

            // Build annual results
            const annualResultsData: AnnualResult[] = students.map((student) => {
                const t1 = term1Averages.get(student.id) || null;
                const t2 = term2Averages.get(student.id) || null;
                const t3 = term3Averages.get(student.id) || null;

                const validScores = [t1, t2, t3].filter((s) => s !== null) as number[];
                const completedTerms = validScores.length;
                const annualAverage = validScores.length > 0
                    ? validScores.reduce((a, b) => a + b, 0) / completedTerms
                    : 0;

                let dataCompleteness: 'complete' | 'partial' | 'incomplete';
                if (completedTerms === 3) dataCompleteness = 'complete';
                else if (completedTerms === 2) dataCompleteness = 'partial';
                else dataCompleteness = 'incomplete';

                return {
                    student_id: student.id,
                    student_name: `${student.first_name} ${student.last_name}`,
                    student_number: student.student_id,
                    gender: student.gender,
                    term1_average: t1,
                    term2_average: t2,
                    term3_average: t3,
                    annual_average: annualAverage,
                    annual_grade: calculateAverageGrade(annualAverage),
                    annual_position: null,
                    completed_terms: completedTerms,
                    data_completeness: dataCompleteness,
                };
            });

            // Sort by annual average (descending)
            annualResultsData.sort((a, b) => b.annual_average - a.annual_average);

            // Assign positions (only if they have ALL three terms)
            let position = 1;
            annualResultsData.forEach((result, index) => {
                if (result.data_completeness === 'complete') {
                    // Check if same average as previous (tie)
                    if (index > 0 && Math.abs(result.annual_average - annualResultsData[index - 1].annual_average) < 0.01) {
                        result.annual_position = annualResultsData[index - 1].annual_position;
                    } else {
                        result.annual_position = position;
                    }
                    position++;
                }
            });

            setAnnualResults(annualResultsData);
        } catch (error) {
            console.error("Error fetching annual results:", error);
            toast.error("Failed to load annual results");
        } finally {
            setAnnualLoading(false);
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

    async function handleExportResultsPDF() {
        try {
            setLoading(true);
            const { default: jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas')).default;

            // Get the results table element
            const table = document.getElementById('results-table');
            if (!table) {
                toast.error("Could not find results table");
                return;
            }

            // Create canvas from table
            const canvas = await html2canvas(table, {
                allowTaint: true,
                useCORS: true,
                scale: 2,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');

            const sessionName = sessions.find((s) => s.id === selectedSessionId)?.name || "Session";
            const termName = terms.find((t) => t.id === selectedTermId)?.name || "Term";
            const title = `${className} - ${sessionName} - ${termName} Results`;

            // Add title
            pdf.setFontSize(16);
            pdf.text(title, 15, 15);

            // Add timestamp
            pdf.setFontSize(10);
            pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 23);

            // Calculate dimensions to fit page
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - 30;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 30;

            // Add image to PDF
            pdf.addImage(imgData, 'PNG', 15, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - position);

            // Add additional pages if needed
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 15, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`${className}-${sessionName}-${termName}-results.pdf`);
            toast.success("PDF exported successfully");
        } catch (error) {
            console.error("Error exporting PDF:", error);
            toast.error("Failed to export as PDF");
        } finally {
            setLoading(false);
        }
    }

    async function handleExportAnnualResultsPDF() {
        try {
            setAnnualLoading(true);
            const { default: jsPDF } = await import('jspdf');
            const html2canvas = (await import('html2canvas')).default;

            // Get the annual results table element
            const table = document.getElementById('annual-results-table');
            if (!table) {
                toast.error("Could not find annual results table");
                return;
            }

            // Create canvas from table
            const canvas = await html2canvas(table, {
                allowTaint: true,
                useCORS: true,
                scale: 2,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');

            const sessionName = sessions.find((s) => s.id === selectedSessionId)?.name || "Session";
            const title = `${className} - ${sessionName} - Annual Performance Rankings`;

            // Add title
            pdf.setFontSize(16);
            pdf.text(title, 15, 15);

            // Add timestamp
            pdf.setFontSize(10);
            pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, 23);

            // Calculate dimensions to fit page
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - 30;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 30;

            // Add image to PDF
            pdf.addImage(imgData, 'PNG', 15, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - position);

            // Add additional pages if needed
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 15, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`${className}-${sessionName}-annual-results.pdf`);
            toast.success("Annual results PDF exported successfully");
        } catch (error) {
            console.error("Error exporting annual results PDF:", error);
            toast.error("Failed to export annual results as PDF");
        } finally {
            setAnnualLoading(false);
        }
    }

    function handleViewStudentReport(studentId: string) {
        // Navigate to student report page
        window.open(`/admin/students/${studentId}/report?term=${selectedTermId}`, "_blank");
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

            // Update all results for each student with their position
            const updatePromises = positionUpdates.map(async ({ studentId, position }) => {
                // Update all results for this student in this term and session
                await supabase
                    .from("results")
                    .update({
                        class_position: position,
                        total_students: studentsWithResults.length,
                        class_average: studentsWithResults.reduce((sum, r) => sum + r.average_score, 0) / studentsWithResults.length
                    })
                    .eq("student_id", studentId)
                    .eq("term_id", selectedTermId)
                    .eq("session_id", selectedSessionId);
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
            <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <CardTitle>Class Results</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            View and manage student results for {className}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {isThirdTerm && (
                            <Button
                                size="sm"
                                onClick={() => setShowAnnualResults(!showAnnualResults)}
                                variant={showAnnualResults ? "default" : "outline"}
                            >
                                <Calculator className="h-4 w-4 mr-1" />
                                {showAnnualResults ? "Term View" : "Annual Results"}
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={() => setIsPublicationDialogOpen(true)}
                            disabled={!selectedSessionId || !selectedTermId}
                        >
                            <Eye className="h-4 w-4 mr-1" />
                            Publish Results
                        </Button>
                        {showAnnualResults && isThirdTerm ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    const table = document.getElementById('annual-results-table');
                                    if (!table) {
                                        toast.error('Annual results table is not ready. Please wait a moment and try again.');
                                        setAnnualTableReady(false);
                                        return;
                                    }
                                    handleExportAnnualResultsPDF();
                                }}
                                disabled={annualLoading || annualResults.length === 0 || !annualTableReady}
                                title={annualTableReady ? '' : 'Wait for table to load before exporting'}
                            >
                                <Download className="h-4 w-4 mr-1" />
                                Export PDF
                            </Button>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={loading || filteredResults.length === 0}
                                    >
                                        <Download className="h-4 w-4 mr-1" />
                                        Export
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={handleExportResults}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Export as Excel
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleExportResultsPDF}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Export as PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Session and Term Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Session</label>
                        <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select session" />
                            </SelectTrigger>
                            <SelectContent>
                                {sessions.map((session) => (
                                    <SelectItem key={session.id} value={session.id}>
                                        {session.name} {session.is_current && "(Current)"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Term</label>
                        <Select value={selectedTermId} onValueChange={setSelectedTermId} disabled={!selectedSessionId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                                {terms
                                    .filter(term => term.session_id === selectedSessionId)
                                    .map((term) => (
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

                {/* Results Table or Annual Results */}
                {showAnnualResults && isThirdTerm ? (
                    // Annual Results View
                    <div className="space-y-6">
                        {/* Annual Results Header */}
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="text-4xl">📊</div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Annual Performance Rankings</h3>
                                    <p className="text-sm text-gray-600">Academic Year Average (All 3 Terms)</p>
                                </div>
                            </div>
                        </div>

                        {/* Annual Summary Stats */}
                        {!annualLoading && annualResults.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                                    <p className="text-sm text-blue-600 font-medium">Total Students</p>
                                    <p className="text-2xl font-bold text-blue-900">{annualResults.length}</p>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                                    <p className="text-sm text-green-600 font-medium">Complete Data</p>
                                    <p className="text-2xl font-bold text-green-900">
                                        {annualResults.filter(r => r.data_completeness === 'complete').length}
                                    </p>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                                    <p className="text-sm text-yellow-600 font-medium">Partial Data</p>
                                    <p className="text-2xl font-bold text-yellow-900">
                                        {annualResults.filter(r => r.data_completeness === 'partial').length}
                                    </p>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                                    <p className="text-sm text-orange-600 font-medium">Incomplete Data</p>
                                    <p className="text-2xl font-bold text-orange-900">
                                        {annualResults.filter(r => r.data_completeness === 'incomplete').length}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Annual Results Table */}
                        {annualLoading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading annual results...</div>
                        ) : (
                            <div className="border rounded-lg overflow-hidden shadow-sm">
                                <table id="annual-results-table" className="w-full text-sm">
                                    <thead className="bg-gradient-to-r from-purple-100 to-blue-100 border-b-2 border-purple-300">
                                        <tr>
                                            <th className="p-4 text-left font-bold text-gray-800 w-12">Rank</th>
                                            <th className="p-4 text-left font-bold text-gray-800">Student Name</th>
                                            <th className="p-4 text-center font-bold text-gray-800">Term 1</th>
                                            <th className="p-4 text-center font-bold text-gray-800">Term 2</th>
                                            <th className="p-4 text-center font-bold text-gray-800">Term 3</th>
                                            <th className="p-4 text-center font-bold text-gray-800">Annual Avg</th>
                                            <th className="p-4 text-center font-bold text-gray-800">Grade</th>
                                            <th className="p-4 text-center font-bold text-gray-800">Data Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {annualResults.map((result, i) => (
                                            <tr
                                                key={result.student_id}
                                                className={`border-b transition-colors ${
                                                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                                } hover:bg-purple-50`}
                                            >
                                                <td className="p-4">
                                                    {result.data_completeness === 'complete' && result.annual_position ? (
                                                        getPositionDisplay(result.annual_position)
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{result.student_name}</p>
                                                        <p className="text-xs text-gray-500">{result.student_number}</p>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {result.term1_average !== null ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-blue-600">
                                                                {result.term1_average.toFixed(1)}
                                                            </span>
                                                            <span className="text-xs text-gray-500">out of 100</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-medium">No data</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {result.term2_average !== null ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-green-600">
                                                                {result.term2_average.toFixed(1)}
                                                            </span>
                                                            <span className="text-xs text-gray-500">out of 100</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-medium">No data</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {result.term3_average !== null ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-bold text-purple-600">
                                                                {result.term3_average.toFixed(1)}
                                                            </span>
                                                            <span className="text-xs text-gray-500">out of 100</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 font-medium">No data</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-lg font-bold text-gray-900">
                                                            {result.annual_average > 0 ? result.annual_average.toFixed(1) : '—'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {result.completed_terms > 0 ? `(${result.completed_terms} terms)` : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    {result.annual_average > 0 ? (
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-sm font-bold ${getGradeColor(result.annual_grade)}`}
                                                        >
                                                            {result.annual_grade}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-center">
                                                    {result.data_completeness === 'complete' && (
                                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                                            <span className="text-lg mr-1">✓</span> Complete
                                                        </Badge>
                                                    )}
                                                    {result.data_completeness === 'partial' && (
                                                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                                            <span className="text-lg mr-1">⚠</span> Partial ({result.completed_terms}/3)
                                                        </Badge>
                                                    )}
                                                    {result.data_completeness === 'incomplete' && (
                                                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                                            <span className="text-lg mr-1">✕</span> Incomplete ({result.completed_terms}/3)
                                                        </Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {annualResults.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No student results found for annual calculation.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Data Completeness Legend */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                            <h4 className="font-semibold text-blue-900">Data Status Legend:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-start gap-2">
                                    <span className="text-2xl">✓</span>
                                    <div>
                                        <p className="font-medium text-gray-900">Complete</p>
                                        <p className="text-sm text-gray-600">Student has results for all 3 terms - ranking is valid</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-2xl">⚠</span>
                                    <div>
                                        <p className="font-medium text-gray-900">Partial</p>
                                        <p className="text-sm text-gray-600">Student has results for 2 terms only - average calculated from available data</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <span className="text-2xl">✕</span>
                                    <div>
                                        <p className="font-medium text-gray-900">Incomplete</p>
                                        <p className="text-sm text-gray-600">Student has results for only 1 term - not ranked in annual standings</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Regular Results Table (Term View)
                    <>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Loading results...</div>
                        ) : !selectedSessionId || !selectedTermId ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Please select a session and term to view results
                            </div>
                        ) : (
                            <div className="border rounded-md overflow-hidden">
                        <table id="results-table" className="w-full text-sm">
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
                                                                        const { data: attendance, error } = await supabase
                                                                            .from("attendance")
                                                                            .select("*")
                                                                            .eq("student_id", result.student_id);

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
                            <div className="p-8 text-center text-muted-foreground">
                                {search || genderFilter !== "all" || performanceFilter !== "all"
                                    ? "No results match your filters."
                                    : "No student results found for this term."}
                            </div>
                        )}
                            </div>
                        )}
                    </>
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
            />
        </Card>


    );
}