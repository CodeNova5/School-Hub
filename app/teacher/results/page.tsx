"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Search,
  Filter,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Users,
  GraduationCap,
  RotateCcw,
  X,
  Clock,
  CalendarDays,
  Sparkles,
  School,
  FileSpreadsheet,
} from 'lucide-react';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { useSchoolContext } from '@/hooks/use-school-context';

/* ─────── Types ─────── */

interface SubjectClass {
  id: string;
  subject_id: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  is_optional: boolean;
  department: string | null;
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

interface StudentScore {
  student_id: string;
  student_name: string;
  component_scores: Record<string, number>;
  total: number;
  grade: string;
  remark: string;
}

type CompletionFilter = 'all' | 'complete' | 'incomplete';

/* ─────── Sub-component: Score Input ─────── */

function ScoreInput({
  value,
  max,
  onChange,
  hasError,
}: {
  value: number;
  max: number;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const val = parseInt(e.target.value);
        if (isNaN(val)) onChange('0');
        else if (val > max) onChange(String(max));
        else if (val < 0) onChange('0');
      }}
      className={`
        w-full text-center border rounded-md px-1 py-1 text-sm font-medium
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        ${value > 0
          ? 'border-blue-200 bg-blue-50/50 text-blue-900'
          : hasError
            ? 'border-red-300 bg-red-50/50 text-red-700'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
        }
      `}
      placeholder="—"
    />
  );
}

/* ─────── Main Page ─────── */

