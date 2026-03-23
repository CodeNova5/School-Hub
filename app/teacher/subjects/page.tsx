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
import { useSchoolContext } from '@/hooks/use-school-context';

interface SubjectWithClasses extends Omit<Subject, 'education_level' | 'department' | 'religion'> {
  applicableClasses: Class[];
  classId?: string; // Add classId for grouping by class
  className?: string;
  subjectClassId?: string; // Add subject_classes.id for unique analytics link
  teacher_id?: string; // Add teacher_id from subject_classes
  // Override the Subject interface properties to allow strings
  education_level?: string;
  department?: string | null;
  religion?: string | null;
}

export default function TeacherSubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectWithClasses[]>([]);
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterOptional, setFilterOptional] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  useEffect(() => {
    if (schoolId) {
      loadSchoolConfig();
      loadData();
    }
  }, [schoolId]);

  async function loadSchoolConfig() {
    if (!schoolId) return;
    try {
      const { data: deptResult } = await supabase
        .from('school_departments')
        .select('name')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (deptResult) {
        setDepartments(deptResult.map((d: { name: string }) => d.name));
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }

  async function loadData() {
    if (!schoolId) return;
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

      // Fetch departments and religions for mapping
      const [deptResult, religionResult, levelResult] = await Promise.all([
        supabase
          .from('school_departments')
          .select('id, name')
          .eq('school_id', schoolId),
        supabase
          .from('school_religions')
          .select('id, name')
          .eq('school_id', schoolId),
        supabase
          .from('school_class_levels')
          .select('id, name')
          .eq('school_id', schoolId),
      ]);

      const deptMap = new Map((deptResult.data || []).map((d: any) => [d.id, d.name]));
      const religionMap = new Map((religionResult.data || []).map((r: any) => [r.id, r.name]));
      const levelMap = new Map((levelResult.data || []).map((l: any) => [l.id, l.name]));

      // Fetch all subject_classes for this teacher with subject and class details
      const { data: subjectClassesData } = await supabase
        .from('subject_classes')
        .select(`
          id,
          subject_id,
          class_id,
          teacher_id,
          subjects!subject_classes_subject_id_fkey(id, name, education_level_id, department_id, religion_id, is_optional),
          classes(id, name, class_level_id, department_id)
        `)
        .eq('teacher_id', teacher.id)
        .eq('school_id', schoolId);

      if (!subjectClassesData || subjectClassesData.length === 0) {
        toast.error('No subjects assigned to you');
        setIsLoading(false);
        return;
      }

      // Extract unique classes
      const uniqueClasses = new Map();
      subjectClassesData.forEach((item: any) => {
        if (item.classes) {
          const classLevel = levelMap.get(item.classes.class_level_id);
          uniqueClasses.set(item.classes.id, {
            ...item.classes,
            level: classLevel || 'Unknown'
          });
        }
      });

      const classesData = Array.from(uniqueClasses.values());
      setMyClasses(classesData);

      // Create subject entries for each class assignment
      const subjectsList: SubjectWithClasses[] = [];
      
      subjectClassesData.forEach((item: any) => {
        if (item.subjects && item.classes) {
          const classLevel = levelMap.get(item.classes.class_level_id);
          const department = deptMap.get(item.subjects.department_id);
          const religion = religionMap.get(item.subjects.religion_id);

          subjectsList.push({
            ...item.subjects,
            teacher_id: item.teacher_id,
            classId: item.classes.id,
            className: item.classes.name,
            subjectClassId: item.id,
            education_level: classLevel || 'Unknown',
            department: department || null,
            religion: religion || null,
            applicableClasses: [item.classes]
          });
        }
      });

      setSubjects(subjectsList);

      const { data: teachersData } = await supabase
        .from('teachers')
        .select('*')
        .eq('status', 'active')
        .eq('school_id', schoolId);
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
    const groupKey = subject.className || 'Unknown Class';
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(subject);
    return acc;
  }, {} as Record<string, SubjectWithClasses[]>);

  if (schoolLoading || isLoading) {
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
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
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
          Object.entries(groupedSubjects).map(([className, classSubjects]) => (
            <Card key={className}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={getLevelColor(classSubjects[0].education_level || '')}>
                    {className}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {classSubjects[0].education_level || 'Unknown'}
                  </span>
                  <span className="text-sm font-normal text-gray-600">
                    ({classSubjects.length} subject{classSubjects.length !== 1 ? 's' : ''})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {classSubjects.map((subject) => {
                    const teacher = teachers.find((t) => t.id === subject.teacher_id);
                    return (
                      <Card key={`${subject.id}-${subject.classId}`} className="hover:shadow-lg transition-shadow">
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

                          <div className="border-t pt-3">
                            <a
                              href={`/teacher/subjects/${subject.subjectClassId}/analytics`}
                              className="text-blue-600 text-sm font-medium hover:underline mt-3 inline-block text-decoration-none"
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