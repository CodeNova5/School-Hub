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
import { Search, Download, Users, UserCheck, UserX, Calendar as CalendarIcon, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  const [transferTargetClassId, setTransferTargetClassId] = useState("");
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

  // Form fields for creating student
  const [formData, setFormData] = useState(getDefaultFormData);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const router = useRouter();

  const createSteps = [
    { title: 'Verify Email', description: 'Confirm student email' },
    { title: 'Student Info', description: 'Basic details' },
    { title: 'Academic', description: 'Class and department' },
    { title: 'Parent/Guardian', description: 'Contact details' },
    { title: 'Photo', description: 'Optional upload' },
    { title: 'Review', description: 'Confirm and create' },
  ];

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
    if (!isCreateDialogOpen && cameraStream) {
      // Clean up camera when dialog closes
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOpen(false);
    }
  }, [isCreateDialogOpen, cameraStream]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const interval = setInterval(() => {
      setResendCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCountdown]);

  useEffect(() => {
    if (schoolId) {
      loadData();
    }
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
      filtered = filtered.filter((s) => s.department_id === filterDepartment);
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
      if (!schoolId) {
        throw new Error('School ID not available');
      }

      // Use Supabase client instead of API - ALL queries now filter by school_id
      const [{ data: studentList, error: studentsError }, { data: sessionsList, error: sessionsError }, { data: termsList, error: termsError }, { data: classList, error: classesError }, { data: departmentsList, error: departmentsError }, { data: religionsList, error: religionsError }] = await Promise.all([
        supabase.from('students').select('*').eq('school_id', schoolId).order('first_name', { ascending: true }),
        supabase.from('sessions').select('*').eq('school_id', schoolId).order('name', { ascending: false }),
        supabase.from('terms').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', schoolId).order('name', { ascending: true }),
        supabase.from('school_departments').select('*').eq('school_id', schoolId).eq('is_active', true).order('name', { ascending: true }),
        supabase.from('school_religions').select('*').eq('school_id', schoolId).eq('is_active', true).order('name', { ascending: true }),
      ]);

      if (studentsError || sessionsError || termsError || classesError || departmentsError || religionsError) {
        throw new Error(
          studentsError?.message ||
          sessionsError?.message ||
          termsError?.message ||
          classesError?.message ||
          departmentsError?.message ||          religionsError?.message ||          'Unknown error'
        );
      }

      const departmentMap = new Map((departmentsList || []).map((d: Department) => [d.id, d.name]));

      const studentIds = (studentList || []).map((s: Student) => s.id).filter(Boolean);

      let attendance: any[] = [];
      if (studentIds.length > 0) {
        const { data: attendanceRes, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('school_id', schoolId)
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

        const resolvedDepartmentName = student.department_id
          ? departmentMap.get(student.department_id)
          : null;

        return {
          ...student,
          department: student.department || resolvedDepartmentName || undefined,
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
      // Fetch attendance data for this student - filtered by school_id
      const { data: attendance, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('school_id', schoolId)
        .eq('student_id', student.id);

      if (error) throw error;

      const total = attendance?.length || 0;
      const present = attendance?.filter(
        (r: any) => r.status === 'present' || r.status === 'late' || r.status === 'excused'
      ).length || 0;

      const averageAttendance = total === 0 ? 0 : Math.round((present / total) * 100);

      const enrichedStudent = {
        ...student,
        average_attendance: averageAttendance,
        total_attendance: total,
      };

      setSelectedStudent(enrichedStudent);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setSelectedStudent(student);
    }
    setIsModalOpen(true);
  }

  function handleManageSubjects(student: Student) {
    // This would navigate to a page to manage subjects
    router.push(`/admin/students/${student.id}/subjects`);
  }

  // Image handling functions
  async function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to GitHub
    await uploadImageToGitHub(file);
  }

  async function uploadImageToGitHub(file: File) {
    setUploadingImage(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("type", "student_photo");
      uploadFormData.append("student_id", `student_${formData.first_name}_${formData.last_name}_${new Date().getTime()}`);

      // Call server-side upload API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unknown error');
      }

      setFormData(prev => ({
        ...prev,
        image_url: result.fileUrl,
      }));

      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to upload image to GitHub');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCameraCapture() {
    try {
      if (!cameraStream) {
        // Open camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
        });
        setCameraStream(stream);
        setIsCameraOpen(true);

        // Add stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        // Capture photo
        if (canvasRef.current && videoRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const context = canvas.getContext('2d');

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context?.drawImage(video, 0, 0);

          // Convert canvas to blob and upload
          canvas.toBlob(async (blob: Blob | null) => {
            if (!blob) return;
            const file = new File([blob], `student_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setImagePreview(canvas.toDataURL());
            await uploadImageToGitHub(file);
            
            // Close camera
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
            setIsCameraOpen(false);
          });
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Failed to access camera');
    }
  }

  function closeCameraAndClear() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
    setIsCameraOpen(false);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
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
    if (!open) {
      resetCreateWizard();
    }
  }

  function handleStudentEmailChange(value: string) {
    setFormData(prev => ({ ...prev, email: value }));
    setEmailVerificationStatus('idle');
    setEmailVerificationCode('');
    setResendCountdown(0);
  }

  async function handleSendVerificationCode() {
    const email = formData.email.trim();
    if (!email) {
      toast.error('Enter the student email to send a verification code');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid student email address');
      return;
    }

    setIsSendingCode(true);
    setEmailVerificationStatus('sending');
    try {
      const response = await fetch('/api/admin/student-email-verification/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Failed to send verification code');
        setEmailVerificationStatus('idle');
        return;
      }

      setEmailVerificationStatus('sent');
      setResendCountdown(30);
      toast.success('Verification code sent to the student email');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send verification code');
      setEmailVerificationStatus('idle');
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleVerifyEmailCode() {
    const email = formData.email.trim();
    if (!email) {
      toast.error('Enter the student email to verify');
      return;
    }
    if (emailVerificationCode.trim().length !== 6) {
      toast.error('Enter the 6-digit verification code');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const response = await fetch('/api/admin/student-email-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: emailVerificationCode.trim() }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'Verification failed');
        return;
      }

      setEmailVerificationStatus('verified');
      toast.success('Student email verified');
    } catch (error: any) {
      toast.error(error.message || 'Verification failed');
    } finally {
      setIsVerifyingCode(false);
    }
  }

  function handleEditStudent(student: Student) {
    setSelectedStudent(student);
    setIsEditStudentOpen(true);
  }

  function handleTransferStudent(student: Student) {
    setSelectedStudent(student);
    setIsTransferStudentOpen(true);
  }

  async function handleTransferStudentToClass(targetClassId: string) {
    if (!selectedStudent || !targetClassId) {
      toast.error("Please select a valid student and target class");
      return;
    }

    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transfer-students",
          studentIds: [selectedStudent.id],
          targetClassId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to transfer student");
        return;
      }

      toast.success(`Successfully transferred ${selectedStudent.first_name} ${selectedStudent.last_name} to another class`);
      // Update student in list with new class
      const updatedStudent = { ...selectedStudent, class_id: targetClassId };
      setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
      setIsTransferStudentOpen(false);
      setTransferTargetClassId("");
      setSelectedStudent(null);
    } catch (error: any) {
      toast.error("Failed to transfer student: " + (error.message || error));
    }
  }

  async function handleRemoveStudent(student: Student) {
    if (!student) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-student",
          studentId: student.id,
          userId: student.user_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete student");
        return;
      }

      toast.success("Student and all related data deleted.");
      setIsDeleteDialogOpen(false);
      // Remove student from list immediately
      setStudents(students.filter(s => s.id !== student.id));
      setStudentToDelete(null);
    } catch (error: any) {
      toast.error("Failed to delete student: " + (error.message || error));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDeleteStudent(student: Student) {
    setStudentToDelete(student);
    setIsDeleteDialogOpen(true);
  }

  async function handleDeleteStudentCompletely() {
    if (!studentToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-student",
          studentId: studentToDelete.id,
          userId: studentToDelete.user_id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to delete student");
        return;
      }

      toast.success("Student and all related data deleted.");
      setIsDeleteDialogOpen(false);
      // Remove student from list immediately
      setStudents(students.filter(s => s.id !== studentToDelete.id));
      setStudentToDelete(null);
    } catch (error: any) {
      toast.error("Failed to delete student: " + (error.message || error));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEditStudentSuccess(updatedStudent: Student) {
    // Update the student in the list
    setStudents(students.map(s => s.id === updatedStudent.id ? updatedStudent : s));
  }

  function canProceedFromStep(step: number) {
    const hasStudentEmail = formData.email.trim().length > 0;

    switch (step) {
      case 0:
        return !hasStudentEmail || emailVerificationStatus === 'verified';
      case 1:
        return formData.first_name.trim().length > 0 && formData.last_name.trim().length > 0;
      case 2:
        return formData.admission_date.trim().length > 0;
      case 3:
        return formData.parent_name.trim().length > 0 && formData.parent_email.trim().length > 0;
      default:
        return true;
    }
  }

  function handleNextStep() {
    if (!canProceedFromStep(createStep)) {
      toast.error('Please complete the required fields before continuing');
      return;
    }
    setCreateStep((prev) => Math.min(prev + 1, createSteps.length - 1));
  }

  function handlePreviousStep() {
    setCreateStep((prev) => Math.max(prev - 1, 0));
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

    if (formData.email.trim() && emailVerificationStatus !== 'verified') {
      toast.error('Verify the student email before creating the account');
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

      const successMessage = result?.message || `Student created successfully (ID: ${result.studentId}).`;
      toast.success(successMessage, { id: creatingToast });

      if (Array.isArray(result?.warnings) && result.warnings.length > 0) {
        toast.warning(result.warnings.join(' | '));
      }

      // Add the new student to the list immediately
      if (result.student) {
        setStudents([...students, result.student]);
      }

      resetCreateWizard();
      setIsCreateDialogOpen(false);
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

  const uniqueDepartments = departments;

  if (schoolLoading || isLoading) {
    return (
      <DashboardLayout role="admin">
        <StudentsSkeleton />
      </DashboardLayout>
    );
  }

  if (schoolError || !schoolId) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 font-semibold">{schoolError || 'Unable to determine your school'}</p>
            <p className="text-gray-600 text-sm mt-2">Please contact your administrator or try logging in again.</p>
          </div>
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
            <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogChange}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white shadow-lg shadow-slate-900/20 transition-all hover:shadow-xl hover:shadow-slate-900/25">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/70 p-0 shadow-2xl sm:max-w-5xl">
                <div className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="border-b border-slate-200/80 bg-white/80 px-6 py-5 backdrop-blur">
                    <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                      Create New Student
                    </DialogTitle>
                    <p className="mt-1 max-w-2xl text-sm text-slate-500">
                      Step through identity, academics, guardian details, and a final review in one polished flow.
                    </p>
                  </DialogHeader>

                  <form onSubmit={handleCreateStudent} className="space-y-6 px-6 py-6">
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl shadow-slate-900/10">
                      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] lg:p-8">
                        <div className="space-y-5">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                            Student onboarding wizard
                          </div>
                          <div className="space-y-3">
                            <p className="text-sm uppercase tracking-[0.24em] text-white/55">
                              Step {createStep + 1} of {createSteps.length}
                            </p>
                            <h3 className="text-2xl font-semibold text-white sm:text-3xl">
                              {createSteps[createStep].title}
                            </h3>
                            <p className="max-w-xl text-sm leading-6 text-white/72 sm:text-base">
                              {createSteps[createStep].description}
                              {createStep === 0 && ' Verify the student email before they enter the portal.'}
                              {createStep === 4 && ' Add a profile image to make the record immediately recognizable.'}
                              {createStep === 5 && ' Review everything before the account is provisioned.'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/75">
                              Parent notification ready
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/75">
                              Optional student email
                            </div>
                            <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/75">
                              Photo and class assignment
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Progress</p>
                            <div className="mt-3 flex items-end gap-3">
                              <span className="text-4xl font-semibold text-white">0{createStep + 1}</span>
                              <span className="pb-1 text-sm text-white/65">of 06 steps</span>
                            </div>
                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-all duration-300"
                                style={{ width: `${((createStep + 1) / createSteps.length) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Email status</p>
                            <div className="mt-3 flex items-center gap-3">
                              {emailVerificationStatus === 'verified' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-amber-300" />
                              )}
                              <span className="text-sm font-medium text-white/90">
                                {emailVerificationStatus === 'verified'
                                  ? 'Verified and ready'
                                  : formData.email.trim()
                                    ? 'Waiting for verification'
                                    : 'Using parent email fallback'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/65">
                              A verified student email enables activation while keeping the parent account in sync.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-px border-t border-white/10 bg-white/5 lg:grid-cols-[280px_minmax(0,1fr)]">
                        <aside className="bg-slate-950/95 p-5 text-white">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Flow map</p>
                          <div className="mt-4 space-y-3">
                            {createSteps.map((step, index) => {
                              const isActive = index === createStep;
                              const isCompleted = index < createStep;

                              return (
                                <div
                                  key={step.title}
                                  className={`rounded-2xl border px-4 py-3 transition-all ${
                                    isActive
                                      ? 'border-sky-400/50 bg-sky-500/10 shadow-lg shadow-sky-500/10'
                                      : isCompleted
                                        ? 'border-emerald-400/30 bg-emerald-500/10'
                                        : 'border-white/10 bg-white/5'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                        isActive
                                          ? 'bg-sky-400 text-slate-950'
                                          : isCompleted
                                            ? 'bg-emerald-400 text-slate-950'
                                            : 'bg-white/10 text-white/70'
                                      }`}
                                    >
                                      {index + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-white">{step.title}</p>
                                      <p className="text-xs leading-5 text-white/60">{step.description}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="text-sm font-medium text-white">Creation notes</p>
                            <ul className="mt-3 space-y-2 text-sm text-white/65">
                              <li>Keep the student and parent contact details accurate.</li>
                              <li>Use the same parent email for siblings when needed.</li>
                              <li>Optional steps can be skipped without blocking creation.</li>
                            </ul>
                          </div>
                        </aside>

                        <div className="bg-white p-5 sm:p-6 lg:p-8">
                          {createStep === 0 && (
                            <div className="space-y-5">
                              <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
                                <h3 className="text-base font-semibold text-slate-900">Student Email Verification</h3>
                                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                                  If the student has their own email, verify it with a 6-digit code before moving on.
                                  Leave it blank to rely on the parent email and continue the enrollment flow.
                                </p>
                              </div>

                              <div className="grid gap-4">
                                <div>
                                  <Label htmlFor="student_email" className="text-sm font-medium text-slate-700">
                                    Student Email (optional)
                                  </Label>
                                  <Input
                                    id="student_email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleStudentEmailChange(e.target.value)}
                                    placeholder="student@example.com"
                                    className="mt-2 h-12 rounded-xl border-slate-200 bg-white px-4 shadow-sm transition-colors focus-visible:ring-sky-500"
                                  />
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                  <Button
                                    type="button"
                                    onClick={handleSendVerificationCode}
                                    disabled={!formData.email.trim() || isSendingCode || resendCountdown > 0 || emailVerificationStatus === 'verified'}
                                    className="h-11 rounded-xl bg-slate-950 px-5 text-white transition-colors hover:bg-slate-800"
                                  >
                                    {emailVerificationStatus === 'verified'
                                      ? 'Email Verified'
                                      : isSendingCode
                                        ? 'Sending...'
                                        : resendCountdown > 0
                                          ? `Resend in ${resendCountdown}s`
                                          : 'Send Code'}
                                  </Button>
                                  {emailVerificationStatus === 'verified' && (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                                      <CheckCircle2 className="h-4 w-4" />
                                      Verification complete
                                    </div>
                                  )}
                                </div>
                              </div>

                              {formData.email.trim() && emailVerificationStatus !== 'idle' && (
                                <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                  <div>
                                    <Label className="text-sm font-medium text-slate-700">Verification Code</Label>
                                    <p className="mt-1 text-sm text-slate-500">Enter the 6-digit code sent to the student inbox.</p>
                                    <div className="mt-4">
                                      <InputOTP maxLength={6} value={emailVerificationCode} onChange={setEmailVerificationCode}>
                                        <InputOTPGroup>
                                          {Array.from({ length: 6 }).map((_, index) => (
                                            <InputOTPSlot key={index} index={index} />
                                          ))}
                                        </InputOTPGroup>
                                      </InputOTP>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                      type="button"
                                      onClick={handleVerifyEmailCode}
                                      disabled={emailVerificationStatus === 'verified' || isVerifyingCode}
                                      className="h-11 rounded-xl bg-sky-600 px-5 text-white hover:bg-sky-700"
                                    >
                                      {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
                                    </Button>
                                    <p className="text-sm text-slate-500">
                                      This keeps the student account tied to an address they can actually access.
                                    </p>
                                  </div>
                                </div>
                              )}

                              {formData.email.trim() && emailVerificationStatus !== 'verified' && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                  You can continue without a student email. The parent portal will remain the primary contact path.
                                </div>
                              )}
                            </div>
                          )}

                          {createStep === 1 && (
                            <div className="space-y-5">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">Basic Information</h3>
                                <p className="mt-1 text-sm text-slate-500">Capture the student’s core identity and contact details.</p>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor="first_name" className="text-sm font-medium text-slate-700">First Name *</Label>
                                  <Input
                                    id="first_name"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    placeholder="John"
                                    required
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="last_name" className="text-sm font-medium text-slate-700">Last Name *</Label>
                                  <Input
                                    id="last_name"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    placeholder="Doe"
                                    required
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone</Label>
                                  <Input
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="+234..."
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="date_of_birth" className="text-sm font-medium text-slate-700">Date of Birth</Label>
                                  <Input
                                    id="date_of_birth"
                                    type="date"
                                    value={formData.date_of_birth}
                                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="gender" className="text-sm font-medium text-slate-700">Gender</Label>
                                  <select
                                    id="gender"
                                    value={formData.gender}
                                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 shadow-sm outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                  >
                                    <option value="">Select gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="others">Others</option>
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor="address" className="text-sm font-medium text-slate-700">Address</Label>
                                  <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Street address"
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {createStep === 2 && (
                            <div className="space-y-5">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">Academic Information</h3>
                                <p className="mt-1 text-sm text-slate-500">Assign the student to the right academic structure.</p>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor="class_id" className="text-sm font-medium text-slate-700">Class</Label>
                                  <select
                                    id="class_id"
                                    value={formData.class_id}
                                    onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                                    className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 shadow-sm outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
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
                                  <Label htmlFor="department_id" className="text-sm font-medium text-slate-700">Department</Label>
                                  <select
                                    id="department_id"
                                    value={formData.department_id}
                                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                                    className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 shadow-sm outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                  >
                                    <option value="">Select department</option>
                                    {departments.map((dept) => (
                                      <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor="religion_id" className="text-sm font-medium text-slate-700">Religion</Label>
                                  <select
                                    id="religion_id"
                                    value={formData.religion_id}
                                    onChange={(e) => setFormData({ ...formData, religion_id: e.target.value })}
                                    className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 shadow-sm outline-none transition-colors focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                                  >
                                    <option value="">Select religion (optional)</option>
                                    {religions.map((religion) => (
                                      <option key={religion.id} value={religion.id}>
                                        {religion.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor="admission_date" className="text-sm font-medium text-slate-700">Admission Date *</Label>
                                  <Input
                                    id="admission_date"
                                    type="date"
                                    value={formData.admission_date}
                                    onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                                    required
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {createStep === 3 && (
                            <div className="space-y-5">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">Parent/Guardian Information</h3>
                                <p className="mt-1 text-sm text-slate-500">This is the primary communication channel for the student’s account.</p>
                              </div>
                              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                                <strong>Tip:</strong> if siblings already exist in the system, reuse the same parent email so the account stays linked.
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <Label htmlFor="parent_name" className="text-sm font-medium text-slate-700">Parent/Guardian Name *</Label>
                                  <Input
                                    id="parent_name"
                                    value={formData.parent_name}
                                    onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                                    placeholder="Parent name"
                                    required
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="parent_email" className="text-sm font-medium text-slate-700">Parent Email *</Label>
                                  <Input
                                    id="parent_email"
                                    type="email"
                                    value={formData.parent_email}
                                    onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
                                    placeholder="parent@example.com"
                                    required
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                                <div className="sm:col-span-2">
                                  <Label htmlFor="parent_phone" className="text-sm font-medium text-slate-700">Parent Phone</Label>
                                  <Input
                                    id="parent_phone"
                                    value={formData.parent_phone}
                                    onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                                    placeholder="+234..."
                                    className="mt-2 h-12 rounded-xl border-slate-200 px-4 shadow-sm focus-visible:ring-sky-500"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {createStep === 4 && (
                            <div className="space-y-5">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">Student Photo</h3>
                                <p className="mt-1 text-sm text-slate-500">Add a profile image now or skip and attach one later.</p>
                              </div>
                              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white">
                                    {imagePreview ? (
                                      <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="px-4 text-center">
                                        <p className="text-sm font-medium text-slate-700">No photo selected yet</p>
                                        <p className="mt-1 text-sm text-slate-500">Use file upload or the camera to capture a clean student portrait.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  {isCameraOpen ? (
                                    <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                      <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        className="w-full rounded-2xl bg-black shadow-sm"
                                        style={{ height: '300px' }}
                                      />
                                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                                      <div className="flex flex-wrap gap-3">
                                        <Button type="button" onClick={handleCameraCapture} disabled={uploadingImage} className="h-11 rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800">
                                          {uploadingImage ? 'Uploading...' : 'Capture Photo'}
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={closeCameraAndClear}
                                          disabled={uploadingImage}
                                          className="h-11 rounded-xl border-slate-300 px-5"
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                      <div>
                                        <Label htmlFor="student_image" className="text-sm font-medium text-slate-700">Upload from device</Label>
                                        <Input
                                          id="student_image"
                                          type="file"
                                          accept="image/*"
                                          onChange={handleImageFileSelect}
                                          disabled={uploadingImage}
                                          className="mt-2 cursor-pointer rounded-xl border-slate-200 px-4 py-3 shadow-sm"
                                        />
                                        <p className="mt-2 text-xs text-slate-500">JPG, PNG, WebP. Keep the image under 5MB for a faster upload.</p>
                                      </div>
                                      <Button type="button" variant="outline" onClick={handleCameraCapture} disabled={uploadingImage} className="h-11 rounded-xl border-slate-300 px-5">
                                        📷 Camera capture
                                      </Button>
                                    </div>
                                  )}

                                  {uploadingImage && (
                                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
                                      Uploading image to GitHub...
                                    </div>
                                  )}

                                  {formData.image_url && (
                                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                                      <CheckCircle2 className="h-4 w-4" />
                                      Image uploaded successfully
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {createStep === 5 && (
                            <div className="space-y-5">
                              <div>
                                <h3 className="text-lg font-semibold text-slate-900">Review</h3>
                                <p className="mt-1 text-sm text-slate-500">Confirm the details before the student account is created.</p>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Student</p>
                                  <p className="mt-2 text-base font-semibold text-slate-900">
                                    {formData.first_name || '-'} {formData.last_name || ''}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">{formData.email || 'Using parent email'}</p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Guardian</p>
                                  <p className="mt-2 text-base font-semibold text-slate-900">{formData.parent_name || '-'}</p>
                                  <p className="mt-1 text-sm text-slate-500">{formData.parent_email || '-'}</p>
                                </div>
                              </div>
                              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-slate-500">Class</span>
                                    <span className="font-medium text-slate-900">
                                      {classes.find((cls) => cls.id === formData.class_id)?.name || 'Not selected'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-slate-500">Department</span>
                                    <span className="font-medium text-slate-900">
                                      {departments.find((dept) => dept.id === formData.department_id)?.name || 'Not selected'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-slate-500">Admission Date</span>
                                    <span className="font-medium text-slate-900">{formData.admission_date || '-'}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                When you create the student, the system will send an activation link to the verified student email
                                if one was provided, and notify the parent account.
                              </div>
                            </div>
                          )}

                          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handlePreviousStep}
                              disabled={createStep === 0 || isCreating}
                              className="h-11 rounded-xl border-slate-300 px-5"
                            >
                              Back
                            </Button>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleCreateDialogChange(false)}
                                disabled={isCreating}
                                className="h-11 rounded-xl border-slate-300 px-5"
                              >
                                Cancel
                              </Button>
                              {createStep < createSteps.length - 1 ? (
                                <Button
                                  type="button"
                                  onClick={handleNextStep}
                                  disabled={!canProceedFromStep(createStep) || isCreating}
                                  className="h-11 rounded-xl bg-slate-950 px-6 text-white hover:bg-slate-800"
                                >
                                  Continue
                                </Button>
                              ) : (
                                <Button
                                  type="submit"
                                  disabled={isCreating}
                                  className="h-11 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-6 text-white hover:from-sky-700 hover:to-indigo-700"
                                >
                                  {isCreating ? 'Creating...' : 'Create Student'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
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
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
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
                <option value="others">Others</option>
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
              onEditStudent={handleEditStudent}
              onManageSubjects={handleManageSubjects}
              onTransferStudent={handleTransferStudent}
              onRemoveStudent={handleRemoveStudent}
              onDeleteStudent={handleDeleteStudent}
            />
          </CardContent>
        </Card>

        {/* Student Details Modal */}
        <StudentDetailsModal
          student={selectedStudent}
          sessions={sessions}
          terms={terms}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />

        {/* Edit Student Modal */}
        <EditStudentModal
          student={selectedStudent}
          isOpen={isEditStudentOpen}
          onClose={() => {
            setIsEditStudentOpen(false);
            setSelectedStudent(null);
          }}
          onSuccess={handleEditStudentSuccess}
        />

        {/* Transfer Student Dialog */}
        <Dialog open={isTransferStudentOpen} onOpenChange={setIsTransferStudentOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Transfer {selectedStudent?.first_name} {selectedStudent?.last_name} to another class:
              </p>

              <select
                className="w-full border rounded-md p-2"
                value={transferTargetClassId}
                onChange={(e) => setTransferTargetClassId(e.target.value)}
              >
                <option value="">Select target class</option>
                {classes
                  .filter((c) => c.id !== selectedStudent?.class_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTransferStudentOpen(false);
                    setTransferTargetClassId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleTransferStudentToClass(transferTargetClassId);
                  }}
                  disabled={!transferTargetClassId}
                >
                  Transfer
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Student Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                <span className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Delete Student Completely
                </span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-red-700 font-semibold">
                This will permanently delete <b>{studentToDelete?.first_name} {studentToDelete?.last_name}</b> and all related data:
              </p>
              <ul className="list-disc pl-6 text-sm text-red-600">
                <li>Student record</li>
                <li>Attendance, results, class assignments</li>
                <li>Session/term links</li>
                <li>Auth user account (cannot be undone)</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. Are you sure you want to proceed?
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteDialogOpen(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteStudentCompletely}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete Permanently"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
