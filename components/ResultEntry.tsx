"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Student, Class as ClassType, Session, Term } from "@/lib/types";
import { toast } from "sonner";
import { Save, Printer, Loader2, FileDown } from "lucide-react";

interface SubjectScore {
  subject_class_id: string;
  subject_name: string;
  component_scores: Record<string, number>;
  welcome_test: number;
  mid_term_test: number;
  vetting: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
}

interface ResultComponentTemplate {
  component_key: string;
  component_name: string;
  max_score: number;
  display_order: number;
  is_active: boolean;
}

interface ResultGradeScale {
  grade_label: string;
  min_percentage: number;
  remark: string;
  display_order: number;
}

interface ResultEntryProps {
  studentId: string;
  role: 'admin' | 'class_teacher' | 'teacher' | 'student' | 'parent';
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
  const [classPosition, setClassPosition] = useState<number | null>(null);
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [classAverage, setClassAverage] = useState<number | null>(null);
  const [resultComponents, setResultComponents] = useState<ResultComponentTemplate[]>([]);
  const [gradeScale, setGradeScale] = useState<ResultGradeScale[]>([]);
  const [configuredPassPercentage, setConfiguredPassPercentage] = useState<number>(40);

  // Publication settings
  const [publicationSettings, setPublicationSettings] = useState<any>(null);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (studentId) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, sessionId, termId]);

  function getComponentScore(score: SubjectScore, componentKey: string): number {
    const dynamicValue = score.component_scores?.[componentKey];
    if (typeof dynamicValue === 'number') return dynamicValue;

    if (componentKey === 'welcome_test') return score.welcome_test || 0;
    if (componentKey === 'mid_term_test') return score.mid_term_test || 0;
    if (componentKey === 'vetting') return score.vetting || 0;
    if (componentKey === 'exam') return score.exam || 0;
    return 0;
  }

  function setComponentScore(score: SubjectScore, componentKey: string, value: number): SubjectScore {
    const next: SubjectScore = {
      ...score,
      component_scores: {
        ...score.component_scores,
        [componentKey]: value,
      },
    };

    if (componentKey === 'welcome_test') next.welcome_test = value;
    if (componentKey === 'mid_term_test') next.mid_term_test = value;
    if (componentKey === 'vetting') next.vetting = value;
    if (componentKey === 'exam') next.exam = value;

    return next;
  }

  function getVisibleComponentKeys(): string[] {
    const active = resultComponents.filter((component) => component.is_active).map((component) => component.component_key);

    if (role === 'student' || role === 'parent') {
      if (!publicationSettings || !isPublished) return [];
      return active.filter((key) => isComponentVisible(key));
    }

    return active;
  }

  function getVisibleComponentTemplates() {
    const visibleKeys = new Set(getVisibleComponentKeys());
    return resultComponents.filter((component) => component.is_active && visibleKeys.has(component.component_key));
  }

  function resolveGradeFromPercentage(percentage: number, passPercentage: number) {
    const sortedScale = [...gradeScale].sort((a, b) => b.min_percentage - a.min_percentage);
    const fallback = sortedScale[sortedScale.length - 1] || { grade_label: "F9", remark: "Fail", min_percentage: 0, display_order: 99 };
    const matched = sortedScale.find((item) => percentage >= item.min_percentage) || fallback;

    if (percentage < passPercentage) {
      return { grade: fallback.grade_label, remark: fallback.remark || "Fail" };
    }

    return { grade: matched.grade_label, remark: matched.remark || "" };
  }

  async function loadData() {
    setIsLoading(true);
    try {
      // Get current user and teacher info if needed
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const user = authSession?.user;

      // Get school_id from teacher, admin, or student profile
      let schoolId = null;
      if (user) {
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('school_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (teacherData) {
          schoolId = teacherData.school_id;
        } else {
          const { data: adminData } = await supabase
            .from('admins')
            .select('school_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (adminData) {
            schoolId = adminData.school_id;
          } else {
            const { data: studentData } = await supabase
              .from('students')
              .select('school_id')
              .eq('user_id', user.id)
              .maybeSingle();
            if (studentData) schoolId = studentData.school_id;
          }
        }
      }

      // 1. Student
      let studentQuery = supabase
        .from("students")
        .select("*")
        .eq("id", studentId);

      if (schoolId) {
        studentQuery = studentQuery.eq("school_id", schoolId);
      }

      const { data: studentData } = await studentQuery.single();

      if (!studentData) {
        toast.error("Student not found");
        setIsLoading(false);
        return;
      }

      setStudent(studentData);

      if (!schoolId && studentData.school_id) {
        schoolId = studentData.school_id;
      }

      // 1.5 Load configurable result settings from school setup
      if (schoolId) {
        const [{ data: settingsData }, { data: componentRows }, { data: gradeRows }] = await Promise.all([
          supabase
            .from("result_school_settings")
            .select("pass_percentage, is_configured")
            .eq("school_id", schoolId)
            .maybeSingle(),
          supabase
            .from("result_component_templates")
            .select("component_key, component_name, max_score, display_order, is_active")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
          supabase
            .from("result_grade_scales")
            .select("grade_label, min_percentage, remark, display_order")
            .eq("school_id", schoolId)
            .order("display_order", { ascending: true }),
        ]);

        if (settingsData?.is_configured && componentRows && componentRows.length > 0) {
          setConfiguredPassPercentage(Number(settingsData.pass_percentage) || 40);
          setResultComponents(componentRows as ResultComponentTemplate[]);
          setGradeScale((gradeRows || []) as ResultGradeScale[]);
        } else {
          setConfiguredPassPercentage(Number(settingsData?.pass_percentage) || 40);
          setResultComponents([]);
          setGradeScale((gradeRows || []) as ResultGradeScale[]);
        }
      } else {
        setConfiguredPassPercentage(40);
        setResultComponents([]);
        setGradeScale([]);
      }

      // 2. Class
      let classQuery = supabase
        .from("classes")
        .select("*")
        .eq("id", studentData.class_id);

      if (schoolId) {
        classQuery = classQuery.eq("school_id", schoolId);
      }

      const { data: classData } = await classQuery.single();

      if (classData) setStudentClass(classData);

      // 3. Session & Term (use props if provided)
      let sessionData: Session | null = null;
      let termData: Term | null = null;
      if (sessionId) {
        let sQuery = supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId);
        if (schoolId) sQuery = sQuery.eq("school_id", schoolId);
        const { data } = await sQuery.single();
        sessionData = data;
      } else {
        let sQuery = supabase
          .from("sessions")
          .select("*")
          .eq("is_current", true);
        if (schoolId) sQuery = sQuery.eq("school_id", schoolId);
        const { data } = await sQuery.single();
        sessionData = data;
      }
      if (termId) {
        let tQuery = supabase
          .from("terms")
          .select("*")
          .eq("id", termId);
        if (schoolId) tQuery = tQuery.eq("school_id", schoolId);
        const { data } = await tQuery.single();
        termData = data;
      } else {
        let tQuery = supabase
          .from("terms")
          .select("*")
          .eq("is_current", true);
        if (schoolId) tQuery = tQuery.eq("school_id", schoolId);
        const { data } = await tQuery.single();
        termData = data;
      }

      if (!sessionData || !termData) {
        toast.error("No active session or term");
        setIsLoading(false);
        return;
      }

      setSession(sessionData);
      setTerm(termData);

      // 3.5 Load publication settings (for students and parents)
      if (role === 'student' || role === 'parent') {
        let pubQuery = supabase
          .from("results_publication")
          .select("*")
          .eq("class_id", studentData.class_id)
          .eq("session_id", sessionData.id)
          .eq("term_id", termData!.id);

        if (schoolId) {
          pubQuery = pubQuery.eq("school_id", schoolId);
        }

        const { data: pubSettings } = await pubQuery.single();

        if (pubSettings) {
          setPublicationSettings(pubSettings);
          // Check appropriate publication flag based on role
          if (role === 'parent') {
            setIsPublished(pubSettings.is_published_to_parents);
          } else {
            setIsPublished(pubSettings.is_published);
          }
        } else {
          // No publication settings = results not visible to students/parents
          setIsPublished(false);
        }
      } else {
        // Admin/teachers always have access
        setIsPublished(true);
      }

      // 4. Load subject_classes for this student's class
      let scQuery = supabase
        .from("subject_classes")
        .select(`
          id,
          subject_code,
          subject_id,
          department_id,
          religion_id,
          is_optional,
          department:department_id(name),
          religion:religion_id(name),
          subjects:subject_id(id, name),
          teachers:teacher_id(id, first_name, last_name)
        `)
        .eq("class_id", studentData.class_id);

      if (schoolId) {
        scQuery = scQuery.eq("school_id", schoolId);
      }

      const { data: subjectClasses, error: scError } = await scQuery;

      // 4b. Get optional subjects for this student
      let optQuery = supabase
        .from("student_optional_subjects")
        .select("subject_id")
        .eq("student_id", studentId);

      if (schoolId) {
        optQuery = optQuery.eq("school_id", schoolId);
      }

      const { data: optionalSubjectRows, error: optError } = await optQuery;
      const optionalSubjectIds = (optionalSubjectRows || [])
        .map((row: { subject_id: string }) => row.subject_id)
        .filter((row: string) => row);

      if (scError || !subjectClasses || subjectClasses.length === 0) {
        toast.error("No subjects assigned to this class");
        setIsLoading(false);
        return;
      }

      const filteredSubjectClasses = subjectClasses.filter((sc: any) => {
        const subject = sc.subjects;
        if (!subject) return false;
        
        // If subject is optional, only show if student is enrolled
        if (sc.is_optional) {
          return optionalSubjectIds.includes(subject.id);
        }
        
        // For compulsory subjects, apply department and religion filters
        // Filter by department if specified in subject_class
        if (sc.department_id && sc.department_id !== studentData.department_id) {
          return false;
        }
        
        // Filter by religion if specified in subject_class
        if (sc.religion_id && sc.religion_id !== studentData.religion_id) {
          return false;
        }
        
        return true;
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
        component_scores: {},
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
          let allTermsQuery = supabase
            .from("terms")
            .select("*")
            .eq("session_id", sessionData.id);

          if (schoolId) {
            allTermsQuery = allTermsQuery.eq("school_id", schoolId);
          }

          const { data: allTerms } = await allTermsQuery.order("start_date", { ascending: true });

          const currentTermIdx = allTerms?.findIndex((t: any) => t.id === termData!.id);

          if (allTerms && currentTermIdx !== undefined && currentTermIdx > -1) {
            // If not last term, next term is in this session
            if (currentTermIdx < allTerms.length - 1) {
              const nextTerm = allTerms[currentTermIdx + 1];
              nextTermDateValue = nextTerm?.start_date || "";
            } else {
              // Last term in session, get first term that starts after this term ends
              let nextTermsQuery = supabase
                .from("terms")
                .select("*")
                .gt("start_date", termData.end_date || termData.start_date);

              if (schoolId) {
                nextTermsQuery = nextTermsQuery.eq("school_id", schoolId);
              }

              const { data: nextTerms } = await nextTermsQuery
                .order("start_date", { ascending: true })
                .limit(1);

              if (nextTerms && nextTerms.length > 0) {
                nextTermDateValue = nextTerms[0].start_date || "";
              }
            }
          }
        }
      } catch (e) {
        console.error('Error determining next term date:', e);
      }

      setNextTermDate(nextTermDateValue || "");

      // 7. Load existing results - filtered by this student's enrolled class
      // Get subject_class_ids for the student's enrolled class
      let enrolledClassSubjectsQuery = supabase
        .from("subject_classes")
        .select("id")
        .eq("class_id", studentData.class_id);

      if (schoolId) {
        enrolledClassSubjectsQuery = enrolledClassSubjectsQuery.eq("school_id", schoolId);
      }

      const { data: enrolledClassSubjects } = await enrolledClassSubjectsQuery;

      const enrolledSubjectClassIds = enrolledClassSubjects?.map((sc: { id: string }) => sc.id) || [];
      ;

      let existingResultsQuery = supabase
        .from("results")
        .select("*")
        .eq("student_id", studentId)
        .eq("session_id", sessionData.id)
        .eq("term_id", termData!.id)
        .in("subject_class_id", enrolledSubjectClassIds);

      if (schoolId) {
        existingResultsQuery = existingResultsQuery.eq("school_id", schoolId);
      }

      const { data: existingResults } = await existingResultsQuery;

      const resultIdBySubjectClass: Record<string, string> = {};
      const existingResultIds: string[] = [];
      if (existingResults && existingResults.length > 0) {
        for (const row of existingResults as any[]) {
          if (row.id) {
            existingResultIds.push(row.id);
            resultIdBySubjectClass[row.subject_class_id] = row.id;
          }
        }
      }

      let componentScoreRows: Array<{ result_id: string; component_key: string; score: number }> = [];
      if (existingResultIds.length > 0) {
        let componentScoresQuery = supabase
          .from("result_component_scores")
          .select("result_id, component_key, score")
          .in("result_id", existingResultIds);

        if (schoolId) {
          componentScoresQuery = componentScoresQuery.eq("school_id", schoolId);
        }

        const { data } = await componentScoresQuery;
        componentScoreRows = (data || []) as Array<{ result_id: string; component_key: string; score: number }>;
      }

      if (existingResults && existingResults.length > 0) {
        const first = existingResults[0];
        setClassTeacherRemark(first.class_teacher_remark || "");
        setPrincipalRemark(first.principal_remark || "");
        // Only set position for THIS student's enrolled class in this term
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
            let merged = {
              ...initialScores[idx],
              welcome_test: res.welcome_test || 0,
              mid_term_test: res.mid_term_test || 0,
              vetting: res.vetting || 0,
              exam: res.exam || 0,
              component_scores: {
                ...initialScores[idx].component_scores,
              },
            };

            // Legacy fallback mapping
            merged.component_scores.welcome_test = res.welcome_test || 0;
            merged.component_scores.mid_term_test = res.mid_term_test || 0;
            merged.component_scores.vetting = res.vetting || 0;
            merged.component_scores.exam = res.exam || 0;

            const resId = resultIdBySubjectClass[res.subject_class_id];
            if (resId) {
              const rows = componentScoreRows.filter((row) => row.result_id === resId);
              for (const row of rows) {
                merged.component_scores[row.component_key] = Number(row.score) || 0;
              }
            }

            initialScores[idx] = merged;

            initialScores[idx] = {
              ...initialScores[idx],
              welcome_test: res.welcome_test || 0,
              mid_term_test: res.mid_term_test || 0,
              vetting: res.vetting || 0,
              exam: res.exam || 0,
            };
            const total = calculateTotalScore(initialScores[idx]);
            const { grade, remark } = calculateGrade(initialScores[idx], total);
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
        let attendanceQuery = supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("student_id", studentId)
          .eq("session_id", sessionData.id)
          .eq("term_id", termData!.id);

        if (schoolId) {
          attendanceQuery = attendanceQuery.eq("school_id", schoolId);
        }

        const { count: countWithFilters } = await attendanceQuery;

        if (countWithFilters !== null && countWithFilters > 0) {
          attendanceCount = countWithFilters;
        } else {
          // Fallback: count all attendance for this student (some schemas might not have session/term)
          let allAttendanceQuery = supabase
            .from("attendance")
            .select("*", { count: "exact", head: true })
            .eq("student_id", studentId);

          if (schoolId) {
            allAttendanceQuery = allAttendanceQuery.eq("school_id", schoolId);
          }

          const { count: countAll } = await allAttendanceQuery;
          attendanceCount = countAll || 0;
        }
      } catch (e) {
        // If query fails, try basic count
        let basicAttendanceQuery = supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("student_id", studentId);

        if (schoolId) {
          basicAttendanceQuery = basicAttendanceQuery.eq("school_id", schoolId);
        }

        const { count } = await basicAttendanceQuery;
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
  function isComponentVisible(component: string): boolean {
    // Admin and teachers can always see all components
    if (role !== 'student' && role !== 'parent') return true;

    // Students and parents can only see published components
    if (!publicationSettings || !isPublished) return false;

    if (Array.isArray(publicationSettings.published_component_keys) && publicationSettings.published_component_keys.length > 0) {
      return publicationSettings.published_component_keys.includes(component);
    }

    return false;
  }

  function calculateTotalScore(score: SubjectScore): number {
    const keys = getVisibleComponentKeys();
    return keys.reduce((sum, key) => sum + getComponentScore(score, key), 0);
  }

  function getVisibleWeightTotal(): number {
    const visible = getVisibleComponentTemplates();
    const total = visible.reduce((sum, component) => sum + Number(component.max_score || 0), 0);
    return total > 0 ? total : 100;
  }

  function getSubjectMaxPossibleScore(): number {
    return getVisibleWeightTotal();
  }

  function calculateGrade(_score: SubjectScore, total: number) {
    const maxScore = getSubjectMaxPossibleScore();
    if (maxScore <= 0) return { grade: "F9", remark: "Fail" };
    const percentage = (total / maxScore) * 100;
    return resolveGradeFromPercentage(percentage, configuredPassPercentage);
  }

  function getComponentLimit(field: string): number {
    const component = resultComponents.find((item) => item.component_key === field);
    return Number(component?.max_score || 100);
  }

  function updateScore(index: number, field: string, value: string) {
    if (isReadOnly || !canEdit) return;
    const newScores = [...scores];
    let num = Math.max(0, Number(value) || 0);
    const componentLimit = getComponentLimit(field);
    if (Number.isFinite(componentLimit)) {
      num = Math.min(num, componentLimit);
    }

    newScores[index] = setComponentScore(newScores[index], field, num);

    const total = calculateTotalScore(newScores[index]);
    const { grade, remark } = calculateGrade(newScores[index], total);
    newScores[index] = {
      ...newScores[index],
      total,
      grade,
      remark,
    };
    setScores(newScores);
  }

  useEffect(() => {
    if (scores.length > 0) {
      const updatedScores = scores.map(score => {
        const total = calculateTotalScore(score);
        const { grade, remark } = calculateGrade(score, total);
        return { ...score, total, grade, remark };
      });
      setScores(updatedScores);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicationSettings, role, resultComponents, gradeScale, configuredPassPercentage]);

  // Calculate visible columns count for table alignment (columns before Total column)
  const visibleColumnsCount = (() => {
    let count = 1; // Subject name column
    for (const component of resultComponents) {
      if (component.is_active && isComponentVisible(component.component_key)) {
        count++;
      }
    }
    return count;
  })();

  const totalScore = scores.reduce((sum, s) => sum + s.total, 0);
  const maxTotalScore = scores.reduce((sum) => sum + getSubjectMaxPossibleScore(), 0);
  const averagePercentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
  const overallGrade = (() => {
    return resolveGradeFromPercentage(averagePercentage, configuredPassPercentage).grade;
  })();

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
      toast.info('Generating PDF...');

      // Dynamically import jsPDF and html2canvas
      const { default: jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const element = printRef.current;

      // Capture the element as canvas with high quality
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10; // 10mm top margin

      // Add first page
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20); // Subtract margins

      // Add additional pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - 20);
      }

      pdf.save(`${student?.first_name}_${student?.last_name}_Report_${session?.name}_${term?.name}.pdf`);
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
      // Get schoolId again just to be sure
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const user = authSession?.user;
      let schoolId: string | null = null;
      if (user) {
        // Try to get school_id from teachers table first
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('school_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (teacherData) {
          schoolId = teacherData.school_id;
        } else {
          // If not a teacher, try admins table
          const { data: adminData } = await supabase
            .from('admins')
            .select('school_id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (adminData) schoolId = adminData.school_id;
        }
      }

      // Save each subject's result separately using Supabase upsert
      const saveDataArray = scores.map(score => ({
        student_id: student.id,
        session_id: session.id,
        term_id: term.id,
        subject_class_id: score.subject_class_id,
        welcome_test: getComponentScore(score, "welcome_test"),
        mid_term_test: getComponentScore(score, "mid_term_test"),
        vetting: getComponentScore(score, "vetting"),
        exam: getComponentScore(score, "exam"),
        total: score.total,
        grade: score.grade,
        remark: score.remark,
        attendance,
        next_term_begins: nextTermDate,
        class_teacher_remark: classTeacherRemark,
        principal_remark: principalRemark,
        class_position: classPosition,
        total_students: totalStudents,
        class_average: classAverage,
        school_id: schoolId,
      }));

      // Upsert all results at once
      const { data: savedRows, error } = await supabase
        .from("results")
        .upsert(saveDataArray, {
          onConflict: "student_id,subject_class_id,session_id,term_id",
        })
        .select("id, subject_class_id");

      if (error) {
        console.error("Error saving results:", error);
        toast.error(error.message || "Failed to save results");
      } else {
        const rows = (savedRows || []) as Array<{ id: string; subject_class_id: string }>;
        if (rows.length > 0) {
          const rowIds = rows.map((row) => row.id);

          let deleteQuery = supabase
            .from("result_component_scores")
            .delete()
            .in("result_id", rowIds);

          if (schoolId || student.school_id) {
            deleteQuery = deleteQuery.eq("school_id", schoolId || student.school_id);
          }

          await deleteQuery;

          const resultIdBySubjectClass: Record<string, string> = {};
          for (const row of rows) {
            resultIdBySubjectClass[row.subject_class_id] = row.id;
          }

          const componentRows = scores.flatMap((score) => {
            const resultId = resultIdBySubjectClass[score.subject_class_id];
            if (!resultId) return [];

            return resultComponents
              .filter((component) => component.is_active)
              .map((component) => ({
                school_id: schoolId || student.school_id,
                result_id: resultId,
                component_key: component.component_key,
                score: getComponentScore(score, component.component_key),
              }));
          });

          if (componentRows.length > 0) {
            const { error: componentSaveError } = await supabase
              .from("result_component_scores")
              .upsert(componentRows, { onConflict: "result_id,component_key" });

            if (componentSaveError) {
              console.error("Error saving component scores:", componentSaveError);
              toast.error(componentSaveError.message || "Results saved, but component scores failed");
              return;
            }
          }
        }

        toast.success("Results saved successfully");
      }
    } catch (err) {
      console.error("Error saving results:", err);
      toast.error("An unexpected error occurred");
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

  if (resultComponents.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Result components are not configured for this school. Please configure them in School Config - Result Settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-between print:hidden">
        {/* No back button here, parent page should handle navigation */}
        <div className="flex gap-2">
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
                    {getVisibleComponentTemplates().map((component) => (
                      <th key={component.component_key} className="border border-gray-300 px-3 py-2 text-center w-24">
                        {component.component_name} ({component.max_score})
                      </th>
                    ))}
                    <th className="border border-gray-300 px-3 py-2 text-center w-20">
                      Total
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
                      {getVisibleComponentTemplates().map((component) => (
                        <td key={component.component_key} className="border border-gray-300 px-3 py-2 text-center font-bold">
                          {canEdit && !isReadOnly ? (
                            <input
                              type="number"
                              min="0"
                              max={getComponentLimit(component.component_key)}
                              value={getComponentScore(score, component.component_key) || ''}
                              onChange={(e) => updateScore(index, component.component_key, e.target.value)}
                              className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded bg-transparent font-bold"
                              disabled={isReadOnly || !canEdit}
                            />
                          ) : (
                            getComponentScore(score, component.component_key)
                          )}
                        </td>
                      ))}
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
            padding: 2 !important;
            margin: 0 auto !important;
            display: block !important;
          }
          input[type="number"] {
            text-align: center !important; 
            font-weight: bold !important;
            position: relative;
            top: -2px;
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
