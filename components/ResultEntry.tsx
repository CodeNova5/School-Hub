"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Student, Class as ClassType, Session, Term } from "@/lib/types";
import { toast } from "sonner";
import ReportCardPreview from "@/components/ReportCardPreview";
import { Save, Printer, Loader2, FileDown } from "lucide-react";

interface SubjectScore {
  subject_class_id: string;
  subject_name: string;
  component_scores: Record<string, number>;
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

interface DomainRatings {
  affective: Record<string, number>;
  psychomotor: Record<string, number>;
}

const DEFAULT_AFFECTIVE_TRAITS = [
  "Punctuality / Regularity",
  "Neatness & Hygiene",
  "Honesty & Trust",
  "Relationship with Peers",
  "Obedience & Compliance",
  "Leadership Dynamics",
];

const DEFAULT_PSYCHOMOTOR_TRAITS = [
  "Verbal Fluency",
  "Sports & Athletics",
  "Crafts & Manual Skills",
  "Musical/Artistic Skills",
  "Handling Lab Tools",
  "Club & Societies",
];

function getDefaultDomainRatings(): DomainRatings {
  const affective: Record<string, number> = {};
  const psychomotor: Record<string, number> = {};
  DEFAULT_AFFECTIVE_TRAITS.forEach((t) => (affective[t] = 5));
  DEFAULT_PSYCHOMOTOR_TRAITS.forEach((t) => (psychomotor[t] = 5));
  return { affective, psychomotor };
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

  // Domain ratings state
  const [domainRatings, setDomainRatings] = useState<DomainRatings>(getDefaultDomainRatings());

  // School details (fetched from database)
  const [school, setSchool] = useState<{ name: string; address: string; phone: string; logo_url: string; motto?: string } | null>(null);

  // Principal/Admin signature URL
  const [principalSignature, setPrincipalSignature] = useState<string | null>(null);

  // Class Teacher signature URL
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);

