"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject, Class } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';

export default function TeacherSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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

      const { data: subjectClassesData } = await supabase
        .from('subject_classes')
        .select('subject_id')
        .in('class_id', classIds);

      const subjectIds = subjectClassesData?.map((sc) => sc.subject_id) || [];

      if (subjectIds.length > 0) {
        const { data: subjectsData } = await supabase
          .from('subjects')
          .select('*')
          .in('id', subjectIds)
          .order('name');

        if (subjectsData) setSubjects(subjectsData);
      }

      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .order('name');

      if (classesData) setClasses(classesData);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch = subject.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = !filterLevel || subject.education_level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
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

  const groupedSubjects = filteredSubjects.reduce((acc, subject) => {
    const level = subject.education_level;
    if (!acc[level]) acc[level] = [];
    acc[level].push(subject);
    return acc;
  }, {} as Record<string, Subject[]>);

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading subjects...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Subjects</h1>
          <p className="text-gray-600 mt-1">View subjects for your assigned classes</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Levels</option>
                <option value="Pre-Primary">Pre-Primary</option>
                <option value="Primary">Primary</option>
                <option value="JSS">JSS</option>
                <option value="SSS">SSS</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {Object.keys(groupedSubjects).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No subjects found</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedSubjects).map(([level, levelSubjects]) => (
            <Card key={level}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={getLevelColor(level)}>{level}</Badge>
                  <span className="text-sm font-normal text-gray-600">
                    ({levelSubjects.length} subjects)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {levelSubjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-orange-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{subject.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {subject.department && (
                              <Badge variant="outline" className="text-xs">
                                {subject.department}
                              </Badge>
                            )}
                            {subject.religion && (
                              <Badge variant="outline" className="text-xs">
                                {subject.religion}
                              </Badge>
                            )}
                            {subject.is_optional && (
                              <Badge variant="secondary" className="text-xs">
                                Optional
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
