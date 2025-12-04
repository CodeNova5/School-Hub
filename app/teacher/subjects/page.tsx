"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject, Class, Teacher } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Users, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';

interface SubjectWithClasses extends Subject {
  applicableClasses: Class[];
}

export default function TeacherSubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectWithClasses[]>([]);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterOptional, setFilterOptional] = useState('');
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

      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .order('level');

      if (classesData) {
        setMyClasses(classesData);

        const uniqueLevelCategories = Array.from(new Set(classesData.map((c) => c.education_level)));

        let subjectsQuery = supabase
          .from('subjects')
          .select('*')
          .in('education_level', uniqueLevelCategories);

        const sssClasses = classesData.filter((c) => c.education_level === 'SSS');
        if (sssClasses.length > 0) {
          const departments = Array.from(new Set(sssClasses.map((c) => c.department).filter(Boolean)));
          if (departments.length > 0) {
            subjectsQuery = subjectsQuery.or(
              `education_level.neq.SSS,and(education_level.eq.SSS,department.in.(${departments.join(',')}))`
            );
          }
        }

        const { data: subjectsData } = await subjectsQuery.order('education_level').order('name');

        if (subjectsData) {
          const subjectsWithClasses = subjectsData.map((subject) => {
            let applicableClasses: Class[] = [];

            if (subject.education_level === 'SSS') {
              applicableClasses = classesData.filter(
                (c) => c.education_level === 'SSS' && c.department === subject.department
              );
            } else {
              applicableClasses = classesData.filter((c) => c.education_level === subject.education_level);
            }

            return {
              ...subject,
              applicableClasses,
            };
          });

          setSubjects(subjectsWithClasses);
        }
      }

      const { data: teachersData } = await supabase
        .from('teachers')
        .select('*')
        .eq('status', 'active');
      if (teachersData) setTeachers(teachersData);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredSubjects = subjects.filter((subject) => {
    const matchesSearch =
      subject.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDepartment =
      !filterDepartment ||
      subject.department === filterDepartment;

    const matchesOptional =
      !filterOptional ||
      (filterOptional === 'optional' && subject.is_optional) ||
      (filterOptional === 'mandatory' && !subject.is_optional);

    return matchesSearch && matchesDepartment && matchesOptional;
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
    let groupKey: string = subject.education_level;
    if (subject.education_level === 'SSS' && subject.department) {
      groupKey = `SSS - ${subject.department}`;
    }
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(subject);
    return acc;
  }, {} as Record<string, SubjectWithClasses[]>);

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
          <h1 className="text-3xl font-bold">My Subjects</h1>
          <p className="text-gray-600 mt-1">
            Subjects for your assigned classes ({myClasses.length} classes)
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {myClasses.map((cls) => (
                <Badge key={cls.id} variant="outline" className="text-sm">
                  {cls.name} - {cls.level}
                  {cls.department && ` (${cls.department})`}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search subjects..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Department Filter */}
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Departments</option>
                <option value="Science">Science</option>
                <option value="Commercial">Commercial</option>
                <option value="Art">Art</option>
              </select>

              {/* Optional/Mandatory Filter */}
              <select
                value={filterOptional}
                onChange={(e) => setFilterOptional(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Subjects</option>
                <option value="optional">Optional Only</option>
                <option value="mandatory">Mandatory Only</option>
              </select>

            </div>
          </CardContent>
        </Card>


        {Object.keys(groupedSubjects).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No subjects found</p>
              <p className="text-sm text-gray-400 mt-2">
                Subjects will appear here once the admin assigns them to your education levels
              </p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedSubjects).map(([level, levelSubjects]) => (
            <Card key={level}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={getLevelColor(levelSubjects[0].education_level)}>
                    {level}
                  </Badge>
                  <span className="text-sm font-normal text-gray-600">
                    ({levelSubjects.length} subjects)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {levelSubjects.map((subject) => {
                    const teacher = teachers.find((t) => t.id === subject.teacher_id);
                    return (
                      <Card key={subject.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="h-5 w-5 text-orange-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base mb-2 break-words">
                                {subject.name}
                              </h3>
                              <div className="flex flex-wrap gap-1 mb-2">
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

                          {teacher && (
                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-3 p-2 bg-gray-50 rounded">
                              <UserIcon className="h-3 w-3 flex-shrink-0" />
                              <div>
                                <p className="font-medium">Subject Teacher</p>
                                <p className="truncate">
                                  {teacher.first_name} {teacher.last_name}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="border-t pt-3">
                            <a
                              href={`/teacher/subjects/${subject.id}/analytics`}
                              className="text-blue-600 text-sm font-medium hover:underline mt-3 inline-block"
                            >
                              View Analytics →
                            </a>

                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
