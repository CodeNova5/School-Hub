"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Student, Session, Term, Class, Department } from '@/lib/types';
import { StudentTable } from '@/components/student-table';
import { StudentDetailsModal } from '@/components/student-details-modal';
import { EditStudentModal } from '@/components/edit-student-modal';
import {
  Search, Download, Users, UserCheck, UserX,
  Calendar as CalendarIcon, Plus, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/student-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { StudentsSkeleton } from '@/components/skeletons';

// ─── Styled field primitives ──────────────────────────────────────────────────
function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
      {children}
      {required && <span className="ml-1 text-rose-400">*</span>}
    </label>
  );
}

function StyledInput(props: React.ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={
        'h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 ' +
        'shadow-sm ring-0 transition-all ' +
        'focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:outline-none ' +
        (props.className ?? '')
      }
    />
  );
}

function StyledSelect(props: React.ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={
        'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 ' +
        'shadow-sm outline-none transition-all appearance-none ' +
        'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 ' +
        (props.className ?? '')
      }
    />
  );
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}>{children}</div>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  title, value, icon: Icon, color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${color}`}>{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${color.replace('text-', 'bg-').replace('-600', '-50').replace('-700', '-50')}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function AdminStudentsPage() {
  const { schoolId, isLoading: schoolLoading, error: schoolError } = useSchoolContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [religions, setReligions] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditStudentOpen, setIsEditStudentOpen] = useState(false);
  const [isTransferStudentOpen, setIsTransferStudentOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [transferTargetClassId, setTransferTargetClassId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const router = useRouter();

  // ── navigation ──────────────────────────────────────────────────────────────
  const handleNextStudent = useCallback(() => {
    if (!selectedStudent) return;
    const i = filteredStudents.findIndex((s) => s.id === selectedStudent.id);
    setSelectedStudent(filteredStudents[(i + 1) % filteredStudents.length]);
  }, [filteredStudents, selectedStudent]);

  const handlePreviousStudent = useCallback(() => {
    if (!selectedStudent) return;
    const i = filteredStudents.findIndex((s) => s.id === selectedStudent.id);
    setSelectedStudent(filteredStudents[(i - 1 + filteredStudents.length) % filteredStudents.length]);
  }, [filteredStudents, selectedStudent]);

  useEffect(() => { if (schoolId) loadData(); }, [schoolId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!isModalOpen) return;
      if (e.key === 'ArrowRight') handleNextStudent();
      if (e.key === 'ArrowLeft') handlePreviousStudent();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [isModalOpen, handleNextStudent, handlePreviousStudent]);

  const applyFilters = useCallback(() => {
    let f = [...students];
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      f = f.filter((s) =>
        s.first_name.toLowerCase().includes(t) ||
        s.last_name.toLowerCase().includes(t) ||
        s.student_id.toLowerCase().includes(t) ||
        s.email.toLowerCase().includes(t)
      );
    }
    if (filterClass) f = f.filter((s) => s.class_id === filterClass);
    if (filterDepartment) f = f.filter((s) => s.department_id === filterDepartment);
    if (filterGender) f = f.filter((s) => s.gender === filterGender);
    if (filterStatus) f = f.filter((s) => s.status === filterStatus);
    setFilteredStudents(f);
  }, [students, searchTerm, filterClass, filterDepartment, filterGender, filterStatus]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  // ── data loading ─────────────────────────────────────────────────────────────
  async function loadData() {
    setIsLoading(true);
    try {
      if (!schoolId) throw new Error('School ID not available');
      const [
        { data: studentList, error: studentsError },
        { data: sessionsList, error: sessionsError },
        { data: termsList, error: termsError },
        { data: classList, error: classesError },
        { data: departmentsList, error: departmentsError },
        { data: religionsList, error: religionsError },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('first_name', { ascending: true }),
        supabase.from('sessions').select('*').eq('school_id', schoolId).order('name', { ascending: false }),
        supabase.from('terms').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('name', { ascending: true }),
        supabase.from('school_departments').select('*').eq('school_id', schoolId).eq('is_active', true).order('name', { ascending: true }),
        supabase.from('school_religions').select('*').eq('school_id', schoolId).eq('is_active', true).order('name', { ascending: true }),
      ]);
      if (studentsError || sessionsError || termsError || classesError || departmentsError || religionsError) {
        throw new Error(studentsError?.message || sessionsError?.message || termsError?.message || classesError?.message || departmentsError?.message || religionsError?.message || 'Unknown error');
      }
      const departmentMap = new Map((departmentsList || []).map((d: Department) => [d.id, d.name]));
      const studentIds = (studentList || []).map((s: Student) => s.id).filter(Boolean);
      let attendance: any[] = [];
      if (studentIds.length > 0) {
        const { data: attendanceRes, error: attendanceError } = await supabase.from('attendance').select('*').eq('school_id', schoolId).in('student_id', studentIds);
        if (attendanceError) throw attendanceError;
        attendance = attendanceRes || [];
      }
      const studentsWithAttendance = (studentList || []).map((student: Student) => {
        const records = attendance.filter((a: any) => a.student_id === student.id);
        const total = records.length;
        const present = records.filter((r: any) => r.status === 'present' || r.status === 'late' || r.status === 'excused').length;
        return {
          ...student,
          department: student.department || departmentMap.get(student.department_id) || undefined,
          average_attendance: total === 0 ? 0 : Math.round((present / total) * 100),
          total_attendance: total,
        };
      });
      setStudents(studentsWithAttendance);
      setSessions(sessionsList || []);
      setTerms(termsList || []);
      setClasses(classList || []);
      setDepartments(departmentsList || []);
      setReligions(religionsList || []);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleViewDetails(student: Student) {
    try {
      const { data: attendance, error } = await supabase.from('attendance').select('*').eq('school_id', schoolId).eq('student_id', student.id);
      if (error) throw error;
      const total = attendance?.length || 0;
      const present = attendance?.filter((r: any) => r.status === 'present' || r.status === 'late' || r.status === 'excused').length || 0;
      setSelectedStudent({ ...student, average_attendance: total === 0 ? 0 : Math.round((present / total) * 100), total_attendance: total } as Student);
    } catch {
      setSelectedStudent(student);
    }
    setIsModalOpen(true);
  }

  function handleManageSubjects(student: Student) { router.push(`/admin/students/${student.id}/subjects`); }

  function handleEditStudent(student: Student) { setSelectedStudent(student); setIsEditStudentOpen(true); }
  function handleTransferStudent(student: Student) { setSelectedStudent(student); setIsTransferStudentOpen(true); }

  async function handleTransferStudentToClass(targetClassId: string) {
    if (!selectedStudent || !targetClassId) { toast.error('Please select a valid student and class'); return; }
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transfer-students', studentIds: [selectedStudent.id], targetClassId }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to transfer student'); return; }
      toast.success(`Transferred ${selectedStudent.first_name} ${selectedStudent.last_name}`);
      setStudents(students.map((s) => s.id === selectedStudent.id ? { ...s, class_id: targetClassId } : s));
      setIsTransferStudentOpen(false);
      setTransferTargetClassId('');
      setSelectedStudent(null);
    } catch (e: any) { toast.error('Failed to transfer student: ' + e.message); }
  }

  async function handleRemoveStudent(student: Student) {
    if (!student) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-student', studentId: student.id, userId: student.user_id }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to delete student'); return; }
      toast.success('Student deleted.');
      setStudents(students.filter((s) => s.id !== student.id));
    } catch (e: any) { toast.error('Failed to delete student: ' + e.message); }
    finally { setIsDeleting(false); }
  }

  function handleDeleteStudent(student: Student) { setStudentToDelete(student); setIsDeleteDialogOpen(true); }

  async function handleDeleteStudentCompletely() {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-student', studentId: studentToDelete.id, userId: studentToDelete.user_id }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to delete student'); return; }
      toast.success('Student permanently deleted.');
      setIsDeleteDialogOpen(false);
      setStudents(students.filter((s) => s.id !== studentToDelete.id));
      setStudentToDelete(null);
    } catch (e: any) { toast.error('Failed to delete student: ' + e.message); }
    finally { setIsDeleting(false); }
  }

  function handleEditStudentSuccess(updatedStudent: Student) {
    setStudents(students.map((s) => s.id === updatedStudent.id ? updatedStudent : s));
  }

  function handleExport() {
    const data = filteredStudents.map((s) => ({
      'Student ID': s.student_id, 'First Name': s.first_name, 'Last Name': s.last_name,
      Email: s.email, Phone: s.phone, Gender: s.gender,
      Department: s.department || 'N/A', 'Parent Name': s.parent_name,
      'Parent Email': s.parent_email, 'Parent Phone': s.parent_phone,
      'Average Attendance': s.average_attendance + '%', Status: s.status,
    }));
    exportToCSV(data, `students_export_${new Date().toISOString().split('T')[0]}`);
    toast.success('Students exported successfully');
  }

  const totalStudents = students.length;
  const activeStudents = students.filter((s) => s.status === 'active').length;
  const suspendedStudents = students.filter((s) => s.status === 'suspended').length;
  const currentTermStartDate = terms.find((t) => t.is_current)?.start_date ? new Date(terms.find((t) => t.is_current)!.start_date) : null;
  const newThisTerm = currentTermStartDate ? students.filter((s) => new Date(s.admission_date) >= currentTermStartDate!).length : 0;
  const uniqueDepartments = departments;

  if (schoolLoading || isLoading) return <DashboardLayout role="admin"><StudentsSkeleton /></DashboardLayout>;

  if (schoolError || !schoolId) return (
    <DashboardLayout role="admin">
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 font-semibold">{schoolError || 'Unable to determine your school'}</p>
          <p className="text-slate-500 text-sm mt-2">Please contact your administrator or try logging in again.</p>
        </div>
      </div>
    </DashboardLayout>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Students</h1>
            <p className="text-sm text-slate-500 mt-0.5">Manage all students in the system</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/students/new')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/25 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Student
            </button>

            <Button variant="outline" onClick={handleExport} className="rounded-xl">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Students" value={totalStudents} icon={Users} color="text-slate-700" />
          <StatCard title="Active" value={activeStudents} icon={UserCheck} color="text-emerald-600" />
          <StatCard title="Suspended" value={suspendedStudents} icon={UserX} color="text-rose-600" />
          <StatCard title="New This Term" value={newThisTerm} icon={CalendarIcon} color="text-indigo-600" />
        </div>

        {/* ── Search & filters ── */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Search & Filters</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-1 sm:col-span-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search students…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 rounded-xl border-slate-200 pl-10 text-sm shadow-sm focus-visible:ring-indigo-300"
              />
            </div>
            {[
              { value: filterClass, setter: setFilterClass, placeholder: 'All Classes', options: classes.map((c) => ({ id: c.id, name: c.name })) },
              { value: filterDepartment, setter: setFilterDepartment, placeholder: 'All Departments', options: uniqueDepartments.map((d) => ({ id: d.id, name: d.name })) },
            ].map(({ value, setter, placeholder, options }, i) => (
              <select key={i} value={value} onChange={(e) => setter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
                <option value="">{placeholder}</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ))}
            <select value={filterGender} onChange={(e) => setFilterGender(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="others">Others</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="graduated">Graduated</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>

        {/* ── Students table ── */}
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Students List</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Showing {filteredStudents.length} of {totalStudents} students</p>
            </div>
          </div>
          <div className="px-2 pb-2">
            <StudentTable
              students={filteredStudents}
              onViewDetails={handleViewDetails}
              onEditStudent={handleEditStudent}
              onManageSubjects={handleManageSubjects}
              onTransferStudent={handleTransferStudent}
              onRemoveStudent={handleRemoveStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          </div>
        </div>

        {/* ── Modals ── */}
        <StudentDetailsModal student={selectedStudent} sessions={sessions} terms={terms} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
        <EditStudentModal student={selectedStudent} isOpen={isEditStudentOpen}
          onClose={() => { setIsEditStudentOpen(false); setSelectedStudent(null); }}
          onSuccess={handleEditStudentSuccess}
        />

        {/* ── Transfer dialog ── */}
        <Dialog open={isTransferStudentOpen} onOpenChange={setIsTransferStudentOpen}>
          <DialogContent className="rounded-2xl border-0 shadow-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">Transfer Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-slate-500">
                Move <span className="font-semibold text-slate-800">{selectedStudent?.first_name} {selectedStudent?.last_name}</span> to a new class:
              </p>
              <StyledSelect value={transferTargetClassId} onChange={(e) => setTransferTargetClassId(e.target.value)}>
                <option value="">Select target class</option>
                {classes.filter((c) => c.id !== selectedStudent?.class_id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </StyledSelect>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => { setIsTransferStudentOpen(false); setTransferTargetClassId(''); }} className="rounded-xl">Cancel</Button>
                <Button onClick={() => handleTransferStudentToClass(transferTargetClassId)} disabled={!transferTargetClassId} className="rounded-xl bg-slate-950 text-white hover:bg-slate-800">Transfer</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Delete dialog ── */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="rounded-2xl border-0 shadow-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                Permanently Delete Student
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <p className="text-sm font-semibold text-rose-700">
                This will permanently delete <strong>{studentToDelete?.first_name} {studentToDelete?.last_name}</strong> and all associated data:
              </p>
              <ul className="space-y-1.5 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">
                {['Student record', 'Attendance, results, class assignments', 'Session / term links', 'Auth user account (cannot be undone)'].map((item) => (
                  <li key={item} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-rose-400 shrink-0" />{item}</li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">This action cannot be undone. Are you sure?</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} className="rounded-xl">Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteStudentCompletely} disabled={isDeleting} className="rounded-xl">
                  {isDeleting ? 'Deleting…' : 'Delete Permanently'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}