export default function SubjectResultEntryPage() {
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [resultComponents, setResultComponents] = useState<ResultComponentTemplate[]>([]);
  const [gradeScale, setGradeScale] = useState<ResultGradeScale[]>([]);
  const [configuredPassPercentage, setConfiguredPassPercentage] = useState<number>(40);
  const [resultSettingsLoaded, setResultSettingsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [currentSessionName, setCurrentSessionName] = useState('');
  const [currentTermName, setCurrentTermName] = useState('');
  const [currentStudentCount, setCurrentStudentCount] = useState(0);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const prevStudentsRef = useRef<string>('');

  /* ─────── Effects ─────── */

  useEffect(() => {
    loadResultSettings();
    loadTeacherSubjects();
  }, [schoolId]);

  useEffect(() => {
    if (selectedSubjectClassId && resultSettingsLoaded) {
      loadStudentsForSubjectClass(selectedSubjectClassId);
    } else if (!selectedSubjectClassId) {
      setStudents([]);
    }
  }, [selectedSubjectClassId, resultSettingsLoaded]);

  useEffect(() => {
    if (selectedClassId && selectedSubjectId) {
      const sc = subjectClasses.find(
        (s) => s.class_id === selectedClassId && s.subject_id === selectedSubjectId,
      );
      setSelectedSubjectClassId(sc?.id || '');
    } else {
      setSelectedSubjectClassId('');
    }
  }, [selectedClassId, selectedSubjectId, subjectClasses]);

  /* ─────── Derive completion stats ─────── */

  const activeComponents = useMemo(
    () => resultComponents.filter((c) => c.is_active),
    [resultComponents],
  );

  const totalMaxScore = useMemo(
    () => activeComponents.reduce((s, c) => s + c.max_score, 0),
    [activeComponents],
  );

  const passThreshold = useMemo(
    () => (totalMaxScore * configuredPassPercentage) / 100,
    [totalMaxScore, configuredPassPercentage],
  );

  const isSubjectCompleteFn = useCallback(
    (score: StudentScore) => {
      if (activeComponents.length === 0) return false;
      return activeComponents.every(
        (c) => Number(score.component_scores[c.component_key] || 0) > 0,
      );
    },
    [activeComponents],
  );

  const completionStats = useMemo(() => {
    const total = students.length;
    const complete = students.filter(isSubjectCompleteFn).length;
    const incomplete = total - complete;
    const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;
    return { total, complete, incomplete, percentage };
  }, [students, isSubjectCompleteFn]);

  const classAverage = useMemo(() => {
    if (students.length === 0) return 0;
    const sum = students.reduce((acc, s) => acc + s.total, 0);
    return (sum / students.length).toFixed(1);
  }, [students]);

  /* ─────── Filtered students ─────── */

  const filteredStudents = useMemo(() => {
    let result = students;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.student_name.toLowerCase().includes(q));
    }

    if (completionFilter === 'complete') {
      result = result.filter(isSubjectCompleteFn);
    } else if (completionFilter === 'incomplete') {
      result = result.filter((s) => !isSubjectCompleteFn(s));
    }

    return result;
  }, [students, searchQuery, completionFilter, isSubjectCompleteFn]);

  /* ─────── Update dirty tracking ─────── */

  useEffect(() => {
    const key = JSON.stringify(students.map((s) => s.component_scores));
    if (prevStudentsRef.current && prevStudentsRef.current !== key) {
      setIsDirty(true);
    }
    prevStudentsRef.current = key;
  }, [students]);

  /* ─────── Data Loading ─────── */

  async function loadResultSettings() {
    if (!schoolId) return;
    try {
      const [{ data: settingsData }, { data: componentRows }, { data: gradeRows }] =
        await Promise.all([
          supabase
            .from('result_school_settings')
            .select('pass_percentage, is_configured')
            .eq('school_id', schoolId)
            .maybeSingle(),
          supabase
            .from('result_component_templates')
            .select('component_key, component_name, max_score, display_order, is_active')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .order('display_order', { ascending: true }),
          supabase
            .from('result_grade_scales')
            .select('grade_label, min_percentage, remark, display_order')
            .eq('school_id', schoolId)
            .order('display_order', { ascending: true }),
        ]);

      if (settingsData?.is_configured && componentRows && componentRows.length > 0) {
        setConfiguredPassPercentage(Number(settingsData.pass_percentage) || 40);
        setResultComponents(componentRows as ResultComponentTemplate[]);
        setGradeScale((gradeRows || []) as ResultGradeScale[]);
      } else {
        setResultComponents((componentRows || []) as ResultComponentTemplate[]);
        setGradeScale([
          { grade_label: 'A1', min_percentage: 75, remark: 'Excellent', display_order: 1 },
          { grade_label: 'B2', min_percentage: 70, remark: 'Very Good', display_order: 2 },
          { grade_label: 'B3', min_percentage: 65, remark: 'Good', display_order: 3 },
          { grade_label: 'C4', min_percentage: 60, remark: 'Credit', display_order: 4 },
          { grade_label: 'C5', min_percentage: 55, remark: 'Credit', display_order: 5 },
          { grade_label: 'C6', min_percentage: 50, remark: 'Credit', display_order: 6 },
          { grade_label: 'D7', min_percentage: 45, remark: 'Pass', display_order: 7 },
          { grade_label: 'E8', min_percentage: 40, remark: 'Pass', display_order: 8 },
          { grade_label: 'F9', min_percentage: 0, remark: 'Fail', display_order: 9 },
        ]);
      }
      setResultSettingsLoaded(true);
    } catch (err: any) {
      console.error('Failed to load result settings:', err);
    }
  }

  async function loadTeacherSubjects() {
    if (!schoolId) return;
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      const teacher = user ? await getTeacherByUserId(user.id) : null;
      if (!teacher) {
        toast.error('Teacher profile not found');
        setIsLoading(false);
        return;
      }
      setTeacherName(`${teacher.first_name} ${teacher.last_name}`);
      const { data: subjectClassesData } = await supabase
        .from('subject_classes')
        .select(
          `id, subject_id, class_id, is_optional, department_id, subjects!subject_classes_subject_id_fkey(name), classes(name)`,
        )
        .eq('teacher_id', teacher.id)
        .eq('school_id', schoolId);
      if (!subjectClassesData || subjectClassesData.length === 0) {
        toast.error('No subject assignments found for you.');
        setIsLoading(false);
        return;
      }
      setSubjectClasses(
        subjectClassesData.map((sc: any) => ({
          id: sc.id,
          subject_id: sc.subject_id,
          subject_name: sc.subjects?.name || 'Unknown Subject',
          class_id: sc.class_id,
          class_name: sc.classes?.name || 'Unknown Class',
          is_optional: sc.is_optional || false,
          department: sc.department_id || null,
        })),
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subjects');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStudentsForSubjectClass(subjectClassId: string) {
    if (!schoolId) return;
    setIsLoading(true);
    try {
      const subjectClass = subjectClasses.find((sc) => sc.id === subjectClassId);
      if (!subjectClass) return;

      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', subjectClass.class_id)
        .eq('status', 'active')
        .eq('school_id', schoolId)
        .order('first_name');

      const now = Date.now();
      let optionalSubjectIds: string[] = [];
      if (subjectClass.is_optional) {
        let optQuery = supabase
          .from('student_optional_subjects')
          .select('student_id')
          .eq('subject_id', subjectClass.subject_id)
          .eq('school_id', schoolId);

        // The session/term data is loaded right after this block — but we need it here.
        // Instead, we query optional subjects with no session filter first (backward compatible),
        // then later override with session-specific records if available.
        const { data: optionalSubjectRows } = await optQuery;
        optionalSubjectIds = (optionalSubjectRows || []).map((row: any) => row.student_id);
      }

      const filteredStudents = (studentsData || []).filter((student: any) => {
        if (subjectClass.is_optional) return optionalSubjectIds.includes(student.id);
        if (subjectClass.department) return student.department === subjectClass.department;
        return true;
      });

      setCurrentStudentCount(filteredStudents.length);

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .maybeSingle();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .maybeSingle();

      setCurrentSessionName(sessionData?.name || '—');
      setCurrentTermName(termData?.name || '—');

      let existingResults: any[] = [];
      if (sessionData && termData) {
        const { data: resultsData } = await supabase
          .from('results')
          .select('*')
          .eq('subject_class_id', subjectClassId)
          .eq('session_id', sessionData.id)
          .eq('term_id', termData.id)
          .eq('school_id', schoolId);
        existingResults = resultsData || [];
      }

      const existingResultIds = existingResults
        .map((row: any) => row.id)
        .filter((id: string | undefined) => Boolean(id));

      let componentScoreRows: Array<{
        result_id: string;
        component_key: string;
        score: number;
      }> = [];
      if (existingResultIds.length > 0) {
        const { data: componentData } = await supabase
          .from('result_component_scores')
          .select('result_id, component_key, score')
          .eq('school_id', schoolId)
          .in('result_id', existingResultIds);
        componentScoreRows = (componentData ||
          []) as Array<{ result_id: string; component_key: string; score: number }>;
      }

      const componentScoresByResultId: Record<string, Record<string, number>> = {};
      for (const row of componentScoreRows) {
        if (!componentScoresByResultId[row.result_id]) {
          componentScoresByResultId[row.result_id] = {};
        }
        componentScoresByResultId[row.result_id][row.component_key] = Number(row.score) || 0;
      }

      const studentScores: StudentScore[] = filteredStudents.map((student: any) => {
        const result = existingResults.find((r) => r.student_id === student.id);
        const dynamicScores = result?.id ? componentScoresByResultId[result.id] || {} : {};

        const component_scores: Record<string, number> = {};
        resultComponents.forEach((component) => {
          const dynamicValue = dynamicScores[component.component_key];
          const legacyValue = result
            ? (result[component.component_key as keyof typeof result] || 0)
            : 0;
          const value = typeof dynamicValue === 'number' ? dynamicValue : Number(legacyValue) || 0;
          component_scores[component.component_key] = value;
        });

        const total = activeComponents.reduce(
          (sum, c) => sum + (component_scores[c.component_key] || 0),
          0,
        );

        const { grade, remark } = calculateGrade(total);
        return {
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          component_scores,
          total,
          grade,
          remark: result?.remark || remark,
        };
      });

      setStudents(studentScores);
      setIsDirty(false);
      setLastSavedAt(null);
      prevStudentsRef.current = JSON.stringify(studentScores.map((s) => s.component_scores));
      console.debug(`[Results] Loaded ${studentScores.length} students in ${Date.now() - now}ms`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }

  /* ─────── Grade Calculation ─────── */

  function calculateGrade(total: number) {
    const percentage = totalMaxScore > 0 ? (total / totalMaxScore) * 100 : 0;

    const sortedScale = [...gradeScale].sort((a, b) => b.min_percentage - a.min_percentage);
    const fallback = sortedScale[sortedScale.length - 1] || {
      grade_label: 'F9',
      remark: 'Fail',
      min_percentage: 0,
      display_order: 99,
    };

    if (percentage < configuredPassPercentage) {
      return { grade: fallback.grade_label, remark: fallback.remark || 'Fail' };
    }

    const matched = sortedScale.find((item) => percentage >= item.min_percentage) || fallback;
    return { grade: matched.grade_label, remark: matched.remark || '' };
  }

  /* ─────── Score Update ─────── */

  function updateScore(index: number, componentKey: string, value: string) {
    const newScores = [...students];
    let num = Math.max(0, Number(value) || 0);

    const component = resultComponents.find((c) => c.component_key === componentKey);
    if (component) {
      num = Math.min(num, component.max_score);
    }

    newScores[index].component_scores = {
      ...newScores[index].component_scores,
      [componentKey]: num,
    };

    const total = activeComponents.reduce(
      (sum, c) => sum + (newScores[index].component_scores[c.component_key] || 0),
      0,
    );

    const { grade, remark } = calculateGrade(total);
    newScores[index].total = total;
    newScores[index].grade = grade;
    newScores[index].remark = remark;

    setStudents(newScores);
  }

  function updateRemark(index: number, value: string) {
    const newScores = [...students];
    newScores[index].remark = value;
    setStudents(newScores);
  }

  /* ─────── Bulk Actions ─────── */

  function clearAllScores() {
    if (!confirm('Clear all scores for this subject? This cannot be undone.')) return;
    const newScores = students.map((s) => ({
      ...s,
      component_scores: {} as Record<string, number>,
      total: 0,
      grade: '',
      remark: '',
    }));
    setStudents(newScores);
    toast.info('All scores cleared');
  }

  /* ─────── Handle Save ─────── */

  async function handleSave() {
    if (!selectedSubjectClassId || !schoolId) return;
    setIsSaving(true);
    try {
      const user = await getCurrentUser();
      const teacher = user ? await getTeacherByUserId(user.id) : null;
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .maybeSingle();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (!sessionData || !termData) {
        toast.error('No active session or term');
        setIsSaving(false);
        return;
      }

      const activeMaxScore =
        activeComponents.reduce((sum, component) => sum + Number(component.max_score || 0), 0) ||
        100;

      const normalizedStudents = students.map((student) => {
        const total = activeComponents.reduce(
          (sum, component) => sum + Number(student.component_scores[component.component_key] || 0),
          0,
        );
        const percentage = (total / activeMaxScore) * 100;
        const sortedScale = [...gradeScale].sort((a, b) => b.min_percentage - a.min_percentage);
        const fallback = sortedScale[sortedScale.length - 1] || {
          grade_label: 'F9',
          remark: 'Fail',
          min_percentage: 0,
          display_order: 99,
        };
        const matched = sortedScale.find((item) => percentage >= item.min_percentage) || fallback;
        const computedGrade =
          percentage < configuredPassPercentage ? fallback.grade_label : matched.grade_label;
        const computedRemark =
          percentage < configuredPassPercentage
            ? fallback.remark || 'Fail'
            : matched.remark || '';

        return {
          ...student,
          total,
          grade: computedGrade,
          remark: student.remark?.trim() ? student.remark : computedRemark,
        };
      });

      const records = normalizedStudents.map((s) => ({
        student_id: s.student_id,
        subject_class_id: selectedSubjectClassId,
        session_id: sessionData.id,
        term_id: termData.id,
        total: s.total,
        grade: s.grade,
        remark: s.remark,
        class_teacher_name: teacherName,
        entered_by: teacher?.id,
        school_id: schoolId,
      }));

      const { data: savedRows, error } = await supabase
        .from('results')
        .upsert(records, { onConflict: 'student_id,subject_class_id,session_id,term_id' })
        .select('id, student_id');
      if (error) throw error;

      const rowMap: Record<string, string> = {};
      for (const row of (savedRows || []) as Array<{ id: string; student_id: string }>) {
        rowMap[row.student_id] = row.id;
      }

      const savedResultIds = Object.values(rowMap);
      if (savedResultIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('result_component_scores')
          .delete()
          .eq('school_id', schoolId)
          .in('result_id', savedResultIds);
        if (deleteError) throw deleteError;

        const componentRows = normalizedStudents.flatMap((student) => {
          const resultId = rowMap[student.student_id];
          if (!resultId) return [];
          return activeComponents.map((component) => ({
            school_id: schoolId,
            result_id: resultId,
            component_key: component.component_key,
            score: Number(student.component_scores[component.component_key] || 0),
          }));
        });

        if (componentRows.length > 0) {
          const { error: componentSaveError } = await supabase
            .from('result_component_scores')
            .upsert(componentRows, { onConflict: 'result_id,component_key' });
          if (componentSaveError) throw componentSaveError;
        }
      }

      setStudents(normalizedStudents);
      setIsDirty(false);
      setLastSavedAt(new Date());
      toast.success('Subject results saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save results');
    } finally {
      setIsSaving(false);
    }
  }

  /* ─────── Export CSV ─────── */

  function exportCSV() {
    if (students.length === 0) return;

    const headers = ['Student Name', ...activeComponents.map((c) => c.component_name), 'Total', 'Grade', 'Remark'];
    const rows = students.map((s) => [
      s.student_name,
      ...activeComponents.map((c) => s.component_scores[c.component_key] || 0),
      s.total,
      s.grade,
      s.remark,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${subjectClasses.find((sc) => sc.id === selectedSubjectClassId)?.subject_name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  }

  /* ─────── Derived UI Data ─────── */

  const uniqueClasses = Array.from(
    new Map(
      subjectClasses.map((sc) => [
        sc.class_id,
        { id: sc.class_id, name: sc.class_name },
      ]),
    ).values(),
  );

  const filteredSubjects = subjectClasses.filter((sc) => sc.class_id === selectedClassId);
  const selectedSubjectInfo = subjectClasses.find((sc) => sc.id === selectedSubjectClassId);

  /* ─────── Render ─────── */

  const showResultsArea = !!(selectedSubjectClassId && !isLoading && resultSettingsLoaded);

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-4 md:space-y-6 pb-12">

        {/* ─── Header ─── */}
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Subject Results Entry
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Enter and manage student scores for your subjects
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white rounded-lg border px-3 py-2 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5" />
            {lastSavedAt ? `Last saved: ${lastSavedAt.toLocaleTimeString()}` : 'Not saved yet'}
            {isDirty && (
              <span className="ml-1 inline-flex items-center gap-1 text-amber-600 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved
              </span>
            )}
          </div>
        </div>

        {/* ─── Selection Card ─── */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              {/* Class Select */}
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Class
                </label>
                <Select
                  value={selectedClassId}
                  onValueChange={(val) => {
                    setSelectedClassId(val);
                    setSelectedSubjectId('');
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a class..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject Select */}
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Subject
                </label>
                <Select
                  value={selectedSubjectId}
                  onValueChange={setSelectedSubjectId}
                  disabled={!selectedClassId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        selectedClassId ? 'Select a subject...' : 'Choose a class first'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map((sc) => (
                      <SelectItem key={sc.subject_id} value={sc.subject_id}>
                        <div className="flex items-center gap-2">
                          <span>{sc.subject_name}</span>
                          {sc.is_optional && (
                            <Badge variant="secondary" className="text-[10px] px-1.5">
                              Optional
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full md:w-auto">
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !selectedSubjectClassId || students.length === 0}
                  size="default"
                  className="flex-1 md:flex-none"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" /> Save
                    </span>
                  )}
                </Button>
                {showResultsArea && students.length > 0 && (
                  <>
                    <Button variant="outline" size="icon" onClick={exportCSV} title="Export CSV">
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={clearAllScores}
                      title="Clear all scores"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Session/Term context */}
            {selectedSubjectClassId && !isLoading && (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Session: <strong>{currentSessionName}</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <School className="h-3.5 w-3.5" />
                  Term: <strong>{currentTermName}</strong>
                </span>
                {selectedSubjectInfo && (
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {selectedSubjectInfo.subject_name} — {selectedSubjectInfo.class_name}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Results Area ─── */}
        {resultSettingsLoaded && resultComponents.length === 0 && selectedSubjectClassId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-amber-500" />
            <p className="font-semibold text-amber-900">Result components not configured</p>
            <p className="text-sm text-amber-700 mt-1">
              Please ask an admin to configure result components in School Config → Result Settings before entering scores.
            </p>
          </div>
        ) : showResultsArea ? (
          students.length > 0 ? (
            <>
              {/* ─── Progress Dashboard ─── */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                        Students
                      </p>
                      <Users className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-blue-900">{completionStats.total}</p>
                    <p className="text-xs text-blue-600 mt-0.5">Enrolled in this class</p>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-gradient-to-br from-emerald-50 to-emerald-100/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                        Complete
                      </p>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-900">{completionStats.complete}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">{completionStats.percentage}% done</p>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                        Pending
                      </p>
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-bold text-amber-900">{completionStats.incomplete}</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {completionStats.incomplete === 0
                        ? 'All done! 🎉'
                        : `${completionStats.incomplete} student${completionStats.incomplete === 1 ? '' : 's'} need scores`}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
                        Class Avg
                      </p>
                      <GraduationCap className="h-4 w-4 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-purple-900">
                      {classAverage}
                      <span className="text-sm font-normal text-purple-600">/{totalMaxScore}</span>
                    </p>
                    <p className="text-xs text-purple-600 mt-0.5">
                      Grade: {students.length > 0 ? calculateGrade(Number(classAverage)).grade : '—'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* ─── Overall Progress Bar ─── */}
              <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Overall Progress</span>
                  <span className="text-xs font-bold text-gray-500">
                    {completionStats.complete}/{completionStats.total} students
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${completionStats.percentage}%`,
                      background:
                        completionStats.percentage === 100
                          ? 'linear-gradient(90deg, #059669, #10b981)'
                          : completionStats.percentage >= 50
                            ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                            : 'linear-gradient(90deg, #ef4444, #f97316)',
                    }}
                  />
                </div>
                {completionStats.percentage === 100 && (
                  <div className="mt-2 flex items-center gap-1.5 text-emerald-700 text-xs font-medium">
                    <Sparkles className="h-3.5 w-3.5" />
                    All students have complete scores!
                  </div>
                )}
              </div>

              {/* ─── Search & Filter Bar ─── */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search students by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400 shrink-0" />
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium flex-wrap">
                    {(
                      [
                        { key: 'all', label: `All (${completionStats.total})` },
                        { key: 'complete', label: `✓ Done (${completionStats.complete})` },
                        { key: 'incomplete', label: `⏳ Pending (${completionStats.incomplete})` },
                      ] as { key: CompletionFilter; label: string }[]
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setCompletionFilter(tab.key)}
                        className={`px-3 py-1.5 transition-colors ${
                          completionFilter === tab.key
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── Desktop Table ─── */}
              <div className="hidden md:block">
                <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto max-h-[65vh] overflow-y-auto" ref={tableBodyRef}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider w-10">
                            #
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider min-w-[180px]">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              Student
                            </span>
                          </th>
                          {activeComponents.map((component) => (
                            <th
                              key={component.component_key}
                              className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider min-w-[80px]"
                            >
                              {component.component_name}
                              <span className="block text-[10px] font-normal text-blue-200 mt-0.5">
                                max: {component.max_score}
                              </span>
                            </th>
                          ))}
                          <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider w-[80px] bg-blue-900/40">
                            Total
                            <span className="block text-[10px] font-normal text-blue-200 mt-0.5">
                              /{totalMaxScore}
                            </span>
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider w-[70px] bg-blue-900/40">
                            Grade
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider min-w-[140px]">
                            Remark
                          </th>
                          <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider w-[70px]">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td
                              colSpan={activeComponents.length + 5}
                              className="px-4 py-12 text-center text-gray-400"
                            >
                              {searchQuery
                                ? 'No students match your search.'
                                : 'No students to display.'}
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((student, index) => {
                            const isComplete = isSubjectCompleteFn(student);
                            const studentIndex = students.indexOf(student);
                            return (
                              <tr
                                key={student.student_id}
                                className={`
                                  transition-colors duration-150 group
                                  ${isComplete ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : 'bg-white hover:bg-amber-50/30'}
                                `}
                              >
                                <td className="px-4 py-2.5 text-gray-400 text-xs font-mono">
                                  {index + 1}
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className={`
                                        h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold
                                        ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                                      `}
                                    >
                                      {student.student_name.charAt(0)}
                                    </div>
                                    <span className="font-medium text-gray-800 truncate">
                                      {student.student_name}
                                    </span>
                                  </div>
                                </td>
                                {activeComponents.map((component) => (
                                  <td key={component.component_key} className="px-1 py-1">
                                    <ScoreInput
                                      value={student.component_scores[component.component_key]}
                                      max={component.max_score}
                                      onChange={(v) =>
                                        updateScore(studentIndex, component.component_key, v)
                                      }
                                      hasError={
                                        !isComplete &&
                                        !student.component_scores[component.component_key]
                                      }
                                    />
                                  </td>
                                ))}
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    className={`
                                      font-bold text-base
                                      ${student.total >= passThreshold ? 'text-emerald-700' : 'text-red-600'}
                                    `}
                                  >
                                    {student.total}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <Badge
                                    variant={
                                      student.total >= passThreshold ? 'default' : 'destructive'
                                    }
                                    className="font-mono text-xs px-2"
                                  >
                                    {student.grade || '—'}
                                  </Badge>
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    type="text"
                                    value={student.remark}
                                    onChange={(e) => updateRemark(studentIndex, e.target.value)}
                                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-transparent hover:border-gray-300 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                                    placeholder="Add remark..."
                                  />
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  {isComplete ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          <p className="text-xs">All scores entered</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertCircle className="h-4 w-4 text-amber-400 mx-auto cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="left">
                                          <p className="text-xs">Missing some scores</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table footer */}
                  <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Showing {filteredStudents.length} of {students.length} student
                      {students.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" /> Complete
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400" /> Pending
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── Mobile Cards ─── */}
              <div className="md:hidden space-y-3">
                {/* Mobile search + filter */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    {searchQuery ? 'No matching students' : 'No students to display'}
                  </div>
                ) : (
                  filteredStudents.map((student, index) => {
                    const isComplete = isSubjectCompleteFn(student);
                    const studentIndex = students.indexOf(student);
                    return (
                      <div
                        key={student.student_id}
                        className={`
                          rounded-xl border p-4 space-y-3 transition-all
                          ${isComplete ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/20'}
                        `}
                      >
                        {/* Student header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`
                                h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
                                ${isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}
                              `}
                            >
                              {student.student_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {student.student_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                Total: <strong>{student.total}</strong>/{totalMaxScore} · Grade:{' '}
                                <strong>{student.grade || '—'}</strong>
                              </p>
                            </div>
                          </div>
                          {isComplete ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0" />
                          )}
                        </div>

                        {/* Score inputs */}
                        <div className="grid grid-cols-2 gap-2">
                          {activeComponents.map((component) => (
                            <div key={component.component_key}>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">
                                {component.component_name}{' '}
                                <span className="text-gray-400">({component.max_score})</span>
                              </label>
                              <ScoreInput
                                value={student.component_scores[component.component_key]}
                                max={component.max_score}
                                onChange={(v) =>
                                  updateScore(studentIndex, component.component_key, v)
                                }
                                hasError={
                                  !isComplete &&
                                  !student.component_scores[component.component_key]
                                }
                              />
                            </div>
                          ))}
                        </div>

                        {/* Remark */}
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">
                            Remark
                          </label>
                          <input
                            type="text"
                            value={student.remark}
                            onChange={(e) => updateRemark(studentIndex, e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-md px-3 py-2 bg-white"
                            placeholder="Add remark..."
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* ─── No students ─── */
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm">
              <Users className="h-14 w-14 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-700">No students found</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedSubjectInfo?.is_optional
                  ? 'No students are enrolled in this optional subject.'
                  : 'No active students match the criteria for this subject.'}
              </p>
            </div>
          )
        ) : isLoading ? (
          /* ─── Loading skeleton ─── */
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-96 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ) : (
          /* ─── Select a subject prompt ─── */
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-gray-800">Select a subject to begin</p>
            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              Choose a class and subject from the dropdowns above, then enter scores for each
              student.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
