"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Student, Session, Term, Class, Department } from '@/lib/types';
import { StudentTable } from '@/components/student-table';
import { StudentDetailsModal } from '@/components/student-details-modal';
import { EditStudentModal } from '@/components/edit-student-modal';
import {
  Search, Download, Users, UserCheck, UserX,
  Calendar as CalendarIcon, Plus, AlertTriangle,
  CheckCircle2, ChevronRight, Mail, User, GraduationCap,
  Heart, Camera, ClipboardCheck, ArrowLeft, ArrowRight,
  Shield, Sparkles, X
} from 'lucide-react';
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
import { useRouter } from 'next/navigation';
import { StudentsSkeleton } from '@/components/skeletons';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

// ─── Step icon map ────────────────────────────────────────────────────────────
const STEP_ICONS = [Mail, User, GraduationCap, Heart, Camera, ClipboardCheck];

const createSteps = [
  {
    title: 'Verify Email',
    description: 'Confirm student email address',
    detail: 'Verify the student email before they enter the portal.',
  },
  {
    title: 'Student Info',
    description: 'Basic personal details',
    detail: 'Full name, contact information and personal identifiers.',
  },
  {
    title: 'Academic',
    description: 'Class and department',
    detail: 'Assign the student to the correct academic structure.',
  },
  {
    title: 'Parent / Guardian',
    description: 'Emergency contact details',
    detail: 'Guardian information used for notifications and access.',
  },
  {
    title: 'Photo',
    description: 'Optional profile image',
    detail: 'Add a profile image to make the record immediately recognisable.',
  },
  {
    title: 'Review',
    description: 'Confirm and create',
    detail: 'Review everything before the account is provisioned.',
  },
];

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

