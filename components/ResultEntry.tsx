"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Student, Class as ClassType, Session, Term } from "@/lib/types";
import { toast } from "sonner";
import { getCurrentUser, getTeacherByUserId } from "@/lib/auth";
import { Save, Printer, ArrowLeft, Loader2, Medal, FileDown } from "lucide-react";

interface SubjectScore {
  subject_class_id: string;
  subject_name: string;
  welcome_test: number;
  mid_term_test: number;
  vetting: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
}

interface ResultEntryProps {
  studentId: string;
  role: 'admin' | 'class_teacher' | 'teacher' | 'student';
  canEditPrincipalComment: boolean;
  canEdit: boolean;
  isReadOnly: boolean;
  teacherName?: string;
  sessionId?: string;
  termId?: string;
}

export default function ResultEntry({
  studentId,
  role,
  canEditPrincipalComment,
  canEdit,
  isReadOnly,
  teacherName: initialTeacherName = "",
  sessionId,
  termId
}: ResultEntryProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const [student, setStudent] = useState<Student | null>(null);
  const [studentClass, setStudentClass] = useState<ClassType | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [term, setTerm] = useState<Term | null>(null);
  const [scores, setScores] = useState<SubjectScore[]>([]);
  const [attendance, setAttendance] = useState(0);
  const [nextTermDate, setNextTermDate] = useState("");
  const [classTeacherRemark, setClassTeacherRemark] = useState("");
  const [principalRemark, setPrincipalRemark] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherName, setTeacherName] = useState<string>(initialTeacherName);
  const [scoreCalculationMode, setScoreCalculationMode] = useState<'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all'>('all');
  const [classPosition, setClassPosition] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [classAverage, setClassAverage] = useState<number | null>(null);

  // Publication settings
  const [publicationSettings, setPublicationSettings] = useState<any>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (studentId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, sessionId, termId]);

  async function loadData() {
    setIsLoading(true);
    try {
      // 1. Student
      const { data: studentData } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (!studentData) {
        toast.error("Student not found");
        setIsLoading(false);
        return;
      }

      setStudent(studentData);

      // 2. Class
      const { data: classData } = await supabase
        .from("classes")
        .select("*")
        .eq("id", studentData.class_id)
        .single();

      if (classData) setStudentClass(classData);

      // 3. Session & Term (use props if provided)
      let sessionData: Session | null = null;
      let termData: Term | null = null;
      if (sessionId) {
        const { data } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();
        sessionData = data;
      } else {
        const { data } = await supabase
          .from("sessions")
          .select("*")
          .eq("is_current", true)
          .single();
        sessionData = data;
      }
      if (termId) {
        const { data } = await supabase
          .from("terms")
          .select("*")
          .eq("id", termId)
          .single();
        termData = data;
      } else {
        const { data } = await supabase
          .from("terms")
          .select("*")
          .eq("is_current", true)
          .single();
        termData = data;
      }

      if (!sessionData || !termData) {
        toast.error("No active session or term");
        setIsLoading(false);
        return;
      }

      setSession(sessionData);
      setTerm(termData);

      // 3.5 Load publication settings (for students)
      let currentCalculationMode: 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all' = 'all';
      if (role === 'student') {
        const { data: pubSettings } = await supabase
          .from("results_publication")
          .select("*")
          .eq("class_id", studentData.class_id)
          .eq("session_id", sessionData.id)
          .eq("term_id", termData!.id)
          .single();

        if (pubSettings) {
          setPublicationSettings(pubSettings);
          setIsPublished(pubSettings.is_published);
          // Set calculation mode to match published mode
          if (pubSettings.calculation_mode) {
            currentCalculationMode = pubSettings.calculation_mode;
            setScoreCalculationMode(pubSettings.calculation_mode);
          }
        } else {
          // No publication settings = results not visible to students
          setIsPublished(false);
        }
      } else {
        // Admin/teachers always have access
        setIsPublished(true);
      }

      // 4. Load subject_classes for this student's class
      const { data: subjectClasses, error: scError } = await supabase
        .from("subject_classes")
        .select(`
    id,
    subjects (
        id,
        name,
        is_optional,
        religion,
        department
      )
  `)
        .eq("class_id", studentData.class_id);

      // 4b. Get optional subjects for this student
      const { data: optionalSubjectRows, error: optError } = await supabase
        .from("student_optional_subjects")
        .select("subject_id")
        .eq("student_id", studentId);
      const optionalSubjectIds = (optionalSubjectRows || []).map(row => row.subject_id);

      if (scError || !subjectClasses || subjectClasses.length === 0) {
        toast.error("No subjects assigned to this class");
        setIsLoading(false);
        return;
      }

      const filteredSubjectClasses = subjectClasses.filter((sc: any) => {
        const subject = sc.subjects;
        if (!subject) return false;
        // If subject is optional, only show if student is enrolled
        if (subject.is_optional) {
          return optionalSubjectIds.includes(subject.id);
        }
        // For compulsory subjects, filter by department if needed
        if (!subject.department || subject.department === '') return true;
        return subject.department === studentData.department;
      });

      if (filteredSubjectClasses.length === 0) {
        toast.error("No subjects match this student's category");
        setIsLoading(false);
        return;
      }

      filteredSubjectClasses.sort((a: any, b: any) => {
        const nameA = (a.subjects?.name || '').toLowerCase();
        const nameB = (b.subjects?.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      let initialScores: SubjectScore[] = filteredSubjectClasses.map((sc: any) => ({
        subject_class_id: sc.id,
        subject_name: sc.subjects?.name ?? "Unknown",
        welcome_test: 0,
        mid_term_test: 0,
        vetting: 0,
        exam: 0,
        total: 0,
        grade: "",
        remark: "",
      }));

      // 6. Determine next term logic
      let nextTermDateValue = "";
      try {
        if (termData) {
          const { data: allTerms } = await supabase
            .from("terms")
            .select("*")
            .eq("session_id", sessionData.id)
            .order("start_date", { ascending: true });

          const currentTermIdx = allTerms?.findIndex((t: any) => t.id === termData!.id);

          if (allTerms && currentTermIdx !== undefined && currentTermIdx > -1) {
            // If not last term, next term is in this session
            if (currentTermIdx < allTerms.length - 1) {
              const nextTerm = allTerms[currentTermIdx + 1];
              nextTermDateValue = nextTerm?.start_date || "";
            } else {
              // Last term, get first term of next session using date comparison
              const { data: nextSession } = await supabase
                .from("sessions")
                .select("*")
                .gt("start_date", sessionData.end_date || sessionData.start_date)
                .order("start_date", { ascending: true })
                .limit(1)
                .maybeSingle();

              if (nextSession) {
                const { data: nextSessionTerms } = await supabase
                  .from("terms")
                  .select("*")
                  .eq("session_id", nextSession.id)
                  .order("start_date", { ascending: true });

                if (nextSessionTerms && nextSessionTerms.length > 0) {
                  nextTermDateValue = nextSessionTerms[0].start_date || "";
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error determining next term date:', e);
      }

      setNextTermDate(nextTermDateValue || "");

      // 7. Load existing results
      const { data: existingResults } = await supabase
        .from("results")
        .select("*")
        .eq("student_id", studentId)
        .eq("session_id", sessionData.id)
        .eq("term_id", termData!.id);

      if (existingResults && existingResults.length > 0) {
        const first = existingResults[0];
        setClassTeacherRemark(first.class_teacher_remark || "");
        setPrincipalRemark(first.principal_remark || "");
        // Only set position if it exists for THIS specific term
        setClassPosition(first.class_position ?? null);
        setTotalStudents(first.total_students ?? null);
        setClassAverage(first.class_average ?? null);
        // Load saved next term date if it exists
        if (first.next_term_begins) {
          setNextTermDate(first.next_term_begins);
        }
        for (const res of existingResults) {
          const idx = initialScores.findIndex(
            (s) => s.subject_class_id === res.subject_class_id
          );
          if (idx >= 0) {
            initialScores[idx] = {
              ...initialScores[idx],
              welcome_test: res.welcome_test || 0,
              mid_term_test: res.mid_term_test || 0,
              vetting: res.vetting || 0,
              exam: res.exam || 0,
            };
            const total = calculateTotalScoreWithMode(initialScores[idx], currentCalculationMode);
            const { grade, remark } = calculateGradeWithMode(total, currentCalculationMode);
            initialScores[idx].total = total;
            initialScores[idx].grade = grade;
            initialScores[idx].remark = res.remark || remark;
          }
        }
      } else {
        // No results for this term, reset position data
        setClassPosition(null);
        setTotalStudents(null);
        setClassAverage(null);
      }

      setScores(initialScores);

      // 8. Attendance - try with session/term filters first, fallback to just student_id
      let attendanceCount = 0;
      try {
        const { count: countWithFilters } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("student_id", studentId)
          .eq("session_id", sessionData.id)
          .eq("term_id", termData!.id);

        if (countWithFilters !== null && countWithFilters > 0) {
          attendanceCount = countWithFilters;
        } else {
          // Fallback: count all attendance for this student (some schemas might not have session/term)
          const { count: countAll } = await supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("student_id", studentId);
          attendanceCount = countAll || 0;
        }
      } catch (e) {
        // If query fails, try basic count
        const { count } = await supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("student_id", studentId);
        attendanceCount = count || 0;
      }

      setAttendance(attendanceCount);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }

  // Helper to check if a component should be visible
  function isComponentVisible(component: 'welcome_test' | 'mid_term_test' | 'vetting' | 'exam'): boolean {
    // Admin and teachers can always see all components
    if (role !== 'student') return true;

    // Students can only see published components
    if (!publicationSettings || !isPublished) return false;

    const visibilityMap = {
      'welcome_test': publicationSettings.welcome_test_published,
      'mid_term_test': publicationSettings.mid_term_test_published,
      'vetting': publicationSettings.vetting_published,
      'exam': publicationSettings.exam_published,
    };

    return visibilityMap[component] || false;
  }

  function calculateTotalScore(score: SubjectScore): number {
    switch (scoreCalculationMode) {
      case 'welcome_only':
        return score.welcome_test;
      case 'welcome_midterm':
        return score.welcome_test + score.mid_term_test;
      case 'welcome_midterm_vetting':
        return score.welcome_test + score.mid_term_test + score.vetting;
      case 'all':
      default:
        return score.welcome_test + score.mid_term_test + score.vetting + score.exam;
    }
  }

  function calculateTotalScoreWithMode(score: SubjectScore, mode: 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all'): number {
    switch (mode) {
      case 'welcome_only':
        return score.welcome_test;
      case 'welcome_midterm':
        return score.welcome_test + score.mid_term_test;
      case 'welcome_midterm_vetting':
        return score.welcome_test + score.mid_term_test + score.vetting;
      case 'all':
      default:
        return score.welcome_test + score.mid_term_test + score.vetting + score.exam;
    }
  }

  function getMaxPossibleScore(): number {
    switch (scoreCalculationMode) {
      case 'welcome_only':
        return 10;
      case 'welcome_midterm':
        return 30;
      case 'welcome_midterm_vetting':
        return 40;
      case 'all':
      default:
        return 100;
    }
  }

  function getMaxPossibleScoreWithMode(mode: 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all'): number {
    switch (mode) {
      case 'welcome_only':
        return 10;
      case 'welcome_midterm':
        return 30;
      case 'welcome_midterm_vetting':
        return 40;
      case 'all':
      default:
        return 100;
    }
  }

  function calculateGrade(total: number) {
    const maxScore = getMaxPossibleScore();
    const percentage = (total / maxScore) * 100;
    if (percentage >= 75) return { grade: "A1", remark: "Excellent" };
    if (percentage >= 70) return { grade: "B2", remark: "Very Good" };
    if (percentage >= 65) return { grade: "B3", remark: "Good" };
    if (percentage >= 60) return { grade: "C4", remark: "Credit" };
    if (percentage >= 55) return { grade: "C5", remark: "Credit" };
    if (percentage >= 50) return { grade: "C6", remark: "Credit" };
    if (percentage >= 45) return { grade: "D7", remark: "Pass" };
    if (percentage >= 40) return { grade: "E8", remark: "Pass" };
    return { grade: "F9", remark: "Fail" };
  }

  function calculateGradeWithMode(total: number, mode: 'welcome_only' | 'welcome_midterm' | 'welcome_midterm_vetting' | 'all') {
    const maxScore = getMaxPossibleScoreWithMode(mode);
    const percentage = (total / maxScore) * 100;
    if (percentage >= 75) return { grade: "A1", remark: "Excellent" };
    if (percentage >= 70) return { grade: "B2", remark: "Very Good" };
    if (percentage >= 65) return { grade: "B3", remark: "Good" };
    if (percentage >= 60) return { grade: "C4", remark: "Credit" };
    if (percentage >= 55) return { grade: "C5", remark: "Credit" };
    if (percentage >= 50) return { grade: "C6", remark: "Credit" };
    if (percentage >= 45) return { grade: "D7", remark: "Pass" };
    if (percentage >= 40) return { grade: "E8", remark: "Pass" };
    return { grade: "F9", remark: "Fail" };
  }

  function updateScore(index: number, field: keyof SubjectScore, value: string) {
    if (isReadOnly || !canEdit) return;
    const newScores = [...scores];
    let num = Math.max(0, Number(value) || 0);
    const limits: Record<string, number> = {
      welcome_test: 10,
      mid_term_test: 20,
      vetting: 10,
      exam: 60,
    };
    if (limits[field]) {
      num = Math.min(num, limits[field]);
    }
    (newScores[index] as any)[field] = num;
    const total = calculateTotalScore(newScores[index]);
    const { grade, remark } = calculateGrade(total);
    newScores[index].total = total;
    newScores[index].grade = grade;
    newScores[index].remark = remark;
    setScores(newScores);
  }

  useEffect(() => {
    if (scores.length > 0) {
      const updatedScores = scores.map(score => {
        const total = calculateTotalScore(score);
        const { grade, remark } = calculateGrade(total);
        return { ...score, total, grade, remark };
      });
      setScores(updatedScores);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreCalculationMode]);

  // Calculate visible columns count for table alignment (columns before Total column)
  const visibleColumnsCount = (() => {
    let count = 1; // Subject name column
    if (isComponentVisible('welcome_test')) count++;
    if (isComponentVisible('mid_term_test')) count++;
    if (isComponentVisible('vetting')) count++;
    if (isComponentVisible('exam')) count++;
    return count;
  })();

  const totalScore = scores.reduce((sum, s) => sum + s.total, 0);
  const overallGrade = (() => {
    const avgScore = scores.length > 0 ? totalScore / scores.length : 0;
    return calculateGrade(avgScore).grade;
  })();
  const maxTotalScore = scores.length * getMaxPossibleScore();
  const averagePercentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;

  const getPositionDisplay = (position: number | null | undefined) => {
    if (!position) return null;
    if (position === 1) {
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🥇</span>
          <span className="font-bold text-yellow-600 text-xl">1st</span>
        </div>
      );
    }
    if (position === 2) {
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🥈</span>
          <span className="font-bold text-gray-600 text-xl">2nd</span>
        </div>
      );
    }
    if (position === 3) {
      return (
        <div className="flex items-center justify-center gap-2">
          <span className="text-2xl">🥉</span>
          <span className="font-bold text-amber-700 text-xl">3rd</span>
        </div>
      );
    }
    return <span className="font-semibold text-gray-700 text-xl">{position}th</span>;
  };

  function handlePrint() {
    window.print();
  }

  async function handleExportPDF() {
    if (!printRef.current) return;

    try {
      // Dynamically import html2pdf only on client side
      const html2pdf = (await import('html2pdf.js')).default;

      const element = printRef.current;
      const opt = {
        margin: 0.5,
        filename: `${student?.first_name}_${student?.last_name}_Report_${session?.name}_${term?.name}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      toast.info('Generating PDF...');
      await html2pdf().set(opt).from(element).save();
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  }

  async function handleSave() {
    if (!canEdit || isReadOnly || !student || !session || !term) return;
    setIsSaving(true);
    try {
      const user = await getCurrentUser();
      const teacher = user ? await getTeacherByUserId(user.id) : null;
      const records = scores.map((s) => ({
        student_id: student.id,
        subject_class_id: s.subject_class_id,
        session_id: sessionId || session.id,
        term_id: termId || term.id,
        welcome_test: s.welcome_test,
        mid_term_test: s.mid_term_test,
        vetting: s.vetting,
        exam: s.exam,
        total: s.total,
        grade: s.grade,
        remark: s.remark,
        class_teacher_remark: classTeacherRemark,
        class_teacher_name: teacher
          ? `${teacher.first_name} ${teacher.last_name}`
          : "",
        principal_remark: principalRemark,
        next_term_begins: nextTermDate || null,
        entered_by: teacher?.id,
      }));
      const { error } = await supabase.from("results").upsert(records, {
        onConflict: "student_id,subject_class_id,session_id,term_id",
      });
      if (error) throw error;
      toast.success("Results saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save results");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-between print:hidden">
        {/* No back button here, parent page should handle navigation */}
        <div className="flex gap-2">
          <Select value={scoreCalculationMode} onValueChange={(value: any) => setScoreCalculationMode(value)} disabled={isReadOnly || !canEdit}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select calculation method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="welcome_only">Welcome Test Only (10)</SelectItem>
              <SelectItem value="welcome_midterm">Welcome + Mid-Term (30)</SelectItem>
              <SelectItem value="welcome_midterm_vetting">Welcome + Mid-Term + Vetting (40)</SelectItem>
              <SelectItem value="all">All Components (100)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Export as PDF
          </Button>
          {canEdit && !isReadOnly && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Results
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent id="printable-content" ref={printRef} className="p-8">
          <div className="space-y-6">
            <div className="flex items-start justify-between border-b pb-6">
              <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-xs text-gray-400">LOGO</span>
              </div>
              <div className="text-center flex-1 mx-4">
                <h1 className="text-2xl font-bold">SCHOOL NAME</h1>
                <p className="text-sm text-gray-600 mt-1">School Address, City, State</p>
                <p className="text-sm text-gray-600">Tel: +234 XXX XXX XXXX</p>
                <p className="text-lg font-semibold mt-2 text-blue-600">STUDENT REPORT CARD</p>
              </div>
              <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-xs text-gray-400">PHOTO</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p><strong>Name:</strong> {student.first_name} {student.last_name}</p>
                <p><strong>Class:</strong> {studentClass?.name}</p>
                <p><strong>Session:</strong> {session?.name}</p>
              </div>
              <div>
                <p><strong>Term:</strong> {term?.name}</p>
                <p><strong>No. of Attendance:</strong> {attendance}</p>
                <p>
                  <strong>Next Term Begins:</strong> {nextTermDate && !isNaN(new Date(nextTermDate).getTime()) ? new Date(nextTermDate).toLocaleDateString('en-GB') : 'N/A'}                </p>
              </div>
            </div>
            {classPosition && (
              <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Class Position</p>
                    <div className="mt-1">{getPositionDisplay(classPosition)}</div>
                  </div>
                  {totalStudents && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Out of</p>
                      <p className="text-2xl font-bold text-gray-800">{totalStudents}</p>
                      <p className="text-xs text-gray-500">students</p>
                    </div>
                  )}
                  {classAverage && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Class Average</p>
                      <p className="text-2xl font-bold text-gray-800">{classAverage.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mt-6">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Subject</th>
                    {isComponentVisible('welcome_test') && (
                      <th className="border border-gray-300 px-3 py-2 text-center w-20">
                        Welcome Test (10)
                      </th>
                    )}
                    {isComponentVisible('mid_term_test') && (
                      <th className="border border-gray-300 px-3 py-2 text-center w-20">
                        Mid-Term (20)
                      </th>
                    )}
                    {isComponentVisible('vetting') && (
                      <th className="border border-gray-300 px-3 py-2 text-center w-20">
                        Vetting (10)
                      </th>
                    )}
                    {isComponentVisible('exam') && (
                      <th className="border border-gray-300 px-3 py-2 text-center w-20">
                        Exam (60)
                      </th>
                    )}
                    <th className="border border-gray-300 px-3 py-2 text-center w-20">
                      Total ({getMaxPossibleScore()})
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-center w-16">Grade</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score, index) => (
                    <tr key={score.subject_class_id}>
                      <td className="border border-gray-300 px-3 py-2 font-medium">
                        {score.subject_name}
                      </td>
                      {isComponentVisible('welcome_test') && (
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={score.welcome_test || ''}
                            onChange={(e) => updateScore(index, 'welcome_test', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                            disabled={isReadOnly || !canEdit}
                          />
                        </td>
                      )}
                      {isComponentVisible('mid_term_test') && (
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={score.mid_term_test || ''}
                            onChange={(e) => updateScore(index, 'mid_term_test', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                            disabled={isReadOnly || !canEdit}
                          />
                        </td>
                      )}
                      {isComponentVisible('vetting') && (
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={score.vetting || ''}
                            onChange={(e) => updateScore(index, 'vetting', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                            disabled={isReadOnly || !canEdit}
                          />
                        </td>
                      )}
                      {isComponentVisible('exam') && (
                        <td className="border border-gray-300 px-1 py-1 text-center">
                          <input
                            type="number"
                            min="0"
                            max="60"
                            value={score.exam || ''}
                            onChange={(e) => updateScore(index, 'exam', e.target.value)}
                            className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded print:border-0 print:focus:ring-0"
                            disabled={isReadOnly || !canEdit}
                          />
                        </td>
                      )}
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                        {score.total}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold">
                        {score.grade}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        {score.remark}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan={visibleColumnsCount} className="border border-gray-300 px-3 py-2 text-right">
                      TOTAL SCORE:
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-lg">
                      {totalScore}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-center text-lg">
                      {overallGrade}
                    </td>
                    <td className="border border-gray-300 px-3 py-2"></td>
                  </tr>
                  <tr className="bg-green-50">
                    <td colSpan={visibleColumnsCount} className="border border-gray-300 px-3 py-2 text-right font-semibold">
                      AVERAGE PERCENTAGE:
                    </td>
                    <td colSpan={3} className="border border-gray-300 px-3 py-2 text-center font-bold text-lg">
                      {averagePercentage.toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-1 gap-6 mt-8">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Class Teacher's Remark:
                </label>
                <Textarea
                  value={classTeacherRemark}
                  onChange={(e) => setClassTeacherRemark(e.target.value)}
                  placeholder="Enter class teacher's remark..."
                  rows={3}
                  className="print:border-0 print:bg-transparent"
                  disabled={isReadOnly || !canEdit}
                />
                <div className="mt-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">
                      Name: {teacherName ? teacherName : "_________________________"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Signature: _________________________</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Principal's Comment:
                </label>
                <Textarea
                  value={principalRemark}
                  onChange={(e) => canEditPrincipalComment && !isReadOnly ? setPrincipalRemark(e.target.value) : undefined}
                  placeholder="Enter principal's comment..."
                  rows={3}
                  className="print:border-0 print:bg-transparent"
                  disabled={isReadOnly || !canEditPrincipalComment}
                />
                <div className="mt-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Signature: _________________________</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Date: {new Date().toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-content,
          #printable-content * {
            visibility: visible;
          }
          #printable-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          input {
            border: none !important;
            background: transparent !important;
            text-align: center !important;
            -webkit-appearance: none;
            -moz-appearance: textfield;
          }
          textarea {
            border: none !important;
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
}
