"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Subject } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';

interface ClassWithDetails extends Class {
  studentCount: number;
  subjects: Subject[];
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadClasses();
  }, []);

  async function loadClasses() {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error('Please log in to continue');
        return;
      }

      const teacher = await getTeacherByUserId(user.id);
      if (!teacher) {
        toast.error('Teacher profile not found');
        return;
      }

      const { data: teacherClassesData } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', teacher.id);

      const classIds = teacherClassesData?.map((tc) => tc.class_id) || [];

      if (classIds.length === 0) {
        toast.error('No classes assigned to you');
        setIsLoading(false);
        return;
      }

      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .order('level');

      if (classesData) {
        const classesWithDetails = await Promise.all(
          classesData.map(async (cls) => {
            const { count: studentCount } = await supabase
              .from('students')
              .select('id', { count: 'exact' })
              .eq('class_id', cls.id)
              .eq('status', 'active');

            const { data: subjectClassesData } = await supabase
              .from('subject_classes')
              .select('subject_id')
              .eq('class_id', cls.id);

            const subjectIds = subjectClassesData?.map((sc) => sc.subject_id) || [];

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
              studentCount: studentCount || 0,
              subjects,
            };
          })
        );

        setClasses(classesWithDetails);
      }
    } catch (error: any) {
      toast.error('Failed to load classes: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const getLevelColor = (educationLevel: string) => {
    switch (educationLevel) {
      case 'Pre-Primary':
        return 'bg-pink-100 text-pink-700';
      case 'Primary':
        return 'bg-blue-100 text-blue-700';
      case 'JSS':
        return 'bg-green-100 text-green-700';
      case 'SSS':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
              <p className="text-sm text-gray-400 mt-2">
                Contact the administrator to get classes assigned to you
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {classes.map((cls) => (
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
                        {cls.department && (
                          <Badge variant="outline">{cls.department}</Badge>
                        )}
                        {cls.room_number && (
                          <Badge variant="secondary">Room {cls.room_number}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Students</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {cls.studentCount}
                        <span className="text-sm text-gray-500">/{cls.capacity}</span>
                      </p>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <p className="text-xs text-gray-600 mb-1">Subjects</p>
                      <p className="text-2xl font-bold text-orange-600">{cls.subjects.length}</p>
                    </div>
                  </div>

                  {cls.subjects.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpen className="h-4 w-4 text-gray-600" />
                        <p className="text-sm font-medium text-gray-700">Subjects</p>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-gray-50 rounded">
                        {cls.subjects.map((subject) => (
                          <div
                            key={subject.id}
                            className="text-sm text-gray-700 py-1 px-2 hover:bg-white rounded transition-colors"
                          >
                            {subject.name}
                            {subject.is_optional && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Optional
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <p className="text-sm text-amber-800">
                        No subjects assigned yet
                      </p>
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