// ─── Step sidebar item ────────────────────────────────────────────────────────
function StepItem({
  step, index, current,
}: {
  step: typeof createSteps[0];
  index: number;
  current: number;
}) {
  const Icon = STEP_ICONS[index];
  const isActive = index === current;
  const isDone = index < current;

  return (
    <div
      className={`
        flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-all duration-200
        ${isActive ? 'bg-white ring-1 ring-slate-200' : ''}
        ${isDone ? 'opacity-70' : !isActive ? 'opacity-40' : ''}
      `}
    >
      <div
        className={`
          flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all
          ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : ''}
          ${isDone ? 'bg-emerald-500 text-white' : ''}
          ${!isActive && !isDone ? 'bg-slate-200 text-slate-500' : ''}
        `}
      >
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold leading-none ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
          {step.title}
        </p>
        <p className="mt-0.5 text-[11px] leading-none text-slate-400">{step.description}</p>
      </div>
      {isActive && <ChevronRight className="ml-auto h-4 w-4 text-indigo-500 shrink-0" />}
    </div>
  );
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

// ─── Wizard progress bar ──────────────────────────────────────────────────────
function WizardProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i <= current ? 'bg-indigo-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Review row ───────────────────────────────────────────────────────────────
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-900 text-right">{value || '—'}</span>
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<'idle' | 'sending' | 'sent' | 'verified'>('idle');
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const getDefaultFormData = () => ({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: '',
    class_id: '',
    department_id: '',
    religion_id: '',
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    admission_date: new Date().toISOString().split('T')[0],
    image_url: '',
  });

  const [formData, setFormData] = useState(getDefaultFormData);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

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

  useEffect(() => {
    if (!isCreateDialogOpen && cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setIsCameraOpen(false);
    }
  }, [isCreateDialogOpen, cameraStream]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = setInterval(() => setResendCountdown((p) => Math.max(p - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [resendCountdown]);

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

  async function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    await uploadImageToGitHub(file);
  }

  async function uploadImageToGitHub(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', 'student_photo');
      fd.append('student_id', `student_${formData.first_name}_${formData.last_name}_${Date.now()}`);
      const response = await fetch('/api/upload', { method: 'POST', body: fd });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unknown error');
      setFormData((p) => ({ ...p, image_url: result.fileUrl }));
      toast.success('Image uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload image to GitHub');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCameraCapture() {
    try {
      if (!cameraStream) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        setCameraStream(stream);
        setIsCameraOpen(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } else {
        if (canvasRef.current && videoRef.current) {
          const v = videoRef.current;
          const c = canvasRef.current;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          c.getContext('2d')?.drawImage(v, 0, 0);
          c.toBlob(async (blob) => {
            if (!blob) return;
            const file = new File([blob], `student_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImagePreview(c.toDataURL());
            await uploadImageToGitHub(file);
            cameraStream.getTracks().forEach((t) => t.stop());
            setCameraStream(null);
            setIsCameraOpen(false);
          });
        }
      }
    } catch {
      toast.error('Failed to access camera');
    }
  }

  function closeCameraAndClear() {
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);
    setIsCameraOpen(false);
    setImagePreview(null);
    setFormData((p) => ({ ...p, image_url: '' }));
  }

  function resetCreateWizard() {
    setCreateStep(0);
    setEmailVerificationStatus('idle');
    setEmailVerificationCode('');
    setResendCountdown(0);
    setIsSendingCode(false);
    setIsVerifyingCode(false);
    closeCameraAndClear();
    setFormData(getDefaultFormData());
  }

  function handleCreateDialogChange(open: boolean) {
    setIsCreateDialogOpen(open);
    if (!open) resetCreateWizard();
  }

  function handleStudentEmailChange(value: string) {
    setFormData((p) => ({ ...p, email: value }));
    setEmailVerificationStatus('idle');
    setEmailVerificationCode('');
    setResendCountdown(0);
  }

  async function handleSendVerificationCode() {
    const email = formData.email.trim();
    if (!email) { toast.error('Enter the student email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Enter a valid email address'); return; }
    setIsSendingCode(true);
    setEmailVerificationStatus('sending');
    try {
      const res = await fetch('/api/admin/student-email-verification/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to send code'); setEmailVerificationStatus('idle'); return; }
      setEmailVerificationStatus('sent');
      setResendCountdown(30);
      toast.success('Verification code sent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send code');
      setEmailVerificationStatus('idle');
    } finally { setIsSendingCode(false); }
  }

  async function handleVerifyEmailCode() {
    if (!formData.email.trim()) { toast.error('Enter the student email'); return; }
    if (emailVerificationCode.trim().length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setIsVerifyingCode(true);
    try {
      const res = await fetch('/api/admin/student-email-verification/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim(), code: emailVerificationCode.trim() }),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Verification failed'); return; }
      setEmailVerificationStatus('verified');
      toast.success('Email verified');
    } catch (e: any) {
      toast.error(e.message || 'Verification failed');
    } finally { setIsVerifyingCode(false); }
  }

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

  function canProceedFromStep(step: number) {
    const hasEmail = formData.email.trim().length > 0;
    switch (step) {
      case 0: return !hasEmail || emailVerificationStatus === 'verified';
      case 1: return formData.first_name.trim().length > 0 && formData.last_name.trim().length > 0;
      case 2: return formData.admission_date.trim().length > 0;
      case 3: return formData.parent_name.trim().length > 0 && formData.parent_email.trim().length > 0;
      default: return true;
    }
  }

  function handleNextStep() {
    if (!canProceedFromStep(createStep)) { toast.error('Please complete required fields'); return; }
    setCreateStep((p) => Math.min(p + 1, createSteps.length - 1));
  }

  function handlePreviousStep() { setCreateStep((p) => Math.max(p - 1, 0)); }

  async function handleCreateStudent(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    if (!formData.first_name.trim() || !formData.last_name.trim()) { toast.error('First and last name are required'); setIsCreating(false); return; }
    if (formData.email.trim() && emailVerificationStatus !== 'verified') { toast.error('Verify the student email first'); setIsCreating(false); return; }
    if (!formData.parent_name.trim() || !formData.parent_email.trim()) { toast.error('Parent name and email are required'); setIsCreating(false); return; }
    try {
      const tid = toast.loading('Creating student account…');
      const res = await fetch('/api/create-student', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) { toast.error(result.error || 'Failed to create student', { id: tid }); setIsCreating(false); return; }
      toast.success(result?.message || `Student created (ID: ${result.studentId}).`, { id: tid });
      if (Array.isArray(result?.warnings) && result.warnings.length > 0) toast.warning(result.warnings.join(' | '));
      if (result.student) setStudents((p) => [...p, result.student]);
      resetCreateWizard();
      setIsCreateDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create student');
    } finally { setIsCreating(false); }
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
            {/* ── Create student dialog ── */}
            <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/25 active:scale-95">
                  <Plus className="h-4 w-4" />
                  Add Student
                </button>
              </DialogTrigger>

              {/* ─────────────────── WIZARD DIALOG ─────────────────── */}
              <DialogContent className="max-h-[92vh] overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-5xl [&>button]:hidden">
                <div className="flex h-full max-h-[92vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/10">

                  {/* ── Top bar ── */}
                  <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950">
                        <Sparkles className="h-4 w-4 text-indigo-300" />
                      </div>
                      <div>
                        <DialogTitle className="text-base font-bold text-slate-900 leading-none">New Student Enrolment</DialogTitle>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Step {createStep + 1} of {createSteps.length} — {createSteps[createStep].title}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCreateDialogChange(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* ── Body: sidebar + content ── */}
                  <div className="flex min-h-0 flex-1 overflow-hidden">

                    {/* ── Sidebar ── */}
                    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-100 bg-slate-50 lg:flex">
                      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
                        {/* Progress ring / number */}
                        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Overall progress</p>
                          <div className="mt-3 flex items-end gap-2">
                            <span className="text-4xl font-bold text-slate-900 tabular-nums">
                              {String(createStep + 1).padStart(2, '0')}
                            </span>
                            <span className="pb-1 text-sm text-slate-400">/ {String(createSteps.length).padStart(2, '0')}</span>
                          </div>
                          <div className="mt-3">
                            <WizardProgress current={createStep} total={createSteps.length} />
                          </div>
                        </div>

                        {/* Email status pill */}
                        <div className="mb-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex items-center gap-2">
                            {emailVerificationStatus === 'verified'
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              : <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                            }
                            <p className="text-[11px] font-medium text-slate-600 leading-snug">
                              {emailVerificationStatus === 'verified'
                                ? 'Email verified'
                                : formData.email.trim()
                                  ? 'Awaiting verification'
                                  : 'Using parent email fallback'}
                            </p>
                          </div>
                        </div>

                        {/* Steps */}
                        {createSteps.map((step, i) => (
                          <StepItem key={step.title} step={step} index={i} current={createStep} />
                        ))}
                      </div>

                      {/* Notes footer */}
                      <div className="shrink-0 border-t border-slate-100 px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Notes</p>
                        <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-500">
                          <li>Keep student & parent details accurate.</li>
                          <li>Use the same parent email for siblings.</li>
                          <li>Optional steps can be skipped.</li>
                        </ul>
                      </div>
                    </aside>

                    {/* ── Main content panel ── */}
                    <form
                      onSubmit={handleCreateStudent}
                      className="flex flex-1 flex-col overflow-hidden"
                    >
                      {/* Step header */}
                      <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
                        <div className="flex items-center gap-3">
                          {(() => { const Icon = STEP_ICONS[createStep]; return (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                              <Icon className="h-4.5 w-4.5 text-indigo-600" />
                            </div>
                          ); })()}
                          <div>
                            <h2 className="text-base font-bold text-slate-900 leading-none">{createSteps[createStep].title}</h2>
                            <p className="mt-0.5 text-[12px] text-slate-500">{createSteps[createStep].detail}</p>
                          </div>
                        </div>
                        {/* Mobile progress bar */}
                        <div className="mt-3 lg:hidden">
                          <WizardProgress current={createStep} total={createSteps.length} />
                        </div>
                      </div>

                      {/* Scrollable step body */}
                      <div className="flex-1 overflow-y-auto px-6 py-6">

                        {/* ── STEP 0: Email Verification ── */}
                        {createStep === 0 && (
                          <div className="space-y-5 max-w-lg">
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4">
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">Optional</p>
                              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                                If the student has their own email, verify it with a 6-digit code. Leave it blank to rely on the parent email instead.
                              </p>
                            </div>

                            <FieldGroup>
                              <FieldLabel>Student Email</FieldLabel>
                              <StyledInput
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleStudentEmailChange(e.target.value)}
                                placeholder="student@example.com"
                              />
                            </FieldGroup>

                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                onClick={handleSendVerificationCode}
                                disabled={!formData.email.trim() || isSendingCode || resendCountdown > 0 || emailVerificationStatus === 'verified'}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                {emailVerificationStatus === 'verified'
                                  ? 'Email Verified'
                                  : isSendingCode ? 'Sending…'
                                  : resendCountdown > 0 ? `Resend in ${resendCountdown}s`
                                  : 'Send Code'}
                              </button>
                              {emailVerificationStatus === 'verified' && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                  <CheckCircle2 className="h-3.5 w-3.5" />Verified
                                </span>
                              )}
                            </div>

                            {formData.email.trim() && emailVerificationStatus !== 'idle' && (
                              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <FieldGroup>
                                  <FieldLabel>6-Digit Code</FieldLabel>
                                  <p className="text-xs text-slate-500 -mt-1">Sent to the student's inbox</p>
                                  <div className="mt-3">
                                    <InputOTP maxLength={6} value={emailVerificationCode} onChange={setEmailVerificationCode}>
                                      <InputOTPGroup>
                                        {Array.from({ length: 6 }).map((_, i) => (
                                          <InputOTPSlot key={i} index={i} />
                                        ))}
                                      </InputOTPGroup>
                                    </InputOTP>
                                  </div>
                                </FieldGroup>
                                <button
                                  type="button"
                                  onClick={handleVerifyEmailCode}
                                  disabled={emailVerificationStatus === 'verified' || isVerifyingCode}
                                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {isVerifyingCode ? 'Verifying…' : 'Verify Code'}
                                </button>
                              </div>
                            )}

                            {formData.email.trim() && emailVerificationStatus !== 'verified' && (
                              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                You can continue without a student email. The parent portal will remain the primary contact path.
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── STEP 1: Student Info ── */}
                        {createStep === 1 && (
                          <div className="space-y-5 max-w-2xl">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FieldGroup>
                                <FieldLabel required>First Name</FieldLabel>
                                <StyledInput value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="John" required />
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel required>Last Name</FieldLabel>
                                <StyledInput value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} placeholder="Doe" required />
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Phone</FieldLabel>
                                <StyledInput value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+234…" />
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Date of Birth</FieldLabel>
                                <StyledInput type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Gender</FieldLabel>
                                <StyledSelect value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                                  <option value="">Select gender</option>
                                  <option value="male">Male</option>
                                  <option value="female">Female</option>
                                  <option value="others">Others</option>
                                </StyledSelect>
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Address</FieldLabel>
                                <StyledInput value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Street address" />
                              </FieldGroup>
                            </div>
                          </div>
                        )}

                        {/* ── STEP 2: Academic ── */}
                        {createStep === 2 && (
                          <div className="space-y-5 max-w-2xl">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FieldGroup>
                                <FieldLabel>Class</FieldLabel>
                                <StyledSelect value={formData.class_id} onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}>
                                  <option value="">Select class (optional)</option>
                                  {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                                </StyledSelect>
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Department</FieldLabel>
                                <StyledSelect value={formData.department_id} onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}>
                                  <option value="">Select department</option>
                                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </StyledSelect>
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Religion</FieldLabel>
                                <StyledSelect value={formData.religion_id} onChange={(e) => setFormData({ ...formData, religion_id: e.target.value })}>
                                  <option value="">Select religion (optional)</option>
                                  {religions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </StyledSelect>
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel required>Admission Date</FieldLabel>
                                <StyledInput type="date" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} required />
                              </FieldGroup>
                            </div>
                          </div>
                        )}

                        {/* ── STEP 3: Parent / Guardian ── */}
                        {createStep === 3 && (
                          <div className="space-y-5 max-w-2xl">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FieldGroup className="sm:col-span-2">
                                <FieldLabel required>Parent / Guardian Name</FieldLabel>
                                <StyledInput value={formData.parent_name} onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })} placeholder="Full name" required />
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel required>Parent Email</FieldLabel>
                                <StyledInput type="email" value={formData.parent_email} onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })} placeholder="parent@example.com" required />
                              </FieldGroup>
                              <FieldGroup>
                                <FieldLabel>Parent Phone</FieldLabel>
                                <StyledInput value={formData.parent_phone} onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })} placeholder="+234…" />
                              </FieldGroup>
                            </div>
                          </div>
                        )}

                        {/* ── STEP 4: Photo ── */}
                        {createStep === 4 && (
                          <div className="space-y-5 max-w-2xl">
                            <div className="grid gap-5 sm:grid-cols-2">
                              {/* Preview */}
                              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                                {imagePreview ? (
                                  <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="text-center px-6">
                                    <Camera className="mx-auto h-8 w-8 text-slate-300" />
                                    <p className="mt-2 text-xs font-medium text-slate-400">No photo selected</p>
                                  </div>
                                )}
                              </div>

                              {/* Upload / camera */}
                              <div className="space-y-3">
                                {isCameraOpen ? (
                                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <video ref={videoRef} autoPlay playsInline className="w-full rounded-xl bg-black" style={{ height: 220 }} />
                                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                                    <div className="flex gap-2">
                                      <button type="button" onClick={handleCameraCapture} disabled={uploadingImage}
                                        className="flex-1 h-10 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">
                                        {uploadingImage ? 'Uploading…' : 'Capture'}
                                      </button>
                                      <button type="button" onClick={closeCameraAndClear} disabled={uploadingImage}
                                        className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50">
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                                    <FieldGroup>
                                      <FieldLabel>Upload from device</FieldLabel>
                                      <input
                                        type="file" accept="image/*" onChange={handleImageFileSelect} disabled={uploadingImage}
                                        className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
                                      />
                                      <p className="text-[11px] text-slate-400">JPG, PNG, WebP — max 5 MB</p>
                                    </FieldGroup>
                                    <button type="button" onClick={handleCameraCapture} disabled={uploadingImage}
                                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                                      <Camera className="h-4 w-4" /> Open Camera
                                    </button>
                                  </div>
                                )}

                                {uploadingImage && (
                                  <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-700">
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
                                    Uploading image…
                                  </div>
                                )}
                                {formData.image_url && (
                                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Uploaded successfully
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── STEP 5: Review ── */}
                        {createStep === 5 && (
                          <div className="space-y-5 max-w-2xl">
                            <div className="grid gap-4 sm:grid-cols-2">
                              {/* Student card */}
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <div className="flex items-center gap-3 mb-4">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 overflow-hidden shrink-0">
                                    {imagePreview
                                      ? <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                                      : <User className="h-5 w-5 text-indigo-500" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">
                                      {formData.first_name || '—'} {formData.last_name}
                                    </p>
                                    <p className="text-xs text-slate-500">{formData.email || 'Using parent email'}</p>
                                  </div>
                                </div>
                                <ReviewRow label="Phone" value={formData.phone} />
                                <ReviewRow label="DOB" value={formData.date_of_birth} />
                                <ReviewRow label="Gender" value={formData.gender} />
                                <ReviewRow label="Address" value={formData.address} />
                              </div>

                              {/* Guardian card */}
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Guardian</p>
                                <ReviewRow label="Name" value={formData.parent_name} />
                                <ReviewRow label="Email" value={formData.parent_email} />
                                <ReviewRow label="Phone" value={formData.parent_phone} />
                              </div>

                              {/* Academic card */}
                              <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Academic</p>
                                <ReviewRow label="Class" value={classes.find((c) => c.id === formData.class_id)?.name || ''} />
                                <ReviewRow label="Department" value={departments.find((d) => d.id === formData.department_id)?.name || ''} />
                                <ReviewRow label="Admission Date" value={formData.admission_date} />
                              </div>
                            </div>

                            <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                              <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                              When created, the system sends an activation link to the verified student email and notifies the parent account.
                            </div>
                          </div>
                        )}

                      </div>{/* end scrollable body */}

                      {/* ── Footer navigation ── */}
                      <div className="shrink-0 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={handlePreviousStep}
                            disabled={createStep === 0 || isCreating}
                            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ArrowLeft className="h-4 w-4" /> Back
                          </button>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCreateDialogChange(false)}
                              disabled={isCreating}
                              className="inline-flex h-10 items-center px-4 rounded-xl text-sm font-medium text-slate-500 transition hover:text-slate-700 disabled:opacity-40"
                            >
                              Cancel
                            </button>

                            {createStep < createSteps.length - 1 ? (
                              <button
                                type="button"
                                onClick={handleNextStep}
                                disabled={!canProceedFromStep(createStep) || isCreating}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Continue <ArrowRight className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                type="submit"
                                disabled={isCreating}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50"
                              >
                                {isCreating ? (
                                  <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Creating…
                                  </>
                                ) : (
                                  <><Sparkles className="h-4 w-4" /> Create Student</>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                    </form>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

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