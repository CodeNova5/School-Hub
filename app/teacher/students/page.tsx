"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Session, Term, Class } from '@/lib/types';
import { StudentTable } from '@/components/student-table';
import { StudentDetailsModal } from '@/components/student-details-modal';
import { Search, Download, Users, UserCheck, UserX, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/student-utils';
import { getCurrentUser, getTeacherByUserId } from '@/lib/auth';
import { useSchoolContext } from '@/hooks/use-school-context';

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubjectsModalOpen, setIsSubjectsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { schoolId, isLoading: schoolLoading } = useSchoolContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const handleNextStudent = useCallback(() => {
    if (!selectedStudent) return;
    const currentIndex = filteredStudents.findIndex((s) => s.id === selectedStudent.id);
    const nextIndex = (currentIndex + 1) % filteredStudents.length;
    setSelectedStudent(filteredStudents[nextIndex]);
  }, [filteredStudents, selectedStudent]);

  const handlePreviousStudent = useCallback(() => {
    if (!selectedStudent) return;
    const currentIndex = filteredStudents.findIndex((s) => s.id === selectedStudent.id);
    const previousIndex = (currentIndex - 1 + filteredStudents.length) % filteredStudents.length;
    setSelectedStudent(filteredStudents[previousIndex]);
  }, [filteredStudents, selectedStudent]);

  useEffect(() => {
    loadData();
  }, [schoolId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isModalOpen) return;

      if (event.key === 'ArrowRight') {
        handleNextStudent();
      } else if (event.key === 'ArrowLeft') {
        handlePreviousStudent();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, handleNextStudent, handlePreviousStudent]);

  const applyFilters = useCallback(() => {
    let filtered = [...students];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.first_name.toLowerCase().includes(term) ||
          s.last_name.toLowerCase().includes(term) ||
          s.student_id.toLowerCase().includes(term) ||
          s.email.toLowerCase().includes(term)
      );
    }

    if (filterClass) {
      filtered = filtered.filter((s) => s.class_id === filterClass);
    }

    if (filterDepartment) {
      filtered = filtered.filter((s) => s.department === filterDepartment);
    }

    if (filterGender) {
      filtered = filtered.filter((s) => s.gender === filterGender);
    }

    if (filterStatus) {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    setFilteredStudents(filtered);
  }, [students, searchTerm, filterClass, filterDepartment, filterGender, filterStatus]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

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

      // Get subject_classes where this teacher is assigned
      const { data: subjectClasses, error: scErr } = await supabase
        .from("subject_classes")
        .select("id, class_id")
        .eq("teacher_id", teacher.id)
        .eq("school_id", schoolId);

      if (!subjectClasses || subjectClasses.length === 0) {
        toast.error("No subjects assigned to you");
        setIsLoading(false);
        return;
      }

      const subjectClassIds = subjectClasses.map((sc: any) => sc.id);
      const classIds = Array.from(new Set(subjectClasses.map((sc: any) => sc.class_id))) as string[];
      setTeacherClasses(classIds);

      // Get students who are taking the teacher's subjects
      const { data: studentSubjects, error: ssErr } = await supabase
        .from("student_subjects")
        .select("student_id")
        .in("subject_class_id", subjectClassIds)
        .eq("school_id", schoolId);

      if (!studentSubjects || studentSubjects.length === 0) {
        toast.error("No students enrolled in your subjects");
        setIsLoading(false);
        return;
      }

      let studentIds = Array.from(new Set(studentSubjects.map((ss: any) => ss.student_id)));

      const [studentsRes, sessionsRes, termsRes, classesRes] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .in('id', studentIds)
          .eq('school_id', schoolId)
          .order('first_name'),
        supabase.from('sessions').select('*').eq('school_id', schoolId).order('name', { ascending: false }),
        supabase.from('terms').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('name'),
      ]);
      if (studentsRes.data) setStudents(studentsRes.data);

      const studentList = studentsRes.data || [];
      studentIds = studentList.map((s: any) => s.id).filter(Boolean);

      let attendance: any[] = [];
      if (studentIds.length > 0) {
        const { data, error } = await supabase
          .from("attendance")
          .select("*")
          .in("student_id", studentIds)
          .eq("school_id", schoolId);

        if (error) throw error;
        attendance = data;
      }

      const studentsWithAttendance = studentList.map((student: any) => {
        const records = attendance.filter(a => a.student_id === student.id) || [];
        const total = records.length;
        const present = records.filter(
          r => r.status === "present" || r.status === "late" || r.status === "excused"
        ).length;

        return {
          ...student,
          average_attendance: total === 0 ? 0 : Math.round((present / total) * 100),
          total_attendance: total,
        };
      });

      setStudents(studentsWithAttendance);

      if (sessionsRes.data) setSessions(sessionsRes.data);
      if (termsRes.data) setTerms(termsRes.data);
      if (classesRes.data) setClasses(classesRes.data);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleViewDetails(student: Student) {
    setSelectedStudent(student);
    setIsModalOpen(true);
  }
  function handleExport() {
    const exportData = filteredStudents.map((s) => ({
      'Student ID': s.student_id,
      'First Name': s.first_name,
      'Last Name': s.last_name,
      Email: s.email,
      Phone: s.phone,
      Gender: s.gender,
      Department: s.department || 'N/A',
      'Parent Name': s.parent_name,
      'Parent Email': s.parent_email,
      'Parent Phone': s.parent_phone,
      'Average Attendance': s.average_attendance + '%',
      Status: s.status,
    }));

    exportToCSV(exportData, `students_export_${new Date().toISOString().split('T')[0]}`);
    toast.success('Students exported successfully');
  }

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === 'active').length;
  const suspendedStudents = students.filter((s) => s.status === 'suspended').length;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const newThisMonth = students.filter(
    (s) => new Date(s.admission_date) >= thisMonth
  ).length;

  const uniqueDepartments = Array.from(new Set(students.map((s) => s.department).filter(Boolean)));

  if (schoolLoading || isLoading) {
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
      <div className="space-y-6 overflow-x-hidden">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Students</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              View all students offering subjects assigned to you
            </p>
          </div>

          <div className="w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExport}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">

          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Total Students
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {totalStudents}
                  </p>
                </div>
                <Users className="h-5 w-5 text-gray-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Active Students
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-green-600">
                    {activeStudents}
                  </p>
                </div>
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Suspended
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-red-600">
                    {suspendedStudents}
                  </p>
                </div>
                <UserX className="h-5 w-5 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    New This Month
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">
                    {newThisMonth}
                  </p>
                </div>
                <CalendarIcon className="h-5 w-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Search & Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">
              Search & Filters
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">

              {/* Search */}
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>

              {/* Class Filter */}
              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Classes</option>
                {classes
                  .filter((c) => teacherClasses.includes(c.id))
                  .map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
              </select>

              {/* Department */}
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Gender */}
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>

              {/* Status */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </select>

            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-base sm:text-lg">
              Students List
            </CardTitle>
            <p className="text-xs sm:text-sm text-gray-600">
              Showing {filteredStudents.length} of {totalStudents} students
            </p>
          </CardHeader>

          <CardContent>
            <StudentTable
              students={filteredStudents}
              onViewDetails={handleViewDetails}
            />
          </CardContent>
        </Card>

        <StudentDetailsModal
          student={selectedStudent}
          sessions={sessions}
          terms={terms}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />

      </div>
    </DashboardLayout>
  );
}