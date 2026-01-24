"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Class } from '@/lib/types';
import { Search, Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface StudentWithClass extends Student {
  class_name?: string;
  class_level?: string;
  subjects_taught?: string[];
}

interface TeacherSubject {
  id: string;
  subject_name: string;
  class_name: string;
  class_id: string;
}

export default function TeacherResultsPage() {
  const [students, setStudents] = useState<StudentWithClass[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentWithClass[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<TeacherSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [students, searchTerm, filterClass, filterSubject]);

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

      // Get subjects assigned to this teacher
      const { data: subjectAssignments } = await supabase
        .from('subject_classes')
        .select(`
          id,
          class_id,
          subjects (
            id,
            name
          ),
          classes (
            id,
            name,
            level
          )
        `)
        .eq('teacher_id', teacher.id);

      if (!subjectAssignments || subjectAssignments.length === 0) {
        toast.error('No subjects assigned to you');
        setIsLoading(false);
        return;
      }

      // Extract teacher subjects and class IDs
      const teacherSubjectsData: TeacherSubject[] = subjectAssignments.map((sa: any) => ({
        id: sa.id,
        subject_name: sa.subjects?.name || 'Unknown Subject',
        class_name: sa.classes?.name || 'Unknown Class',
        class_id: sa.class_id
      }));

      setTeacherSubjects(teacherSubjectsData);

      const classIds = Array.from(new Set(subjectAssignments.map((sa: any) => sa.class_id)));

      // Get students from classes where teacher teaches subjects
      const { data: studentsData } = await supabase
        .from('students')
        .select(`
          *,
          classes (
            id,
            name,
            level
          )
        `)
        .in('class_id', classIds)
        .eq('status', 'active')
        .order('first_name');

      // Get all classes for filtering
      const { data: classesData } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .order('name');

      if (studentsData) {
        // Add subjects taught to each student based on their class
        const enrichedStudents: StudentWithClass[] = studentsData.map((student: any) => {
          const subjectsForThisClass = teacherSubjectsData
            .filter(ts => ts.class_id === student.class_id)
            .map(ts => ts.subject_name);

          return {
            ...student,
            class_name: student.classes?.name,
            class_level: student.classes?.level,
            subjects_taught: subjectsForThisClass
          };
        });

        setStudents(enrichedStudents);
      }

      if (classesData) setClasses(classesData);

    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function applyFilters() {
    let filtered = [...students];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.first_name.toLowerCase().includes(term) ||
          s.last_name.toLowerCase().includes(term) ||
          s.student_id.toLowerCase().includes(term)
      );
    }

    if (filterClass) {
      filtered = filtered.filter((s) => s.class_id === filterClass);
    }

    if (filterSubject) {
      filtered = filtered.filter((s) => 
        s.subjects_taught?.includes(filterSubject)
      );
    }

    setFilteredStudents(filtered);
  }

  function handleAddResults(student: Student) {
    router.push(`/teacher/results/entry?studentId=${student.id}`);
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <DashboardLayout role="teacher">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading students...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="teacher">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Student Results</h1>
          <p className="text-gray-600 mt-1">
            Add and manage results for students taking your subjects
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - {cls.level}
                  </option>
                ))}
              </select>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Subjects</option>
                {Array.from(new Set(teacherSubjects.map(ts => ts.subject_name))).map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Students</CardTitle>
            <p className="text-sm text-gray-600">
              Showing {filteredStudents.length} of {students.length} students
            </p>
          </CardHeader>
          <CardContent>
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No students found</p>
                <p className="text-sm mt-2">
                  {students.length === 0 
                    ? "No students are taking your subjects"
                    : "Try adjusting your search or filters"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredStudents.map((student) => {
                  return (
                    <Card key={student.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-16 w-16">
                            <AvatarImage src={student.photo_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-lg">
                              {getInitials(student.first_name, student.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg mb-1">
                              {student.first_name} {student.last_name}
                            </h3>
                            <p className="text-sm text-gray-600 font-mono mb-2">
                              {student.student_id}
                            </p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {student.class_name} - {student.class_level}
                              </Badge>
                              {student.gender && (
                                <Badge variant="secondary" className="text-xs">
                                  {student.gender}
                                </Badge>
                              )}
                            </div>
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-1">Your subjects:</p>
                              <div className="flex flex-wrap gap-1">
                                {student.subjects_taught?.slice(0, 2).map((subject, idx) => (
                                  <Badge key={idx} variant="default" className="text-xs">
                                    {subject}
                                  </Badge>
                                ))}
                                {(student.subjects_taught?.length || 0) > 2 && (
                                  <Badge variant="default" className="text-xs">
                                    +{(student.subjects_taught?.length || 0) - 2} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => handleAddResults(student)}
                              className="w-full"
                              size="sm"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Results
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
