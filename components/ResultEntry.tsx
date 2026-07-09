"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Student, Class as ClassType, Session, Term } from "@/lib/types";
import { toast } from "sonner";
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
        classQuery.single(),
        sessionQuery.single(),
        termQuery.single(),
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

  // Calculate visible columns count for table alignment (columns before Grade column)
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

  return (
    <div className="space-y-6 mb-12">
      {/* Action Buttons */}
      <div className="flex items-center justify-between print:hidden">
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

      {/* Report Card */}
      <div
        ref={printRef}
        id="printable-content"
        style={{
          maxWidth: "820px",
          margin: "0 auto",
          background: "#ffffff",
          padding: "30px",
          border: "2px solid #0b5345",
          boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: "#2c3e50",
          fontSize: "13px",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "4px double #0b5345",
            paddingBottom: "10px",
            marginBottom: "15px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: "85px",
              height: "85px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {school?.logo_url ? (
              <img
                src={school.logo_url}
                alt="School Logo"
                style={{ height: "100%", width: "100%", objectFit: "contain" }}
              />
            ) : (
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: "75px", height: "75px" }}>
                <circle cx="50" cy="50" r="45" fill="#0b5345" />
                <polygon points="50,18 78,40 68,75 32,75 22,40" fill="#d4ac0d" />
                <path d="M35,45 Q50,35 65,45 L65,58 Q50,48 35,58 Z" fill="#ffffff" />
                <rect x="47" y="42" width="6" height="25" fill="#0b5345" />
                <circle cx="50" cy="33" r="4" fill="#ffffff" />
              </svg>
            )}
          </div>

          {/* School Details */}
          <div style={{ textAlign: "center", flexGrow: 1, padding: "0 15px" }}>
            <h1 style={{ color: "#0b5345", margin: "0 0 3px 0", fontSize: "22px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {school?.name || "SCHOOL NAME"}
            </h1>
            <p style={{ margin: "2px 0", fontSize: "13px" }}>
              {school?.address || "School Address, City, State"}
            </p>
            <p style={{ margin: "2px 0", fontSize: "13px" }}>
              {school?.phone ? `Tel: ${school.phone}` : ""}
            </p>
            {school?.motto && (
              <p style={{ fontWeight: "bold", marginTop: "5px", color: "#0b5345", fontSize: "12px" }}>
                MOTTO: {school.motto}
              </p>
            )}
          </div>

          {/* Passport Photo */}
          <div
            style={{
              width: "85px",
              height: "85px",
              border: "1px solid #a6acaf",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              flexShrink: 0,
              background: "#f8f9fa",
            }}
          >
            {student?.photo_url || student?.image_url ? (
              <img
                src={student.photo_url || student.image_url}
                alt="Student Passport"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "10px", color: "#7f8c8d" }}>Passport</span>
            )}
          </div>
        </div>

        {/* ── TITLE BAR ── */}
        <div
          style={{
            textAlign: "center",
            background: "#0b5345",
            color: "white",
            padding: "6px",
            fontWeight: "bold",
            fontSize: "14px",
            letterSpacing: "1px",
            marginBottom: "15px",
            borderRadius: "4px",
          }}
        >
          TERMINAL STUDENT PROGRESS REPORT
        </div>

        {/* ── PROFILE TABLE ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "15px" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 8px", fontSize: "13px", width: "50%" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Student Name:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {student.first_name} {student.last_name}
                </span>
              </td>
              <td style={{ padding: "4px 8px", fontSize: "13px", width: "50%" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Student ID:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {student.student_id}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontSize: "13px" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Class:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {studentClass?.name}
                </span>
              </td>
              <td style={{ padding: "4px 8px", fontSize: "13px" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Term / Year:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {term?.name} / {session?.name}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontSize: "13px" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Gender:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—"}
                </span>
              </td>
              <td style={{ padding: "4px 8px", fontSize: "13px" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>No. in Class:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {totalStudents || "—"}
                </span>
              </td>
            </tr>
            <tr>
              <td style={{ padding: "4px 8px", fontSize: "13px" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Attendance:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {attendance} Day{attendance !== 1 ? "s" : ""}
                </span>
              </td>
              <td style={{ padding: "4px 8px", fontSize: "13px" }}>
                <span style={{ fontWeight: "bold", color: "#566573" }}>Next Term Begins:</span>{" "}
                <span style={{ borderBottom: "1px dashed #a6acaf", display: "inline-block", width: "70%", fontWeight: 600, paddingLeft: "5px" }}>
                  {nextTermDate && !isNaN(new Date(nextTermDate).getTime())
                    ? new Date(nextTermDate).toLocaleDateString("en-GB")
                    : "—"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── COMPLETION SUMMARY BAR ── */}
        {!isReadOnly && canEdit && (() => {
          const remarkFilled = classTeacherRemark.trim().length > 0 || principalRemark.trim().length > 0;
          const hasDomainChanges = Object.values(domainRatings.affective).some(v => v !== 5)
            || Object.values(domainRatings.psychomotor).some(v => v !== 5);
          const allComplete = completionSummary.percentage === 100;
          return (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "8px 12px",
              marginBottom: "10px",
              borderRadius: "6px",
              border: `1px solid ${allComplete ? "#27ae60" : "#e67e22"}`,
              background: allComplete ? "#eafaf1" : "#fef9e7",
              fontSize: "12px",
            }}
          >
            {/* Row 1: Subject Scores */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontWeight: "bold", color: "#2c3e50", minWidth: "120px" }}>
                📊 Scores:
              </span>
              <div style={{ flex: 1, maxWidth: "160px", height: "8px", background: "#e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${completionSummary.percentage}%`, background: allComplete ? "#27ae60" : completionSummary.percentage >= 50 ? "#f39c12" : "#e74c3c", borderRadius: "4px", transition: "width 0.3s ease" }} />
              </div>
              <span style={{ fontWeight: "bold", fontSize: "11px", color: allComplete ? "#27ae60" : "#e67e22", minWidth: "40px" }}>
                {completionSummary.percentage}%
              </span>
              <span style={{ fontSize: "11px", color: "#7f8c8d" }}>
                {completionSummary.complete}/{completionSummary.total}
              </span>
              {completionSummary.incomplete > 0 && (
                <span style={{ color: "#e67e22", fontSize: "11px", fontStyle: "italic" }}>
                  {completionSummary.incomplete} need{completionSummary.incomplete === 1 ? "s" : ""} scores
                </span>
              )}
            </div>
            {/* Row 2: Remarks & Domains */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontWeight: "bold", color: "#2c3e50", minWidth: "120px" }}>
                📝 Remarks:
              </span>
              <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "8px", fontWeight: "bold", color: remarkFilled ? "#fff" : "#7f8c8d", background: remarkFilled ? "#27ae60" : "#e0e0e0" }}>
                {remarkFilled ? "Filled" : "Empty"}
              </span>
              <span style={{ fontWeight: "bold", color: "#2c3e50", minWidth: "120px", marginLeft: "10px" }}>
                🎯 Domains:
              </span>
              <span style={{ fontSize: "11px", padding: "1px 6px", borderRadius: "8px", fontWeight: "bold", color: hasDomainChanges ? "#fff" : "#7f8c8d", background: hasDomainChanges ? "#27ae60" : "#e0e0e0" }}>
                {hasDomainChanges ? "Customized" : "Defaults"}
              </span>
              {allComplete && remarkFilled && hasDomainChanges && (
                <span style={{ color: "#27ae60", fontWeight: "bold", fontSize: "11px", marginLeft: "auto" }}>
                  ✓ Ready
                </span>
              )}
            </div>
          </div>
          );
        })()}

        {/* ── DATA TABLE ── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginBottom: "15px",
            fontSize: "12px",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "24%" }} />
            {getVisibleComponentTemplates().map(() => (
              <col key={Math.random()} style={{ width: "9%" }} />
            ))}
            <col style={{ width: "9%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "auto" }} />
          </colgroup>
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Subjects
              </th>
              <th
                colSpan={getVisibleComponentTemplates().length}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Scores
              </th>
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Total
              </th>
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Class<br />Avg
              </th>
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Pos
              </th>
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Grade
              </th>
              <th
                rowSpan={2}
                style={{
                  border: "1px solid #a6acaf",
                  padding: "6px 4px",
                  textAlign: "center",
                  background: "#0b5345",
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Remarks
              </th>
            </tr>
            <tr>
              {getVisibleComponentTemplates().map((component) => (
                <th
                  key={component.component_key}
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    background: "#0b5345",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  {component.component_name}<br />({component.max_score})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scores.map((score, index) => {
              const complete = isSubjectComplete(score);
              const rowBg = !isReadOnly && canEdit
                ? complete
                  ? "#eafaf1"
                  : index % 2 === 0
                    ? "#fef9e7"
                    : "#fdf2e9"
                : index % 2 === 0
                  ? "#f9f9f9"
                  : "#ffffff";
              return (
              <tr key={score.subject_class_id} style={{ background: rowBg }}>
                <td
                  className="subject-name"
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "left",
                    paddingLeft: "8px",
                    fontWeight: 600,
                    fontSize: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {score.subject_name}
                    {!isReadOnly && canEdit && (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "9px",
                          fontWeight: "bold",
                          padding: "1px 6px",
                          borderRadius: "8px",
                          color: complete ? "#fff" : "#7f8c8d",
                          background: complete ? "#27ae60" : "#e0e0e0",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {complete ? "Complete" : "Pending"}
                      </span>
                    )}
                  </div>
                </td>
                {getVisibleComponentTemplates().map((component) => (
                  <td
                    key={component.component_key}
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "6px 4px",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    {canEdit && !isReadOnly ? (
                      <input
                        type="number"
                        min="0"
                        max={getComponentLimit(component.component_key)}
                        value={getComponentScore(score, component.component_key) || ""}
                        onChange={(e) => updateScore(index, component.component_key, e.target.value)}
                        style={{
                          width: "100%",
                          textAlign: "center",
                          border: "none",
                          background: "transparent",
                          fontWeight: 600,
                          fontSize: "12px",
                          padding: 0,
                          margin: 0,
                          outline: "none",
                        }}
                        disabled={isReadOnly || !canEdit}
                      />
                    ) : (
                      getComponentScore(score, component.component_key)
                    )}
                  </td>
                ))}
                <td
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "#0b5345",
                  }}
                >
                  {score.total}
                </td>
                <td
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontSize: "11px",
                    color: "#566573",
                  }}
                >
                  {classAverage?.toFixed(1) || "—"}
                </td>
                <td
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {getPositionDisplay(classPosition)}
                </td>
                <td
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: getGradeColor(score.grade),
                  }}
                >
                  {score.grade}
                </td>
                <td
                  style={{
                    border: "1px solid #a6acaf",
                    padding: "6px 4px",
                    textAlign: "center",
                    fontSize: "11px",
                    fontStyle: "italic",
                    color: "#566573",
                  }}
                >
                  {score.remark}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── DOMAINS (Affective + Psychomotor) ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "15px",
            marginBottom: "15px",
          }}
        >
          {/* Affective Domain */}
          <div style={{ flex: 1, width: "50%" }}>
            <h3
              style={{
                color: "#0b5345",
                fontSize: "13px",
                borderBottom: "2px solid #0b5345",
                marginTop: 0,
                paddingBottom: "3px",
                marginBottom: "8px",
              }}
            >
              AFFECTIVE DOMAIN
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "75%" }} />
                <col style={{ width: "25%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "6px 4px",
                      textAlign: "left",
                      paddingLeft: "8px",
                      background: "#0b5345",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    Trait Evaluation
                  </th>
                  <th
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "6px 4px",
                      textAlign: "center",
                      background: "#0b5345",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_AFFECTIVE_TRAITS.map((trait) => (
                  <tr key={trait}>
                    <td
                      style={{
                        border: "1px solid #a6acaf",
                        padding: "5px 4px",
                        textAlign: "left",
                        paddingLeft: "8px",
                        fontSize: "12px",
                      }}
                    >
                      {trait}
                    </td>
                    <td
                      style={{
                        border: "1px solid #a6acaf",
                        padding: "5px 4px",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {canEdit && !isReadOnly ? (
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={domainRatings.affective[trait] || 5}
                          onChange={(e) =>
                            updateDomainRating("affective", trait, parseInt(e.target.value) || 5)
                          }
                          style={{
                            width: "40px",
                            textAlign: "center",
                            border: "1px solid #d1d5db",
                            borderRadius: "3px",
                            padding: "2px",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                          disabled={isReadOnly || !canEdit}
                        />
                      ) : (
                        domainRatings.affective[trait] || 5
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Psychomotor Domain */}
          <div style={{ flex: 1, width: "50%" }}>
            <h3
              style={{
                color: "#0b5345",
                fontSize: "13px",
                borderBottom: "2px solid #0b5345",
                marginTop: 0,
                paddingBottom: "3px",
                marginBottom: "8px",
              }}
            >
              PSYCHOMOTOR DOMAIN
            </h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "75%" }} />
                <col style={{ width: "25%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "6px 4px",
                      textAlign: "left",
                      paddingLeft: "8px",
                      background: "#0b5345",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    Skill Evaluation
                  </th>
                  <th
                    style={{
                      border: "1px solid #a6acaf",
                      padding: "6px 4px",
                      textAlign: "center",
                      background: "#0b5345",
                      color: "white",
                      fontWeight: 600,
                    }}
                  >
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PSYCHOMOTOR_TRAITS.map((trait) => (
                  <tr key={trait}>
                    <td
                      style={{
                        border: "1px solid #a6acaf",
                        padding: "5px 4px",
                        textAlign: "left",
                        paddingLeft: "8px",
                        fontSize: "12px",
                      }}
                    >
                      {trait}
                    </td>
                    <td
                      style={{
                        border: "1px solid #a6acaf",
                        padding: "5px 4px",
                        textAlign: "center",
                        fontWeight: 600,
                      }}
                    >
                      {canEdit && !isReadOnly ? (
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={domainRatings.psychomotor[trait] || 5}
                          onChange={(e) =>
                            updateDomainRating("psychomotor", trait, parseInt(e.target.value) || 5)
                          }
                          style={{
                            width: "40px",
                            textAlign: "center",
                            border: "1px solid #d1d5db",
                            borderRadius: "3px",
                            padding: "2px",
                            fontSize: "12px",
                            fontWeight: 600,
                          }}
                          disabled={isReadOnly || !canEdit}
                        />
                      ) : (
                        domainRatings.psychomotor[trait] || 5
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SUMMARY BAR ── */}
        <div
          style={{
            border: "1px solid #0b5345",
            borderRadius: "4px",
            padding: "8px",
            marginBottom: "15px",
            background: "#fcfcfc",
          }}
        >
          <table style={{ width: "100%", textAlign: "center", borderCollapse: "collapse", fontSize: "13px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "2px", width: "25%" }}>
                  <strong style={{ color: "#0b5345" }}>TOTAL:</strong>{" "}
                  <strong>{totalScore} / {maxTotalScore}</strong>
                </td>
                <td
                  style={{
                    padding: "2px",
                    borderLeft: "1px solid #a6acaf",
                    width: "25%",
                  }}
                >
                  <strong style={{ color: "#0b5345" }}>PERCENT:</strong>{" "}
                  <strong>{averagePercentage.toFixed(2)}%</strong>
                </td>
                <td
                  style={{
                    padding: "2px",
                    borderLeft: "1px solid #a6acaf",
                    width: "25%",
                  }}
                >
                  <strong style={{ color: "#0b5345" }}>CLASS AVG:</strong>{" "}
                  <strong>{classAverage?.toFixed(2) || "—"}%</strong>
                </td>
                <td
                  style={{
                    padding: "2px",
                    borderLeft: "1px solid #a6acaf",
                    width: "25%",
                  }}
                >
                  <strong style={{ color: "#0b5345" }}>POSITION:</strong>{" "}
                  <strong>{getPositionOrdinal(classPosition, totalStudents)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── FOOTER SECTION ── */}
        <div style={{ marginTop: "15px", fontSize: "13px", pageBreakInside: "avoid" }}>
          {/* Class Teacher Remark */}
          <div style={{ marginBottom: "10px", display: "flex", alignItems: "baseline" }}>
            <span style={{ fontWeight: "bold", width: "150px", flexShrink: 0 }}>
              Form Teacher's Remark:
            </span>
            <span
              style={{
                flexGrow: 1,
                borderBottom: "1px dashed #a6acaf",
                fontStyle: "italic",
                paddingLeft: "5px",
              }}
            >
              {canEdit && !isReadOnly ? (
                <input
                  type="text"
                  value={classTeacherRemark}
                  onChange={(e) => setClassTeacherRemark(e.target.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    fontStyle: "italic",
                    fontSize: "13px",
                    padding: "2px 0",
                    outline: "none",
                  }}
                  placeholder="Enter remark..."
                  disabled={isReadOnly || !canEdit}
                />
              ) : (
                classTeacherRemark || "\u00A0"
              )}
            </span>
          </div>

          {/* Principal Remark */}
          <div style={{ marginBottom: "10px", display: "flex", alignItems: "baseline" }}>
            <span style={{ fontWeight: "bold", width: "150px", flexShrink: 0 }}>
              Principal's Remark:
            </span>
            <span
              style={{
                flexGrow: 1,
                borderBottom: "1px dashed #a6acaf",
                fontStyle: "italic",
                paddingLeft: "5px",
              }}
            >
              {canEditPrincipalComment && !isReadOnly ? (
                <input
                  type="text"
                  value={principalRemark}
                  onChange={(e) => setPrincipalRemark(e.target.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    fontStyle: "italic",
                    fontSize: "13px",
                    padding: "2px 0",
                    outline: "none",
                  }}
                  placeholder="Enter remark..."
                  disabled={isReadOnly || !canEditPrincipalComment}
                />
              ) : (
                principalRemark || "\u00A0"
              )}
            </span>
          </div>

          {/* Vacation / Resumption Dates */}
          <div
            style={{
              marginBottom: "10px",
              display: "flex",
              alignItems: "baseline",
              marginTop: "15px",
            }}
          >
            <span style={{ fontWeight: "bold", width: "150px", flexShrink: 0, color: "#c0392b" }}>
              Vacation Date:
            </span>
            <span
              style={{
                flexGrow: 1,
                borderBottom: "1px dashed #a6acaf",
                fontWeight: "bold",
                paddingLeft: "5px",
              }}
            >
              {session?.end_date
                ? new Date(session.end_date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </span>
            <span
              style={{
                fontWeight: "bold",
                width: "140px",
                textAlign: "right",
                paddingRight: "10px",
                flexShrink: 0,
                color: "#27ae60",
              }}
            >
              Resumption Date:
            </span>
            <span
              style={{
                flexGrow: 1,
                borderBottom: "1px dashed #a6acaf",
                fontWeight: "bold",
                paddingLeft: "5px",
              }}
            >
              {nextTermDate && !isNaN(new Date(nextTermDate).getTime())
                ? new Date(nextTermDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>

          {/* Signatures / Stamps */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: "25px",
              padding: "0 10px",
            }}
          >
            {/* Teacher Signature */}
            <div style={{ textAlign: "center", width: "180px" }}>
              <div
                style={{
                  height: "25px",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "14px",
                  fontStyle: "italic",
                  color: "#1a5276",
                }}
              >
                {teacherSignature ? (
                  <img
                    src={teacherSignature}
                    alt="Teacher's Signature"
                    style={{ height: "30px", objectFit: "contain", display: "inline-block" }}
                  />
                ) : (
                  teacherName || "\u00A0"
                )}
              </div>
              <div
                style={{
                  borderTop: "1px dashed #2c3e50",
                  marginTop: "35px",
                  paddingTop: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                {teacherName ? `${teacherName}` : "Form Teacher's Signature"}
              </div>
            </div>

            {/* Official Stamp */}
            <div style={{ position: "relative", height: "65px", width: "100px" }}>
              <svg
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  position: "absolute",
                  top: "-15px",
                  left: "12px",
                  width: "75px",
                  height: "75px",
                  opacity: 0.75,
                }}
              >
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1f618d" strokeWidth="1.5" strokeDasharray="3,2" />
                <circle cx="50" cy="50" r="38" fill="none" stroke="#1f618d" strokeWidth="0.75" />
                <text x="50" y="32" fontSize="6" fontWeight="bold" fill="#1f618d" textAnchor="middle">
                  {school?.name ? school.name.substring(0, 18).toUpperCase() : "SCHOOL"}
                </text>
                <rect x="22" y="44" width="56" height="12" fill="none" stroke="#1f618d" strokeWidth="0.75" />
                <text x="50" y="52" fontSize="5" fontWeight="bold" fill="#c0392b" textAnchor="middle">
                  APPROVED STAMP
                </text>
                <text x="50" y="74" fontSize="6" fontWeight="bold" fill="#1f618d" textAnchor="middle">
                  NIGERIA
                </text>
              </svg>
            </div>

            {/* Principal Signature */}
            <div style={{ textAlign: "center", width: "180px" }}>
              <div
                style={{
                  height: "25px",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "14px",
                  fontStyle: "italic",
                  color: "#1a5276",
                }}
              >
                {principalSignature ? (
                  <img
                    src={principalSignature}
                    alt="Principal's Signature"
                    style={{ height: "30px", objectFit: "contain", display: "inline-block" }}
                  />
                ) : (
                  "\u00A0"
                )}
              </div>
              <div
                style={{
                  borderTop: "1px dashed #2c3e50",
                  marginTop: "35px",
                  paddingTop: "5px",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                Principal's Signature & Date
              </div>
              <div style={{ fontSize: "11px", color: "#566573", marginTop: "2px" }}>
                {new Date().toLocaleDateString("en-GB")}
              </div>
            </div>
          </div>
        </div>

        {/* ── GRADING LEGEND ── */}
        <div
          style={{
            border: "1px solid #a6acaf",
            padding: "8px",
            borderRadius: "4px",
            background: "#fafafa",
            marginTop: "15px",
            display: "flex",
            justifyContent: "space-around",
            fontSize: "10px",
            pageBreakInside: "avoid",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: "bold",
                color: "#0b5345",
                marginBottom: "2px",
                fontSize: "11px",
              }}
            >
              COGNITIVE GRADING KEY (WAEC Standard)
            </div>
            <span>75 - 100 = A1 (Excellent)</span> &nbsp;&nbsp;
            <span>70 - 74 = B2 (Very Good)</span> &nbsp;&nbsp;
            <span>65 - 69 = B3 (Good)</span><br />
            <span>60 - 64 = C4 (Credit)</span> &nbsp;&nbsp;
            <span>55 - 59 = C5 (Credit)</span> &nbsp;&nbsp;
            <span>50 - 54 = C6 (Credit)</span><br />
            <span>45 - 49 = D7 (Pass)</span> &nbsp;&nbsp;
            <span>40 - 44 = E8 (Pass)</span> &nbsp;&nbsp;
            <span>0 - 39 = F9 (Fail)</span>
          </div>
          <div style={{ borderLeft: "1px solid #a6acaf", paddingLeft: "15px" }}>
            <div
              style={{
                fontWeight: "bold",
                color: "#0b5345",
                marginBottom: "2px",
                fontSize: "11px",
              }}
            >
              BEHAVIORAL RATING
            </div>
            <span>5 = Excellent</span><br />
            <span>4 = Commendable</span><br />
            <span>3 = Average</span><br />
            <span>2 = Needs Improvement</span><br />
            <span>1 = Unsatisfactory</span>
          </div>
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
          input[type="number"],
          input[type="text"] {
            border: none !important;
            background: transparent !important;
            text-align: center !important;
            -webkit-appearance: none;
            -moz-appearance: textfield;
            padding: 0 !important;
            margin: 0 auto !important;
            display: block !important;
            outline: none !important;
          }
          input[type="text"] {
            text-align: left !important;
          }
          input[type="number"] {
            text-align: center !important;
            font-weight: bold !important;
          }
          th {
            background-color: #0b5345 !important;
            color: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .subject-name {
            font-weight: 600 !important;
          }
          button.print-btn {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
