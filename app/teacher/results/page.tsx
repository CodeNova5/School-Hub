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
import { Save, Loader2, ArrowLeft, BookOpen, Users, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SubjectClass {
  id: string;
  subject_id: string;
  subject_name: string;
  class_id: string;
  class_name: string;
  is_optional: boolean;
  department: string | null;
}

interface StudentScore {
  student_id: string;
  student_name: string;
  welcome_test: number;
  mid_term_test: number;
  vetting: number;
  exam: number;
  total: number;
  grade: string;
  remark: string;
}

export default function SubjectResultEntryPage() {
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [selectedSubjectClassId, setSelectedSubjectClassId] = useState<string>('');
  const [students, setStudents] = useState<StudentScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [teacherName, setTeacherName] = useState('');

  useEffect(() => {
    loadTeacherSubjects();
  }, []);

  useEffect(() => {
    if (selectedSubjectClassId) {
      loadStudentsForSubjectClass(selectedSubjectClassId);
    } else {
      setStudents([]);
    }
  }, [selectedSubjectClassId]);

  async function loadTeacherSubjects() {
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
          subjects (name, is_optional, department), 
          classes (name)
        `)
        .eq('teacher_id', teacher.id);
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
        is_optional: sc.subjects?.is_optional || false,
        department: sc.subjects?.department || null,
      })));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load subjects');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStudentsForSubjectClass(subjectClassId: string) {
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
        .order('first_name');

      // Get optional subjects enrollment if needed
      let optionalSubjectIds: string[] = [];
      if (subjectClass.is_optional) {
        const { data: optionalSubjectRows } = await supabase
          .from('student_optional_subjects')
          .select('student_id')
          .eq('subject_id', subjectClass.subject_id);
        optionalSubjectIds = (optionalSubjectRows || []).map(row => row.student_id);
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
        .single();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .single();
      let existingResults: any[] = [];
      if (sessionData && termData) {
        const { data: resultsData } = await supabase
          .from('results')
          .select('*')
          .eq('subject_class_id', subjectClassId)
          .eq('session_id', sessionData.id)
          .eq('term_id', termData.id);
        existingResults = resultsData || [];
      }
      // Build student scores
      const studentScores: StudentScore[] = filteredStudents.map((student: any) => {
        const result = existingResults.find(r => r.student_id === student.id);
        const welcome_test = result?.welcome_test || 0;
        const mid_term_test = result?.mid_term_test || 0;
        const vetting = result?.vetting || 0;
        const exam = result?.exam || 0;
        const total = welcome_test + mid_term_test + vetting + exam;
        const { grade, remark } = calculateGrade(total);
        return {
          student_id: student.id,
          student_name: `${student.first_name} ${student.last_name}`,
          welcome_test,
          mid_term_test,
          vetting,
          exam,
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

  function calculateGrade(total: number) {
    if (total >= 75) return { grade: 'A1', remark: 'Excellent' };
    if (total >= 70) return { grade: 'B2', remark: 'Very Good' };
    if (total >= 65) return { grade: 'B3', remark: 'Good' };
    if (total >= 60) return { grade: 'C4', remark: 'Credit' };
    if (total >= 55) return { grade: 'C5', remark: 'Credit' };
    if (total >= 50) return { grade: 'C6', remark: 'Credit' };
    if (total >= 45) return { grade: 'D7', remark: 'Pass' };
    if (total >= 40) return { grade: 'E8', remark: 'Pass' };
    return { grade: 'F9', remark: 'Fail' };
  }

  function updateScore(index: number, field: keyof StudentScore, value: string) {
    const newScores = [...students];
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
    const total = newScores[index].welcome_test + newScores[index].mid_term_test + newScores[index].vetting + newScores[index].exam;
    const { grade, remark } = calculateGrade(total);
    newScores[index].total = total;
    newScores[index].grade = grade;
    newScores[index].remark = remark;
    setStudents(newScores);
  }

  async function handleSave() {
    if (!selectedSubjectClassId) return;
    setIsSaving(true);
    try {
      const user = await getCurrentUser();
      const teacher = user ? await getTeacherByUserId(user.id) : null;
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_current', true)
        .single();
      const { data: termData } = await supabase
        .from('terms')
        .select('*')
        .eq('is_current', true)
        .single();
      if (!sessionData || !termData) {
        toast.error('No active session or term');
        setIsSaving(false);
        return;
      }
      const records = students.map((s) => ({
        student_id: s.student_id,
        subject_class_id: selectedSubjectClassId,
        session_id: sessionData.id,
        term_id: termData.id,
        welcome_test: s.welcome_test,
        mid_term_test: s.mid_term_test,
        vetting: s.vetting,
        exam: s.exam,
        total: s.total,
        grade: s.grade,
        remark: s.remark,
        class_teacher_name: teacherName,
        entered_by: teacher?.id,
      }));
      const { error } = await supabase.from('results').upsert(records, {
        onConflict: 'student_id,subject_class_id,session_id,term_id',
      });
      if (error) throw error;
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subject Results Entry</h1>
            <p className="text-gray-600 mt-1">Enter and manage student results for your subjects</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Your Subjects</p>
                  <p className="text-2xl font-bold">{subjectClasses.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Students</p>
                  <p className="text-2xl font-bold">{students.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Average Score</p>
                  <p className="text-2xl font-bold">
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
            <div className="flex gap-4">
              <div className="flex-1">
                <Select value={selectedSubjectClassId} onValueChange={setSelectedSubjectClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subject and class to begin" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectClasses.map((sc) => (
                      <SelectItem key={sc.id} value={sc.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{sc.subject_name}</span>
                          <span className="text-gray-500">-</span>
                          <span className="text-gray-600">{sc.class_name}</span>
                          {sc.is_optional && (
                            <Badge variant="secondary" className="ml-2 text-xs">Optional</Badge>
                          )}
                          {sc.department && (
                            <Badge variant="outline" className="ml-2 text-xs">{sc.department}</Badge>
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
              >
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
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Student Results</h3>
                  <p className="text-sm text-gray-600 mt-0.5">Enter and manage student scores</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {students.length > 0 && (
                  <Badge variant="outline" className="font-medium">
                    {students.length} students
                  </Badge>
                )}
                {selectedSubjectClassId && (
                  <div className="flex items-center gap-2 text-sm text-gray-700 font-semibold bg-white px-3 py-1.5 rounded-lg border">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span>
                      {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.subject_name} -{' '}
                      {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.class_name}
                    </span>
                    {subjectClasses.find(sc => sc.id === selectedSubjectClassId)?.is_optional && (
                      <Badge variant="secondary" className="text-xs">Only enrolled students shown</Badge>
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
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                        <th className="border border-gray-200 px-4 py-3 text-left font-semibold">#</th>
                        <th className="border border-gray-200 px-4 py-3 text-left font-semibold">Student Name</th>
                        <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-24">
                          Welcome<br />
                          <span className="text-xs font-normal text-gray-600">(10)</span>
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-24">
                          Mid-Term<br />
                          <span className="text-xs font-normal text-gray-600">(20)</span>
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-24">
                          Vetting<br />
                          <span className="text-xs font-normal text-gray-600">(10)</span>
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-24">
                          Exam<br />
                          <span className="text-xs font-normal text-gray-600">(60)</span>
                        </th>
                        <th className="border border-gray-200 px-4 py-3 text-center font-semibold w-20 bg-blue-50">
                          Total<br />
                          <span className="text-xs font-normal text-gray-600">(100)</span>
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
                          <td className="border border-gray-200 px-1 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={student.welcome_test || ''}
                              onChange={(e) => updateScore(index, 'welcome_test', e.target.value)}
                              className="w-full text-center border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="border border-gray-200 px-1 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={student.mid_term_test || ''}
                              onChange={(e) => updateScore(index, 'mid_term_test', e.target.value)}
                              className="w-full text-center border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="border border-gray-200 px-1 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={student.vetting || ''}
                              onChange={(e) => updateScore(index, 'vetting', e.target.value)}
                              className="w-full text-center border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="border border-gray-200 px-1 py-1 text-center">
                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={student.exam || ''}
                              onChange={(e) => updateScore(index, 'exam', e.target.value)}
                              className="w-full text-center border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded px-2 py-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center font-bold text-lg bg-blue-50">
                            {student.total}
                          </td>
                          <td className="border border-gray-200 px-3 py-2 text-center font-bold bg-blue-50">
                            <Badge 
                              variant={student.total >= 50 ? "default" : "destructive"}
                              className="font-mono"
                            >
                              {student.grade}
                            </Badge>
                          </td>
                          <td className="border border-gray-200 px-2 py-1 text-center">
                            <Textarea
                              value={student.remark}
                              onChange={(e) => updateScore(index, 'remark', e.target.value)}
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