  // Whether to show position in report card (from school settings)
  const [showPosition, setShowPosition] = useState(true);

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
    return 0;
  }

  function setComponentScore(score: SubjectScore, componentKey: string, value: number): SubjectScore {
    return {
      ...score,
      component_scores: {
        ...score.component_scores,
        [componentKey]: value,
      },
    };
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

  function getActiveComponentTemplates() {
    return resultComponents.filter((component) => component.is_active);
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

  function getGradeColor(grade: string): string {
    if (grade.startsWith("A")) return "#1b7a1b";
    if (grade.startsWith("B")) return "#2e86c1";
    if (grade.startsWith("C")) return "#d4ac0d";
    if (grade.startsWith("D") || grade.startsWith("E")) return "#e67e22";
    if (grade.startsWith("F")) return "#c0392b";
    return "#2c3e50";
  }

  /** Returns true if all active component scores are > 0 for this subject */
  function isSubjectComplete(score: SubjectScore): boolean {
    const activeComponents = getActiveComponentTemplates();
    if (activeComponents.length === 0) return false;
    return activeComponents.every(
      (component) => Number(score.component_scores[component.component_key] || 0) > 0
    );
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

      const { data: studentData } = await studentQuery.maybeSingle();

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
            .select("pass_percentage, is_configured, show_position")
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

        if (settingsData) {
          setShowPosition(settingsData.show_position !== false);
        }

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

      // 1.6 Fetch school details (name, address, phone, logo_url, motto)
      if (schoolId) {
        const { data: schoolData } = await supabase
          .from("schools")
          .select("name, address, phone, logo_url, motto")
          .eq("id", schoolId)
          .single();

        if (schoolData) {
          setSchool(schoolData);
        }
      }

      // 1.7 Fetch principal/admin signature
      // RLS on admins restricts to user_id = auth.uid(), so we query by the current user
      if (user) {
        const { data: adminData } = await supabase
          .from("admins")
          .select("signature_url")
          .eq("user_id", user.id)
          .not("signature_url", "is", null)
          .maybeSingle();

        if (adminData?.signature_url) {
          setPrincipalSignature(adminData.signature_url);
        }
      }

      // 2. Class
      let classQuery = supabase
        .from("classes")
        .select("*")
        .eq("id", studentData.class_id);

      if (schoolId) {
        classQuery = classQuery.eq("school_id", schoolId);
      }

      let sessionQuery = supabase
        .from("sessions")
        .select("*");
      sessionQuery = sessionId ? sessionQuery.eq("id", sessionId) : sessionQuery.eq("is_current", true);
      if (schoolId) sessionQuery = sessionQuery.eq("school_id", schoolId);

      let termQuery = supabase
        .from("terms")
        .select("*");
      termQuery = termId ? termQuery.eq("id", termId) : termQuery.eq("is_current", true);
      if (schoolId) termQuery = termQuery.eq("school_id", schoolId);

      const [{ data: classData }, { data: sessionData }, { data: termData }] = await Promise.all([
        classQuery.maybeSingle(),
        sessionQuery.maybeSingle(),
        termQuery.maybeSingle(),
      ]);

      if (classData) {
        setStudentClass(classData);

        // Fetch class teacher name and signature if we have a class_teacher_id
        if (classData.class_teacher_id) {
          const { data: teacherData } = await supabase
            .from("teachers")
            .select("first_name, last_name, signature_url")
            .eq("id", classData.class_teacher_id)
            .maybeSingle();

          if (teacherData) {
            setTeacherName(`${teacherData.first_name} ${teacherData.last_name}`);
            if (teacherData.signature_url) {
              setTeacherSignature(teacherData.signature_url);
            }
          }
        }
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

        const { data: pubSettings } = await pubQuery.maybeSingle();

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

      let optQuery = supabase
        .from("student_optional_subjects")
        .select("subject_id")
        .eq("student_id", studentId);

      if (schoolId) {
        optQuery = optQuery.eq("school_id", schoolId);
      }

      const [{ data: subjectClasses, error: scError }, { data: optionalSubjectRows }] = await Promise.all([
        scQuery,
        optQuery,
      ]);

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
        total: 0,
        grade: "",
        remark: "",
      }));

      const enrolledSubjectClassIds = filteredSubjectClasses.map((sc: any) => sc.id);

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

      const componentRowsByResultId: Record<string, Array<{ component_key: string; score: number }>> = {};
      for (const row of componentScoreRows) {
        if (!componentRowsByResultId[row.result_id]) {
          componentRowsByResultId[row.result_id] = [];
        }
        componentRowsByResultId[row.result_id].push({
          component_key: row.component_key,
          score: Number(row.score) || 0,
        });
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

        // Load domain ratings from the first result's domain_ratings field
        if (first.domain_ratings) {
          try {
            const parsed = typeof first.domain_ratings === 'string'
              ? JSON.parse(first.domain_ratings)
              : first.domain_ratings;
            if (parsed && parsed.affective && parsed.psychomotor) {
              setDomainRatings(parsed);
            }
          } catch (e) {
            // ignore parse errors
          }
        }

        for (const res of existingResults) {
          const idx = initialScores.findIndex(
            (s) => s.subject_class_id === res.subject_class_id
          );
          if (idx >= 0) {
            const merged = {
              ...initialScores[idx],
              component_scores: {
                ...initialScores[idx].component_scores,
              },
            };

            const resId = resultIdBySubjectClass[res.subject_class_id];
            let hasDynamicRows = false;
            if (resId) {
              const rows = componentRowsByResultId[resId] || [];
              hasDynamicRows = rows.length > 0;
              for (const row of rows) {
                merged.component_scores[row.component_key] = Number(row.score) || 0;
              }
            }

            if (!hasDynamicRows) {
              merged.component_scores.welcome_test = Number(res.welcome_test) || 0;
              merged.component_scores.mid_term_test = Number(res.mid_term_test) || 0;
              merged.component_scores.vetting = Number(res.vetting) || 0;
              merged.component_scores.exam = Number(res.exam) || 0;
            }

            initialScores[idx] = merged;
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

  function updateDomainRating(domain: 'affective' | 'psychomotor', trait: string, value: number) {
    if (isReadOnly || !canEdit) return;
    setDomainRatings((prev) => ({
      ...prev,
      [domain]: {
        ...prev[domain],
        [trait]: Math.max(1, Math.min(5, value)),
      },
    }));
  }

  // Completion summary
  const completionSummary = useMemo(() => {
    const total = scores.length;
    const complete = scores.filter(isSubjectComplete).length;
    const incomplete = total - complete;
    const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, complete, incomplete, percentage };
  }, [scores, resultComponents]);

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

  const totalScore = scores.reduce((sum, s) => sum + s.total, 0);
  const maxTotalScore = scores.reduce((sum) => sum + getSubjectMaxPossibleScore(), 0);
  const averagePercentage = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
  const overallGrade = (() => {
    return resolveGradeFromPercentage(averagePercentage, configuredPassPercentage).grade;
  })();

  const getPositionDisplay = (position: number | null | undefined): string => {
    if (!position) return "--";
    if (position === 1) return "1st";
    if (position === 2) return "2nd";
    if (position === 3) return "3rd";
    return `${position}th`;
  };

  function getPositionOrdinal(position: number | null | undefined, total: number | null | undefined): string {
    if (!position) return "--";
    const pos = getPositionDisplay(position);
    return total ? `${pos} / ${total}` : pos;
  }

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

      const activeComponents = getActiveComponentTemplates();
      const activeMaxScore = activeComponents.reduce((sum, component) => sum + Number(component.max_score || 0), 0) || 100;
      const normalizedScores = scores.map((score) => {
        const total = activeComponents.reduce(
          (sum, component) => sum + getComponentScore(score, component.component_key),
          0
        );
        const percentage = (total / activeMaxScore) * 100;
        const { grade, remark } = resolveGradeFromPercentage(percentage, configuredPassPercentage);

        return {
          ...score,
          total,
          grade,
          remark: score.remark || remark,
        };
      });

      const effectiveSchoolId = schoolId || student.school_id || null;

      // Only save subjects with complete scores — skip incomplete ones
      const completeScores = normalizedScores.filter((score) => {
        const complete = isSubjectComplete(score);
        if (!complete) {
          console.warn(`Skipping incomplete subject: ${score.subject_name}`);
        }
        return complete;
      });

      const skippedCount = normalizedScores.length - completeScores.length;

      // Even if no subjects are complete, still save remarks/domains using the first subject's ID
      // (remarks and domain_ratings are stored per-row but apply to all subjects)
      if (completeScores.length === 0) {
        // Save just remarks/domains against the existing results if any
        let remarkUpdateQuery = supabase
          .from("results")
          .update({
            class_teacher_remark: classTeacherRemark,
            principal_remark: principalRemark,
            domain_ratings: domainRatings,
            next_term_begins: nextTermDate,
          })
          .eq("student_id", student.id)
          .eq("session_id", session.id)
          .eq("term_id", term.id);

        if (effectiveSchoolId) {
          remarkUpdateQuery = remarkUpdateQuery.eq("school_id", effectiveSchoolId);
        }

        const { error: remarkOnlyError } = await remarkUpdateQuery;

        if (remarkOnlyError) {
          console.error("Error saving remarks/domains:", remarkOnlyError);
          toast.error(remarkOnlyError.message || "Failed to save remarks");
        } else {
          toast.success("Remarks and domain ratings saved (no complete subjects to score)");
        }
        setIsSaving(false);
        return;
      }

      // Save each subject's result separately using Supabase upsert
      const saveDataArray = completeScores.map(score => ({
        student_id: student.id,
        session_id: session.id,
        term_id: term.id,
        subject_class_id: score.subject_class_id,
        welcome_test: Number(score.component_scores.welcome_test) || 0,
        mid_term_test: Number(score.component_scores.mid_term_test) || 0,
        vetting: Number(score.component_scores.vetting) || 0,
        exam: Number(score.component_scores.exam) || 0,
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
        school_id: effectiveSchoolId,
        domain_ratings: domainRatings,
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
          const activeComponentKeys = activeComponents.map((component) => component.component_key);

          let staleRowsQuery = supabase
            .from("result_component_scores")
            .delete()
            .in("result_id", rowIds);

          if (effectiveSchoolId) {
            staleRowsQuery = staleRowsQuery.eq("school_id", effectiveSchoolId);
          }

          if (activeComponentKeys.length > 0) {
            const activeKeysFilter = `(${activeComponentKeys.map((key) => `"${key}"`).join(",")})`;
            staleRowsQuery = staleRowsQuery.not("component_key", "in", activeKeysFilter);
          }

          const { error: staleDeleteError } = await staleRowsQuery;
          if (staleDeleteError) {
            console.error("Error deleting stale component scores:", staleDeleteError);
            toast.error(staleDeleteError.message || "Failed to clean up stale component scores");
            return;
          }

          const resultIdBySubjectClass: Record<string, string> = {};
          for (const row of rows) {
            resultIdBySubjectClass[row.subject_class_id] = row.id;
          }

          const componentRows = completeScores.flatMap((score) => {
            const resultId = resultIdBySubjectClass[score.subject_class_id];
            if (!resultId) return [];

            return activeComponents
              .map((component) => ({
                school_id: effectiveSchoolId,
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

        setScores(normalizedScores);

        // ── Save the student's term summary (source of truth for averages) ──
        const totalSubjects = normalizedScores.length;
        const totalScoreSum = completeScores.reduce((sum, s) => sum + s.total, 0);
        const averageScore = totalSubjects > 0 ? totalScoreSum / totalSubjects : 0;
        const completionPct = totalSubjects > 0
          ? Math.round((completeScores.length / totalSubjects) * 100)
          : 0;

        const { error: summaryError } = await supabase
          .from("student_term_summaries")
          .upsert({
            school_id: effectiveSchoolId,
            student_id: student.id,
            class_id: student.class_id,
            session_id: session.id,
            term_id: term.id,
            total_subjects: totalSubjects,
            subjects_with_results: completeScores.length,
            subjects_complete: completeScores.length,
            total_score: totalScoreSum,
            average_score: averageScore,
            completion_percentage: completionPct,
            is_complete: completionPct === 100,
          }, {
            onConflict: "student_id,session_id,term_id",
          });

        if (summaryError) {
          console.error("Error saving student term summary:", summaryError);
          // Results saved OK, summary is best-effort
        }

        const successMsg = skippedCount > 0
          ? `Results saved — ${skippedCount} subject(s) skipped (incomplete scores)`
          : "Results saved successfully";
        toast.success(successMsg);
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

  /* ── Completion summary bar (shown in edit mode) ── */
  const showCompletionBar = !isReadOnly && canEdit;
  const remarkFilled = classTeacherRemark.trim().length > 0 || principalRemark.trim().length > 0;
  const hasDomainChanges = Object.values(domainRatings.affective).some(v => v !== 5)
    || Object.values(domainRatings.psychomotor).some(v => v !== 5);
  const allComplete = completionSummary.percentage === 100 && remarkFilled && hasDomainChanges;

  return (
    <div className="space-y-4 mb-12 print:space-y-0 print:mb-0">
      {/* ── COMPLETION SUMMARY BAR (top, edit mode only) ── */}
      {showCompletionBar && (
        <div
          className="print:hidden flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors"
          style={{
            background: allComplete ? "#eafaf1" : "#fef9e7",
            borderColor: allComplete ? "#27ae60" : "#e67e22",
          }}
        >
          {/* Scores progress */}
          <span className="font-semibold text-gray-700 whitespace-nowrap">
            📊 Scores:
          </span>
          <div className="flex-1 min-w-[100px] max-w-[160px] h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${completionSummary.percentage}%`,
                background: completionSummary.percentage === 100
                  ? "#27ae60"
                  : completionSummary.percentage >= 50
                    ? "#f39c12"
                    : "#e74c3c",
              }}
            />
          </div>
          <span className="font-bold text-xs" style={{ color: completionSummary.percentage === 100 ? "#27ae60" : "#e67e22" }}>
            {completionSummary.percentage}%
          </span>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {completionSummary.complete}/{completionSummary.total}
          </span>
          {completionSummary.incomplete > 0 && (
            <span className="text-xs text-amber-600 italic whitespace-nowrap">
              {completionSummary.incomplete} need{completionSummary.incomplete === 1 ? "s" : ""} scores
            </span>
          )}

          <span className="w-px h-5 bg-gray-300 mx-1" />

          {/* Remarks status */}
          <span className="font-semibold text-gray-700 whitespace-nowrap">📝 Remarks:</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              color: remarkFilled ? "#fff" : "#7f8c8d",
              background: remarkFilled ? "#27ae60" : "#e0e0e0",
            }}
          >
            {remarkFilled ? "Filled" : "Empty"}
          </span>

          {/* Domains status */}
          <span className="font-semibold text-gray-700 whitespace-nowrap">🎯 Domains:</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              color: hasDomainChanges ? "#fff" : "#7f8c8d",
              background: hasDomainChanges ? "#27ae60" : "#e0e0e0",
            }}
          >
            {hasDomainChanges ? "Customized" : "Defaults"}
          </span>

          {allComplete && (
            <span className="text-green-700 font-bold text-xs ml-auto">✓ Ready</span>
          )}
        </div>
      )}

      {/* ── ACTION BUTTONS (always visible) ── */}
      <div className="print:hidden flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg border shadow-sm">
        <Button variant="outline" onClick={handlePrint} size="sm">
          <Printer className="h-4 w-4 mr-1.5" />
          Print
        </Button>
        <Button variant="outline" onClick={handleExportPDF} size="sm">
          <FileDown className="h-4 w-4 mr-1.5" />
          Export PDF
        </Button>
        {canEdit && !isReadOnly && (
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="ml-auto">
            {isSaving ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-1.5" /> Save</>
            )}
          </Button>
        )}
      </div>

      {/* ── MAIN CONTENT: Two columns on desktop ── */}
      <div className="flex flex-col lg:flex-row gap-6 print:block">
        
        {/* ── LEFT: CONFIGURATION PANEL (edit mode only) ── */}
        {canEdit && !isReadOnly && (
          <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 space-y-4 print:hidden">

            {/* Subject Scores Input Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>📊</span> Subject Scores
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {completionSummary.complete}/{completionSummary.total} done
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2.5 font-medium text-xs">Subject</th>
                      {getActiveComponentTemplates().map(c => (
                        <th key={c.component_key} className="text-center p-2.5 font-medium text-xs w-16">
                          {c.component_name}
                        </th>
                      ))}
                      <th className="text-center p-2.5 font-medium text-xs w-14">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((score, index) => {
                      const complete = isSubjectComplete(score);
                      return (
                        <tr
                          key={score.subject_class_id}
                          className={`border-t transition-colors ${
                            complete ? "bg-green-50/60" : "bg-amber-50/60"
                          }`}
                        >
                          <td className="p-2 font-medium text-sm">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate">{score.subject_name}</span>
                              <span
                                className={`inline-flex items-center justify-center text-[10px] font-bold w-4 h-4 rounded-full flex-shrink-0 ${
                                  complete
                                    ? "bg-green-200 text-green-800"
                                    : "bg-amber-200 text-amber-800"
                                }`}
                                title={complete ? "Complete" : "Pending"}
                              >
                                {complete ? "✓" : "!"}
                              </span>
                            </div>
                          </td>
                          {getActiveComponentTemplates().map((component) => (
                            <td key={component.component_key} className="p-1 text-center">
                              <input
                                type="number"
                                min="0"
                                max={getComponentLimit(component.component_key)}
                                value={getComponentScore(score, component.component_key) || ""}
                                onChange={(e) => updateScore(index, component.component_key, e.target.value)}
                                className="w-12 text-center border border-gray-200 rounded-md px-1 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-shadow"
                              />
                            </td>
                          ))}
                          <td className="p-2 text-center font-bold text-sm" style={{ color: getGradeColor(score.grade) }}>
                            {score.grade}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Domain Ratings Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>🎯</span> Domain Ratings
                  <span className="ml-auto text-xs font-normal text-muted-foreground">Rate 1–5</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Affective */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Affective</h4>
                    <div className="space-y-1.5">
                      {DEFAULT_AFFECTIVE_TRAITS.map((trait) => (
                        <div key={trait} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-700 truncate">{trait}</span>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={domainRatings.affective[trait] || 5}
                            onChange={(e) =>
                              updateDomainRating("affective", trait, parseInt(e.target.value) || 5)
                            }
                            className="w-12 text-center border border-gray-200 rounded-md px-1 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Psychomotor */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Psychomotor</h4>
                    <div className="space-y-1.5">
                      {DEFAULT_PSYCHOMOTOR_TRAITS.map((trait) => (
                        <div key={trait} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-700 truncate">{trait}</span>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={domainRatings.psychomotor[trait] || 5}
                            onChange={(e) =>
                              updateDomainRating("psychomotor", trait, parseInt(e.target.value) || 5)
                            }
                            className="w-12 text-center border border-gray-200 rounded-md px-1 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Remarks Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span>📝</span> Remarks
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Form Teacher's Remark
                  </label>
                  <Textarea
                    value={classTeacherRemark}
                    onChange={(e) => setClassTeacherRemark(e.target.value)}
                    placeholder="Enter class teacher's remark..."
                    className="min-h-[60px] resize-none text-sm"
                  />
                </div>
                {canEditPrincipalComment && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Principal's Remark
                    </label>
                    <Textarea
                      value={principalRemark}
                      onChange={(e) => setPrincipalRemark(e.target.value)}
                      placeholder="Enter principal's remark..."
                      className="min-h-[60px] resize-none text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* ── RIGHT: PREVIEW ── */}
        <div className="flex-1 min-w-0 overflow-x-auto print:overflow-visible">
          <ReportCardPreview
            ref={printRef}
            school={school}
            student={student}
            studentClass={studentClass}
            session={session}
            term={term}
            scores={scores}
            totalScore={totalScore}
            maxTotalScore={maxTotalScore}
            averagePercentage={averagePercentage}
            overallGrade={overallGrade}
            attendance={attendance}
            nextTermDate={nextTermDate}
            classPosition={classPosition}
            totalStudents={totalStudents}
            classAverage={classAverage}
            teacherName={teacherName}
            teacherSignature={teacherSignature}
            principalSignature={principalSignature}
            classTeacherRemark={classTeacherRemark}
            principalRemark={principalRemark}
            domainRatings={domainRatings}
            gradeScale={gradeScale}
            configuredPassPercentage={configuredPassPercentage}
            visibleComponentTemplates={getVisibleComponentTemplates()}
            showPosition={showPosition}
            getGradeColor={getGradeColor}
            getPositionDisplay={getPositionDisplay}
            getPositionOrdinal={getPositionOrdinal}
          />
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          body {
            background-color: #ffffff !important;
            padding: 0 !important;
          }
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
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print\\\\:hidden {
            display: none !important;
          }
          th {
            background-color: #0b5345 !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
