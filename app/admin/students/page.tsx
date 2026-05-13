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
import { Search, Download, Users, UserCheck, UserX, Calendar as CalendarIcon, Plus, ArrowRightLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Student</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateStudent} className="space-y-5">
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Step {createStep + 1} of {createSteps.length}
                        </p>
                        <p className="text-xs text-slate-500">{createSteps[createStep].description}</p>
                      </div>
                      {emailVerificationStatus === 'verified' && createStep === 0 && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Email verified
                        </div>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-6 gap-2">
                      {createSteps.map((step, index) => (
                        <div key={step.title} className="flex flex-col gap-1">
                          <div
                            className={`h-1 rounded-full ${index <= createStep ? 'bg-blue-600' : 'bg-slate-200'}`}
                          />
                          <span
                            className={`text-[11px] ${index === createStep ? 'text-slate-900 font-medium' : 'text-slate-500'}`}
                          >
                            {step.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {createStep === 0 && (
                    <div className="space-y-4">
                      <div className="rounded-md border border-slate-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-slate-900">Student Email Verification</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          If the student has their own email, verify it with a 6-digit code before moving on. Leave it
                          blank to use the parent email.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="student_email">Student Email (optional)</Label>
                          <Input
                            id="student_email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleStudentEmailChange(e.target.value)}
                            placeholder="student@example.com"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={handleSendVerificationCode}
                            disabled={!formData.email.trim() || isSendingCode || resendCountdown > 0 || emailVerificationStatus === 'verified'}
                          >
                            {emailVerificationStatus === 'verified'
                              ? 'Email Verified'
                              : isSendingCode
                                ? 'Sending...'
                                : resendCountdown > 0
                                  ? `Resend in ${resendCountdown}s`
                                  : 'Send Code'}
                          </Button>
                        </div>
                      </div>
                      {formData.email.trim() && emailVerificationStatus !== 'idle' && (
                        <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
                          <div>
                            <Label>Verification Code</Label>
                            <div className="mt-2">
                              <InputOTP maxLength={6} value={emailVerificationCode} onChange={setEmailVerificationCode}>
                                <InputOTPGroup>
                                  {Array.from({ length: 6 }).map((_, index) => (
                                    <InputOTPSlot key={index} index={index} />
                                  ))}
                                </InputOTPGroup>
                              </InputOTP>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={handleVerifyEmailCode}
                              disabled={emailVerificationStatus === 'verified' || isVerifyingCode}
                            >
                              {isVerifyingCode ? 'Verifying...' : 'Verify Code'}
                            </Button>
                            <p className="text-xs text-slate-500 flex items-center">
                              Check the student inbox for the 6-digit code.
                            </p>
                          </div>
                        </div>
                      )}
                      {formData.email.trim() && emailVerificationStatus !== 'verified' && (
                        <p className="text-xs text-slate-500">
                          You can continue without a student email. The student will use the parent portal for now.
                        </p>
                      )}
                    </div>
                  )}

                  {createStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-4">
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
                            <option value="others">Others</option>
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
                  )}

                  {createStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Academic Information</h3>
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
                          <Label htmlFor="department_id">Department</Label>
                          <select
                            id="department_id"
                            value={formData.department_id}
                            onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
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
                          <Label htmlFor="religion_id">Religion</Label>
                          <select
                            id="religion_id"
                            value={formData.religion_id}
                            onChange={(e) => setFormData({ ...formData, religion_id: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
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
                  )}

                  {createStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Parent/Guardian Information</h3>
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-900">
                          <strong>Important:</strong> If this student has siblings already registered, use the same parent
                          email to link them to the existing parent account.
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
                  )}

                  {createStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Student Photo</h3>
                      <div className="flex flex-col gap-4">
                        {imagePreview && (
                          <div className="flex flex-col items-center gap-2">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-32 h-32 rounded-lg object-cover border-2 border-gray-300"
                            />
                            <p className="text-sm text-green-600 font-medium">Image ready to upload</p>
                          </div>
                        )}

                        {isCameraOpen ? (
                          <div className="flex flex-col gap-3 items-center">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              className="w-full rounded-lg bg-black max-w-sm"
                              style={{ height: '300px' }}
                            />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                            <div className="flex gap-2">
                              <Button type="button" onClick={handleCameraCapture} disabled={uploadingImage}>
                                {uploadingImage ? 'Uploading...' : 'Capture Photo'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={closeCameraAndClear}
                                disabled={uploadingImage}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Input
                                id="student_image"
                                type="file"
                                accept="image/*"
                                onChange={handleImageFileSelect}
                                disabled={uploadingImage}
                                className="cursor-pointer"
                              />
                              <p className="text-xs text-gray-500 mt-1">JPG, PNG, WebP (Max 5MB)</p>
                            </div>
                            <Button type="button" variant="outline" onClick={handleCameraCapture} disabled={uploadingImage}>
                              📷 Camera
                            </Button>
                          </div>
                        )}

                        {uploadingImage && (
                          <p className="text-sm text-blue-600">Uploading image to GitHub...</p>
                        )}

                        {formData.image_url && (
                          <div className="text-sm text-green-600 flex items-center gap-2">
                            ✓ Image uploaded successfully
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {createStep === 5 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold">Review</h3>
                      <div className="rounded-lg border bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Student</span>
                          <span className="font-medium">
                            {formData.first_name || '-'} {formData.last_name || ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Student Email</span>
                          <span className="font-medium">{formData.email || 'Using parent email'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Parent/Guardian</span>
                          <span className="font-medium">{formData.parent_name || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Parent Email</span>
                          <span className="font-medium">{formData.parent_email || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Class</span>
                          <span className="font-medium">
                            {classes.find((cls) => cls.id === formData.class_id)?.name || 'Not selected'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Department</span>
                          <span className="font-medium">
                            {departments.find((dept) => dept.id === formData.department_id)?.name || 'Not selected'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Admission Date</span>
                          <span className="font-medium">{formData.admission_date || '-'}</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        When you create the student, the system will send an activation link to the verified student
                        email (if provided) and notify the parent.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t pt-4">
                    <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={createStep === 0 || isCreating}>
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => handleCreateDialogChange(false)} disabled={isCreating}>
                        Cancel
                      </Button>
                      {createStep < createSteps.length - 1 ? (
                        <Button type="button" onClick={handleNextStep} disabled={!canProceedFromStep(createStep) || isCreating}>
                          Continue
                        </Button>
                      ) : (
                        <Button type="submit" disabled={isCreating}>
                          {isCreating ? 'Creating...' : 'Create Student'}
                        </Button>
                      )}
                    </div>
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
