"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Subject } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface ClassWithDetails extends Class {
  studentCount: number;
  subjects: Subject[];
  avgScore: string;
  highestStudent: { first_name: string; last_name: string; total: number } | null;
  passRate: number;
  maleCount: number;
  femaleCount: number;
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) return toast.error('Please log in to continue');

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) return toast.error('Teacher profile not found');

      const { data: teacherClassesData } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', teacher.id);

      const classIds = teacherClassesData?.map(tc => tc.class_id) || [];
      if (!classIds.length) return toast.error('No classes assigned to you');

      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .order('level');

      if (!classesData) return;

      const classesWithDetails: ClassWithDetails[] = await Promise.all(
        classesData.map(async cls => {
          // Fetch students
          const { data: studentsData } = await supabase
            .from('students')
            .select('id, first_name, last_name, gender, results(subject_id, total, grade)')
            .eq('class_id', cls.id)
            .eq('status', 'active');

          const students = studentsData || [];

          // Calculate analytics
          let totalScores: number[] = [];
          let highestStudent: any = null;
          let maleCount = 0;
          let femaleCount = 0;
          let passCount = 0;

          students.forEach(student => {
            let studentTotal = 0;
            student.results?.forEach((r: any) => {
              studentTotal += r.total;
              if (r.total >= 50) passCount += 1;
            });

            if (studentTotal > (highestStudent?.total || 0)) {
              highestStudent = { ...student, total: studentTotal };
            }

            totalScores.push(studentTotal);

            if (student.gender?.toLowerCase() === 'male') maleCount += 1;
            else if (student.gender?.toLowerCase() === 'female') femaleCount += 1;
          });

          const avgScore = totalScores.length
            ? (totalScores.reduce((a, b) => a + b, 0) / totalScores.length).toFixed(1)
            : '0';
          const passRate = students.length ? Math.round((passCount / students.length) * 100) : 0;

          // Fetch subjects
          const { data: subjectClassesData } = await supabase
            .from('subject_classes')
            .select('subject_id')
            .eq('class_id', cls.id);

          const subjectIds = subjectClassesData?.map(sc => sc.subject_id) || [];

          let subjects: Subject[] = [];
          if (subjectIds.length > 0) {
            const { data: subjectsData } = await supabase
              .from('subjects')
              .select('*')
              .in('id', subjectIds)
              .order('name');
            subjects = subjectsData || [];
          }

          return {
            ...cls,
            studentCount: students.length,
            subjects,
            avgScore,
            highestStudent,
            passRate,
            maleCount,
            femaleCount,
          };
        })
      );

      setClasses(classesWithDetails);
    } catch (error: any) {
      toast.error('Failed to load classes: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const getLevelColor = (educationLevel: string) => {
    switch (educationLevel) {
      case 'Pre-Primary': return 'bg-pink-100 text-pink-700';
      case 'Primary': return 'bg-blue-100 text-blue-700';
      case 'JSS': return 'bg-green-100 text-green-700';
      case 'SSS': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading your classes...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Classes</h1>
          <p className="text-gray-600 mt-1">
            View your assigned classes and their subjects ({classes.length} classes)
          </p>
        </div>

        {classes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No classes assigned</p>
              <p className="text-sm text-gray-400 mt-2">Contact the administrator to get classes assigned</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {classes.map(cls => (
              <Card key={cls.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 mb-2">
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{cls.name}</h3>
                        </div>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className={getLevelColor(cls.education_level)}>{cls.level}</Badge>
                        {cls.department && <Badge variant="outline">{cls.department}</Badge>}
                        {cls.room_number && <Badge variant="secondary">Room {cls.room_number}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Avg Score</p>
                      <p className="text-2xl font-bold text-green-600">{cls.avgScore}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Top Student</p>
                      <p className="text-sm font-semibold text-purple-600">
                        {cls.highestStudent ? `${cls.highestStudent.first_name} ${cls.highestStudent.last_name} (${cls.highestStudent.total})` : 'N/A'}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Pass Rate</p>
                      <p className="text-2xl font-bold text-blue-600">{cls.passRate}%</p>
                    </div>
                    <div className="p-3 bg-pink-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Gender</p>
                      <p className="text-sm font-semibold text-pink-600">{cls.maleCount}M / {cls.femaleCount}F</p>
                    </div>
                  </div>

                  {/* Subjects List */}
                  {cls.subjects.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-gray-600" />
                        <p className="text-sm font-medium text-gray-700">Subjects</p>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-gray-50 rounded">
                        {cls.subjects.map(subject => (
                          <div
                            key={subject.id}
                            onClick={() => router.push(`/subjects/${subject.id}/analytics`)}
                            className="text-sm text-gray-700 py-1 px-2 flex justify-between items-center hover:bg-white cursor-pointer rounded transition-colors"
                          >
                            <div>
                              {subject.name}{' '}
                              {subject.is_optional && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Optional
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              {subject.student_count || cls.studentCount} students
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <p className="text-sm text-amber-800">No subjects assigned yet</p>
                    </div>
                  )}

                  {cls.stream && (
                    <div className="text-xs text-gray-500">
                      Stream: <span className="font-medium">{cls.stream}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
