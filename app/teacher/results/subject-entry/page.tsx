"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Student } from '@/lib/types';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save, Loader2, ArrowLeft } from 'lucide-react';

interface SubjectClass {
  id: string;
  subject_id: string;
  subject_name: string;
  class_id: string;
  class_name: string;
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
  const router = useRouter();
  const searchParams = useSearchParams();
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
        .select(`id, subject_id, class_id, subjects (name), classes (name)`)
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
      const studentScores: StudentScore[] = (studentsData || []).map((student: any) => {
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
      <div className="space-y-6 mb-12">
        <div className="flex items-center justify-between print:hidden">
          <Button variant="ghost" onClick={() => router.push('/teacher/results')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Results
          </Button>
          <div className="flex gap-2">
            <Select value={selectedSubjectClassId} onValueChange={setSelectedSubjectClassId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select Subject & Class" />
              </SelectTrigger>
              <SelectContent>
                {subjectClasses.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.subject_name} ({sc.class_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={isSaving || !selectedSubjectClassId}>
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
        </div>
        <Card>
          <CardContent className="p-8">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              <>
                {selectedSubjectClassId && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-3 py-2 text-left">Student</th>
                          <th className="border border-gray-300 px-3 py-2 text-center w-24">Welcome Test (10)</th>
                          <th className="border border-gray-300 px-3 py-2 text-center w-24">Mid-Term (20)</th>
                          <th className="border border-gray-300 px-3 py-2 text-center w-24">Vetting (10)</th>
                          <th className="border border-gray-300 px-3 py-2 text-center w-24">Exam (60)</th>
                          <th className="border border-gray-300 px-3 py-2 text-center w-20">Total (100)</th>
                          <th className="border border-gray-300 px-3 py-2 text-center w-16">Grade</th>
                          <th className="border border-gray-300 px-3 py-2 text-center">Remark</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, index) => (
                          <tr key={student.student_id}>
                            <td className="border border-gray-300 px-3 py-2 font-medium">{student.student_name}</td>
                            <td className="border border-gray-300 px-1 py-1 text-center">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={student.welcome_test || ''}
                                onChange={(e) => updateScore(index, 'welcome_test', e.target.value)}
                                className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1 text-center">
                              <input
                                type="number"
                                min="0"
                                max="20"
                                value={student.mid_term_test || ''}
                                onChange={(e) => updateScore(index, 'mid_term_test', e.target.value)}
                                className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1 text-center">
                              <input
                                type="number"
                                min="0"
                                max="10"
                                value={student.vetting || ''}
                                onChange={(e) => updateScore(index, 'vetting', e.target.value)}
                                className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-1 py-1 text-center">
                              <input
                                type="number"
                                min="0"
                                max="60"
                                value={student.exam || ''}
                                onChange={(e) => updateScore(index, 'exam', e.target.value)}
                                className="w-full text-center border-0 focus:ring-1 focus:ring-blue-500 rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold">{student.total}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center font-bold">{student.grade}</td>
                            <td className="border border-gray-300 px-3 py-2 text-center">
                              <Textarea
                                value={student.remark}
                                onChange={(e) => updateScore(index, 'remark', e.target.value)}
                                rows={1}
                                className="resize-none border-0 bg-transparent focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!selectedSubjectClassId && (
                  <div className="text-center text-gray-500 py-12">
                    <p>Select a subject and class to begin entering results.</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
