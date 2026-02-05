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
import { Search, Download, Users, UserCheck, UserX, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/student-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubjectsModalOpen, setIsSubjectsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form fields for creating student
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    class_id: '',
    department: '',
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    admission_date: new Date().toISOString().split('T')[0],
  });

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
  }, []);

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
    setIsLoading(true);
    try {
      // Use Supabase client instead of API
      const [{ data: studentList, error: studentsError }, { data: sessionsList, error: sessionsError }, { data: termsList, error: termsError }, { data: classList, error: classesError }] = await Promise.all([
        supabase.from('students').select('*').order('first_name', { ascending: true }),
        supabase.from('sessions').select('*').order('name', { ascending: false }),
        supabase.from('terms').select('*').order('start_date', { ascending: false }),
        supabase.from('classes').select('*').order('name', { ascending: true }),
      ]);

      if (studentsError || sessionsError || termsError || classesError) {
        throw new Error(
          studentsError?.message ||
          sessionsError?.message ||
          termsError?.message ||
          classesError?.message ||
          'Unknown error'
        );
      }

      const studentIds = (studentList || []).map((s: Student) => s.id).filter(Boolean);

      let attendance: any[] = [];
      if (studentIds.length > 0) {
        const { data: attendanceRes, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .in('student_id', studentIds);

        if (attendanceError) throw attendanceError;
        attendance = attendanceRes || [];
      }

      interface AttendanceRecord {
        id: string;
        student_id: string;
        status: string;
        [key: string]: any;
      }

      interface StudentWithAttendance extends Student {
        average_attendance: number;
        total_attendance: number;
      }

      const studentsWithAttendance: StudentWithAttendance[] = (studentList || []).map((student: Student) => {
        const records: AttendanceRecord[] = attendance.filter((a: AttendanceRecord) => a.student_id === student.id) || [];
        const total: number = records.length;
        const present: number = records.filter(
          (r: AttendanceRecord) => r.status === "present" || r.status === "late" || r.status === "excused"
        ).length;

        return {
          ...student,
          average_attendance: total === 0 ? 0 : Math.round((present / total) * 100),
          total_attendance: total,
        };
      });

      setStudents(studentsWithAttendance);
      setSessions(sessionsList || []);
      setTerms(termsList || []);
      setClasses(classList || []);
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

  function handleManageSubjects(student: Student) {
    setSelectedStudent(student);
    setIsSubjectsModalOpen(true);
  }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);

    // Validation
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      toast.error('First name and last name are required');
      setIsCreating(false);
      return;
    }

    if (!formData.email.trim()) {
      toast.error('Email is required');
      setIsCreating(false);
      return;
    }

    if (!formData.parent_name.trim() || !formData.parent_email.trim()) {
      toast.error('Parent name and email are required');
      setIsCreating(false);
      return;
    }

    try {
      const creatingToast = toast.loading('Creating student...');

      const response = await fetch('/api/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to create student', { id: creatingToast });
        setIsCreating(false);
        return;
      }

      toast.success(`Student created successfully (ID: ${result.studentId}). Activation email sent.`, { id: creatingToast });

      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: '',
        class_id: '',
        department: '',
        parent_name: '',
        parent_email: '',
        parent_phone: '',
        admission_date: new Date().toISOString().split('T')[0],
      });

      setIsCreateDialogOpen(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create student');
    } finally {
      setIsCreating(false);
    }
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
  const currentTermStartDate = terms.filter(t => t.is_current).length > 0
    ? new Date(terms.find(t => t.is_current)?.start_date || '')
    : null;
  const newThisTerm = currentTermStartDate
    ? students.filter((s) => new Date(s.admission_date) >= currentTermStartDate).length
    : 0;

  const uniqueDepartments = Array.from(new Set(students.map((s) => s.department).filter(Boolean)));

  if (isLoading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Loading students...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-gray-600 mt-1">Manage all students in the system</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Student</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateStudent} className="space-y-4">
                  {/* Basic Information */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold mb-3">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="student@example.com"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          placeholder="John"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          placeholder="Doe"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+234..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="date_of_birth">Date of Birth</Label>
                        <Input
                          id="date_of_birth"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender">Gender</Label>
                        <select
                          id="gender"
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          placeholder="Street address"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Class & Academic */}
                  <div className="border-b pb-4">
                    <h3 className="font-semibold mb-3">Academic Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="class_id">Class</Label>
                        <select
                          id="class_id"
                          value={formData.class_id}
                          onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="">Select class (optional)</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="department">Department</Label>
                        <select
                          id="department"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="">Select department</option>
                          <option value="Science">Science</option>
                          <option value="Arts">Arts</option>
                          <option value="Commercial">Commercial</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="admission_date">Admission Date *</Label>
                        <Input
                          id="admission_date"
                          type="date"
                          value={formData.admission_date}
                          onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Parent/Guardian Information */}
                  <div className="pb-4">
                    <h3 className="font-semibold mb-3">Parent/Guardian Information</h3>
                    <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-900">
                        <strong>📌 Important:</strong> If this student has siblings already registered,
                        use the <strong>same parent email</strong> to link them to the existing parent account.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="parent_name">Parent/Guardian Name *</Label>
                        <Input
                          id="parent_name"
                          value={formData.parent_name}
                          onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                          placeholder="Parent name"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="parent_email">Parent Email *</Label>
                        <Input
                          id="parent_email"
                          type="email"
                          value={formData.parent_email}
                          onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                          placeholder="parent@example.com"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="parent_phone">Parent Phone</Label>
                        <Input
                          id="parent_phone"
                          value={formData.parent_phone}
                          onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                          placeholder="+234..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating ? 'Creating...' : 'Create Student'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Students</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Suspended</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{suspendedStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New This Term</CardTitle>
              <CalendarIcon className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{newThisTerm}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
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
                    {cls.name}
                  </option>
                ))}
              </select>

              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border rounded-md"
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

        <Card>
          <CardHeader>
            <CardTitle>Students List</CardTitle>
            <p className="text-sm text-gray-600">
              Showing {filteredStudents.length} of {totalStudents} students
            </p>
          </CardHeader>
          <CardContent>
            <StudentTable
              students={filteredStudents}
              onViewDetails={handleViewDetails}
              onManageSubjects={handleManageSubjects}
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
