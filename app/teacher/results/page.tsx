"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { Loader2, BookOpen, Users, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSchoolContext } from '@/hooks/use-school-context';

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

export default function SubjectResultEntryPage() {
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherName, setTeacherName] = useState('');
  const [resultComponents, setResultComponents] = useState<ResultComponentTemplate[]>([]);
  const [gradeScale, setGradeScale] = useState<ResultGradeScale[]>([]);
  const [configuredPassPercentage, setConfiguredPassPercentage] = useState<number>(40);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    loadResultSettings();
    loadTeacherSubjects();
  }, [schoolId]);

  async function loadResultSettings() {
    if (!schoolId) return;
    try {
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
    } catch (err: any) {
      console.error('Failed to load result settings:', err);
    }
  }

  useEffect(() => {
    if (selectedSubjectClassId) {
      loadStudentsForSubjectClass(selectedSubjectClassId);
    } else {
      setStudents([]);
    }
  }, [selectedSubjectClassId]);

  useEffect(() => {
    if (selectedClassId && selectedSubjectId) {
      const sc = subjectClasses.find(
        s => s.class_id === selectedClassId && s.subject_id === selectedSubjectId
      );
      setSelectedSubjectClassId(sc?.id || '');
    } else {
      setSelectedSubjectClassId('');
    }
  }, [selectedClassId, selectedSubjectId, subjectClasses]);


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
        .select(`
          id, 
          subject_id, 
          class_id, 
          is_optional,
          department_id,
          subjects!subject_classes_subject_id_fkey(name), 
          classes(name)
        `)
        .eq('teacher_id', teacher.id)
        .eq('school_id', schoolId);
      if (!subjectClassesData || subjectClassesData.length === 0) {
        toast.error('No subject assignments found for you.');
        setIsLoading(false);
        return;
      }
      setSubjectClasses(subjectClassesData.map((sc: any) => ({
        id: sc.id,
        subject_id: sc.subject_id,
        subject_name: sc.subjects?.name || 'Unknown Subject',
        class_id: sc.class_id,
        class_name: sc.classes?.name || 'Unknown Class',
        is_optional: sc.is_optional || false,
        department: sc.department_id || null,
      })));
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
      // Get subject_class info
      const subjectClass = subjectClasses.find(sc => sc.id === subjectClassId);
      if (!subjectClass) return;

      // Get students in the class
      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', subjectClass.class_id)
        .eq('status', 'active')
        .eq('school_id', schoolId)
        .order('first_name');

      // Get optional subjects enrollment if needed
      let optionalSubjectIds: string[] = [];
      if (subjectClass.is_optional) {
        const { data: optionalSubjectRows } = await supabase
          .from('student_optional_subjects')
          .select('student_id')
          .eq('subject_id', subjectClass.subject_id)
          .eq('school_id', schoolId);
        optionalSubjectIds = (optionalSubjectRows || []).map((row: any) => row.student_id);
      }

      // Filter students based on department and optional enrollment
      const filteredStudents = (studentsData || []).filter((student: any) => {
        // If subject is optional, only include students enrolled in it
        if (subjectClass.is_optional) {
          return optionalSubjectIds.includes(student.id);
        }
        // If subject has a department, only include students in that department
        if (subjectClass.department) {
          return student.department === subjectClass.department;
        }
        // Otherwise include all students
        return true;
      });

      // Get existing results for this subject_class (current session/term)
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .single();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .single();
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

      let componentScoreRows: Array<{ result_id: string; component_key: string; score: number }> = [];
      if (existingResultIds.length > 0) {
        const { data: componentData } = await supabase
          .from('result_component_scores')
          .select('result_id, component_key, score')
          .eq('school_id', schoolId)
          .in('result_id', existingResultIds);

        componentScoreRows = (componentData || []) as Array<{ result_id: string; component_key: string; score: number }>;
      }

      const componentScoresByResultId: Record<string, Record<string, number>> = {};
      for (const row of componentScoreRows) {
        if (!componentScoresByResultId[row.result_id]) {
          componentScoresByResultId[row.result_id] = {};
        }
        componentScoresByResultId[row.result_id][row.component_key] = Number(row.score) || 0;
      }

      // Build student scores
      const studentScores: StudentScore[] = filteredStudents.map((student: any) => {
        const result = existingResults.find(r => r.student_id === student.id);
        const dynamicScores = result?.id ? (componentScoresByResultId[result.id] || {}) : {};
        
        // Read dynamic component rows first; fallback to legacy columns for compatibility.
        const component_scores: Record<string, number> = {};
        resultComponents.forEach(component => {
          const dynamicValue = dynamicScores[component.component_key];
          const legacyValue = result ? (result[component.component_key as keyof typeof result] || 0) : 0;
          const value = typeof dynamicValue === 'number' ? dynamicValue : Number(legacyValue) || 0;
          component_scores[component.component_key] = value;
        });
        
        // Calculate total from configured components
        const total = resultComponents
          .filter(c => c.is_active)
          .reduce((sum, c) => sum + (component_scores[c.component_key] || 0), 0);
        
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  }

  const uniqueClasses = Array.from(
    new Map(
      subjectClasses.map(sc => [sc.class_id, {
        id: sc.class_id,
        name: sc.class_name
      }])
    ).values()
  );

  const filteredSubjects = subjectClasses.filter(
    sc => sc.class_id === selectedClassId
  );


  function calculateGrade(total: number) {
    const totalMaxScore = resultComponents
      .filter(c => c.is_active)
      .reduce((sum, c) => sum + c.max_score, 0);
    
    const percentage = totalMaxScore > 0 ? (total / totalMaxScore) * 100 : 0;
    
    const sortedScale = [...gradeScale].sort((a, b) => b.min_percentage - a.min_percentage);
    const fallback = sortedScale[sortedScale.length - 1] || { 
      grade_label: 'F9', 
      remark: 'Fail', 
      min_percentage: 0, 
      display_order: 99 
    };
    
    if (percentage < configuredPassPercentage) {
      return { grade: fallback.grade_label, remark: fallback.remark || 'Fail' };
    }
    
    const matched = sortedScale.find((item) => percentage >= item.min_percentage) || fallback;
    return { grade: matched.grade_label, remark: matched.remark || '' };
  }

  function updateScore(index: number, componentKey: string, value: string) {
    const newScores = [...students];
    let num = Math.max(0, Number(value) || 0);
    
    // Find the component to validate max score
    const component = resultComponents.find(c => c.component_key === componentKey);
    if (component) {
      num = Math.min(num, component.max_score);
    }
    
    // Update component_scores
    newScores[index].component_scores = {
      ...newScores[index].component_scores,
      [componentKey]: num
    };
    
    // Recalculate total
    const total = resultComponents
      .filter(c => c.is_active)
      .reduce((sum, c) => sum + (newScores[index].component_scores[c.component_key] || 0), 0);
    
    const { grade, remark } = calculateGrade(total);
    newScores[index].total = total;
    newScores[index].grade = grade;
    newScores[index].remark = remark;
    
    setStudents(newScores);
  }

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
        .single();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .eq('school_id', schoolId)
        .single();
      if (!sessionData || !termData) {
        toast.error('No active session or term');
        setIsSaving(false);
        return;
      }

      const activeComponents = resultComponents.filter((component) => component.is_active);
      const activeMaxScore = activeComponents.reduce((sum, component) => sum + Number(component.max_score || 0), 0) || 100;

      const normalizedStudents = students.map((student) => {
        const total = activeComponents.reduce(
          (sum, component) => sum + Number(student.component_scores[component.component_key] || 0),
          0
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
        const computedGrade = percentage < configuredPassPercentage ? fallback.grade_label : matched.grade_label;
        const computedRemark = percentage < configuredPassPercentage
          ? (fallback.remark || 'Fail')
          : (matched.remark || '');

        return {
          ...student,
          total,
          grade: computedGrade,
          remark: student.remark?.trim() ? student.remark : computedRemark,
        };
      });

      const records = normalizedStudents.map((s) => {
        const record: any = {
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
        };

        return record;
      });
      const { data: savedRows, error } = await supabase.from('results').upsert(records, {
        onConflict: 'student_id,subject_class_id,session_id,term_id',
      }).select('id, student_id');
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

          return activeComponents
            .map((component) => ({
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

      toast.success('Subject results saved successfully');
      // Optionally, redirect or refresh
    } catch (err: any) {
      toast.error(err.message || 'Failed to save results');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 md:gap-0 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Subject Results Entry</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">Enter and manage student results for your subjects</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-gray-600">Your Subjects</p>
                  <p className="text-xl md:text-2xl font-bold">{subjectClasses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-gray-600">Students</p>
                  <p className="text-xl md:text-2xl font-bold">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-gray-600">Average Score</p>
                  <p className="text-xl md:text-2xl font-bold">
                    {students.length > 0
                      ? (students.reduce((sum, s) => sum + s.total, 0) / students.length).toFixed(1)
                      : '0'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Selection & Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Select Subject & Class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:gap-4">

              {/* Class Select */}
              <div className="flex-1">
                <Select value={selectedClassId} onValueChange={(val) => {
                  setSelectedClassId(val);
                  setSelectedSubjectId('');
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
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
              <div className="flex-1">
                <Select
                  value={selectedSubjectId}
                  onValueChange={setSelectedSubjectId}
                  disabled={!selectedClassId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSubjects.map((sc) => (
                      <SelectItem key={sc.subject_id} value={sc.subject_id}>
                        <div className="flex items-center gap-2">
                          <span>{sc.subject_name}</span>
                          {sc.is_optional && (
                            <Badge variant="secondary" className="text-xs">Optional</Badge>
                          )}
                          {sc.department && (
                            <Badge variant="outline" className="text-xs">{sc.department}</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSave}
                disabled={isSaving || !selectedSubjectClassId || students.length === 0}
                size="lg"
                className="w-full md:w-auto"
              >
                {isSaving ? 'Saving...' : 'Save Results'}
              </Button>

            </div>

          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
            <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">Student Results</h3>
                  <p className="text-xs md:text-sm text-gray-600 mt-0.5">Enter and manage student scores</p>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                {students.length > 0 && (
                  <Badge variant="outline" className="font-medium text-xs md:text-sm">
                    {students.length} students
                  </Badge>
                )}
                {selectedSubjectClassId && (
                  <div className="flex items-center gap-2 text-xs md:text-sm text-gray-700 font-semibold bg-white px-2 md:px-3 py-1.5 rounded-lg border whitespace-nowrap overflow-hidden text-ellipsis">
                    <BookOpen className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span className="truncate">
                      {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.subject_name} -{' '}
                      {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.class_name}
                    </span>
                    {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.is_optional && (
                      <Badge variant="secondary" className="text-xs">Only enrolled</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
              </div>
            ) : selectedSubjectClassId ? (
              students.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:overflow-x-auto md:block">
                    <table className="w-full border-collapse border border-gray-200 text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                          <th className="border border-gray-200 px-4 py-3 text-left font-semibold">#</th>
                          <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Student Name</th>
                          {resultComponents.map((component) => (
                            <th key={component.component_key} className="border border-gray-200 px-4 py-3 text-center font-semibold w-24">
                              {component.component_name}<br />
                              <span className="text-xs font-normal text-gray-600">({component.max_score})</span>
                            </th>
                          ))}
                          <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-20 bg-blue-50">
                            Total<br />
                            <span className="text-xs font-normal text-gray-600">({resultComponents.filter(c => c.is_active).reduce((s, c) => s + c.max_score, 0)})</span>
                          </th>
                          <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-16 bg-blue-50">Grade</th>
                          <th className="border border-gray-200 px-4 py-3 text-center font-semibold min-w-[120px]">Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, index) => (
                          <tr key={student.student_id} className="hover:bg-gray-50">
                            <td className="border border-gray-200 px-4 py-2 text-center text-gray-600">
                              {index + 1}
                            </td>
                            <td className="border border-gray-200 px-4 py-2 font-medium">
                              {student.student_name}
                            </td>
                            {resultComponents.map((component) => (
                              <td key={component.component_key} className="border border-gray-200 px-1 py-1 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={component.max_score}
                                  value={student.component_scores[component.component_key] || ''}
                                  onChange={(e) => updateScore(index, component.component_key, e.target.value)}
                                  className="w-full text-center border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-1"
                                  placeholder="0"
                                />
                              </td>
                            ))}
                            <td className="border border-gray-200 px-3 py-2 text-center font-bold text-lg bg-blue-50">
                              {student.total}
                            </td>
                            <td className="border border-gray-200 px-3 py-2 text-center font-bold bg-blue-50">
                              <Badge
                                variant={student.total >= (resultComponents.filter(c => c.is_active).reduce((s, c) => s + c.max_score, 0) * configuredPassPercentage / 100) ? "default" : "destructive"}
                                className="font-mono"
                              >
                                {student.grade}
                              </Badge>
                            </td>
                            <td className="border border-gray-200 px-2 py-1 text-center">
                              <Textarea
                                value={student.remark}
                                onChange={(e) => {
                                  const newScores = [...students];
                                  newScores[index].remark = e.target.value;
                                  setStudents(newScores);
                                }}
                                rows={1}
                                className="resize-none text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter remark..."
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {students.map((student, index) => (
                      <div key={student.student_id} className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg border border-gray-200 p-4 space-y-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 font-semibold">Student {index + 1}</p>
                            <p className="font-bold text-base text-gray-900">{student.student_name}</p>
                          </div>
                          <Badge
                            variant={student.total >= (resultComponents.filter(c => c.is_active).reduce((s, c) => s + c.max_score, 0) * configuredPassPercentage / 100) ? "default" : "destructive"}
                            className="font-mono text-sm"
                          >
                            {student.grade}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {resultComponents.map((component) => (
                            <div key={component.component_key} className="bg-white rounded border border-gray-200 p-3">
                              <label className="text-xs text-gray-600 font-semibold block mb-1.5">
                                {component.component_name}<span className="text-gray-500">({component.max_score})</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={component.max_score}
                                value={student.component_scores[component.component_key] || ''}
                                onChange={(e) => updateScore(index, component.component_key, e.target.value)}
                                className="w-full text-center border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-2 font-semibold"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="bg-blue-50 rounded border border-blue-200 p-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-semibold">Total Score</p>
                            <p className="text-2xl font-bold text-blue-600">{student.total}/{resultComponents.filter(c => c.is_active).reduce((s, c) => s + c.max_score, 0)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600 font-semibold">Grade</p>
                            <p className="font-bold text-base text-gray-900">{student.grade}</p>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-gray-600 font-semibold block mb-2">
                            Additional Remarks
                          </label>
                          <Textarea
                            value={student.remark}
                            onChange={(e) => {
                              const newScores = [...students];
                              newScores[index].remark = e.target.value;
                              setStudents(newScores);
                            }}
                            rows={2}
                            className="resize-none text-sm border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter any additional remarks..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No students found</p>
                  <p className="text-sm mt-1">
                    {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.is_optional
                      ? 'No students are enrolled in this optional subject'
                      : 'No students match the criteria for this subject'}
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-16 text-gray-500">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a subject to begin</p>
                <p className="text-sm mt-1">Choose a subject and class from the dropdown above to enter results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
