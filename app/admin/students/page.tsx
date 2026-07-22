"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Student, Term, Class, Department } from '@/lib/types';
import { StudentTable } from '@/components/student-table';
import { StudentLimitBanner } from '@/components/student-limit-banner';
import {
  Search, Download, Users, UserCheck, UserX,
  Calendar as CalendarIcon, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/student-utils';
import { getCurrentDateStringWAT } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { StudentsSkeleton } from '@/components/skeletons';

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
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const router = useRouter();

  useEffect(() => { if (schoolId) loadData(); }, [schoolId]);

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
        { data: termsList, error: termsError },
        { data: classList, error: classesError },
        { data: departmentsList, error: departmentsError },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('first_name', { ascending: true }),
        supabase.from('terms').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('name', { ascending: true }),
        supabase.from('school_departments').select('*').eq('school_id', schoolId).eq('is_active', true).order('name', { ascending: true }),
      ]);
      if (studentsError || termsError || classesError || departmentsError) {
        throw new Error(studentsError?.message || termsError?.message || classesError?.message || departmentsError?.message || 'Unknown error');
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
      setTerms(termsList || []);
      setClasses(classList || []);
      setDepartments(departmentsList || []);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleExport() {
    const data = filteredStudents.map((s) => ({
      'Student ID': s.student_id, 'First Name': s.first_name, 'Last Name': s.last_name,
      Email: s.email, Phone: s.phone, Gender: s.gender,
      Department: s.department || 'N/A', 'Parent Name': s.parent_name,
      'Parent Email': s.parent_email, 'Parent Phone': s.parent_phone,
      'Average Attendance': s.average_attendance + '%', Status: s.status,
    }));
    exportToCSV(data, `students_export_${getCurrentDateStringWAT()}`);
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

        <StudentLimitBanner />

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
            />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}