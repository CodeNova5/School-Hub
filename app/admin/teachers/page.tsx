"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  Camera,
  X,
  Users,
  UserCheck,
  UserX,
  Sparkles,
  ChevronRight,
  CalendarDays,
  Shield,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSchoolContext } from '@/hooks/use-school-context';
import { Teacher } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TeachersSkeleton } from '@/components/skeletons';
import { exportToCSV } from '@/lib/student-utils';
import { getCurrentDateStringWAT } from '@/lib/utils';

type SubjectAssignment = {
  classId: string;
  className: string;
  subjects: Array<{
    id: string;
    name: string;
  }>;
};

type TeacherWithDetails = Teacher & {
  assignedClass?: string;
  assignedClassId?: string;
  assignedSubjects?: string[];
  subjectCount?: number;
  subjectAssignmentsByClass?: SubjectAssignment[];
};

type Class = {
  class_teacher_id: any;
  id: string;
  name: string;
  class_level_id: string;
};

type SubjectClass = {
  teacher_id: any;
  id: string;
  subject_id: string;
  class_id: string;
  subjects?: any; // Changed to 'any' to fix type error
  classes?: any;  // Changed to 'any' to fix type error
};

function FieldLabel({ children, required, htmlFor }: { children: React.ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
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
        'shadow-sm ring-0 transition-all focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:outline-none ' +
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
        'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition-all appearance-none ' +
        'focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 ' +
        (props.className ?? '')
      }
    />
  );
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}>{children}</div>;
}

function PremiumStatCard({
  title,
  value,
  description,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number | string;
  description: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
        <div className={`rounded-2xl p-3 shadow-sm ring-1 ${accent.includes('emerald') ? 'bg-emerald-50 ring-emerald-100' : accent.includes('rose') ? 'bg-rose-50 ring-rose-100' : accent.includes('amber') ? 'bg-amber-50 ring-amber-100' : 'bg-indigo-50 ring-indigo-100'}`}>
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </div>
  );
}

function TeacherFeatureChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function TeachersPage() {
  const { schoolId } = useSchoolContext();
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherWithDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image handling state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (!isDialogOpen && cameraStream) {
      // Clean up camera when dialog closes
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOpen(false);
    }
  }, [isDialogOpen, cameraStream]);

  useEffect(() => {
    if (schoolId) {
      fetchTeachers();
      fetchClasses();
      fetchSubjectClasses();
    }
  }, [schoolId]);

  async function fetchTeachers() {
    if (!schoolId) return;
    try {
      // Fetch all teachers
      const { data: teachersData, error: teachersError } = await supabase
        .from('teachers')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (teachersError) throw teachersError;

      // Fetch all classes (for assignments)
      const { data: allClasses } = await supabase
        .from('classes')
        .select('id, name, class_teacher_id')
        .eq('school_id', schoolId);

      // Fetch all subject_classes with related data (for assignments)
      const { data: allSubjectClasses } = await supabase
        .from('subject_classes')
        .select('id, subject_id, class_id, teacher_id, subjects!subject_classes_subject_id_fkey(id, name), classes(id, name)')
        .eq('school_id', schoolId);

      // Build teacher details
      const teachersWithDetails = (teachersData || []).map((teacher: any) => {
        // Assigned class
        const assignedClassObj = (allClasses || []).find((c: Class) => c.class_teacher_id === teacher.id);
        // Assigned subject_classes with full details
        const assignedSubjectClasses = (allSubjectClasses || []).filter((sc: SubjectClass) => sc.teacher_id === teacher.id) as any[];

        // Group subjects by class
        const subjectsByClass: { [key: string]: SubjectAssignment } = {};
        assignedSubjectClasses.forEach(sc => {
          if (sc.classes && sc.subjects) {
            if (!subjectsByClass[sc.class_id]) {
              subjectsByClass[sc.class_id] = {
                classId: sc.class_id,
                className: sc.classes.name,
                subjects: [],
              };
            }
            subjectsByClass[sc.class_id].subjects.push({
              id: sc.subjects.id,
              name: sc.subjects.name,
            });
          }
        });

        return {
          ...teacher,
          assignedClass: assignedClassObj?.name,
          assignedClassId: assignedClassObj?.id,
          assignedSubjects: assignedSubjectClasses.map(sc => `subject-${sc.subject_id}-class-${sc.class_id}`),
          subjectCount: assignedSubjectClasses.length,
          subjectAssignmentsByClass: Object.values(subjectsByClass),
        };
      });
      setTeachers(teachersWithDetails);
    } catch (error) {
      toast.error('Failed to fetch teachers');
    }
  }

  async function fetchClasses() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, class_level_id, class_teacher_id')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });
      if (error) throw error;
      setClasses(data || []);
    } catch (error) {
      toast.error('Failed to fetch classes');
    }
  }

  async function fetchSubjectClasses() {
    if (!schoolId) return;
    try {
      // Join with subjects and classes for display - use explicit FK reference
      const { data, error } = await supabase
        .from('subject_classes')
        .select('id, subject_id, class_id, teacher_id, subjects!subject_classes_subject_id_fkey(id, name), classes(id, name)')
        .eq('school_id', schoolId);
      if (error) throw error;
      setSubjectClasses(data || []);
    } catch (error) {
      toast.error('Failed to fetch subject classes');
    }
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
      uploadFormData.append("type", "teacher_photo");
      uploadFormData.append("teacher_id", `teacher_${Date.now()}`);

      // Call server-side upload API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Unknown error');
      }

      setImageUrl(result.fileUrl);
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
            const file = new File([blob], `teacher_camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
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
    setImageUrl('');
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    const teacherData = {
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      qualification: formData.get('qualification') as string,
      specialization: formData.get('specialization') as string,
      address: formData.get('address') as string,
      status: formData.get('status') as string,
      phone: formData.get('phone') as string,
    };

    if (editingTeacher) {
      const email = formData.get('email') as string;

      try {
        const response = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-teacher',
            teacherId: editingTeacher.id,
            teacherData: {
              first_name: teacherData.first_name,
              last_name: teacherData.last_name,
              qualification: teacherData.qualification,
              specialization: teacherData.specialization,
              address: teacherData.address,
              status: teacherData.status,
              phone: teacherData.phone,
              email,
              ...(imageUrl && { photo_url: imageUrl }),
            },
            oldEmail: editingTeacher.email,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || 'Failed to update teacher');
          return;
        }

        if (result.emailChanged) {
          toast.success('Teacher updated! A verification link has been sent to the new email.');
        } else {
          toast.success('Teacher updated successfully!');
        }
        closeDialog();
        fetchTeachers();
      } catch (error) {
        console.error('Error updating teacher:', error);
        toast.error('An error occurred while updating the teacher');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Creating a new teacher - use API endpoint
      const email = formData.get('email') as string;
      const phone = formData.get('phone') as string;
      const selectedClass = formData.get('class_id') as string;

      if (!email) {
        toast.error('Email is required');
        setIsSubmitting(false);
        return;
      }

      try {
        const response = await fetch('/api/create-teacher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            teacherData: {
              ...teacherData,
              phone,
              ...(imageUrl && { photo_url: imageUrl }),
            },
            selectedClass: selectedClass || null,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          toast.error(result.error || 'Failed to create teacher');
          return;
        }

        toast.success('Teacher created successfully! Activation email sent.');
        closeDialog();
        fetchTeachers();
      } catch (error) {
        console.error('Error creating teacher:', error);
        toast.error('An error occurred while creating the teacher');
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  function handleExport() {
    const data = filteredTeachers.map((teacher) => ({
      'Staff ID': teacher.staff_id,
      'First Name': teacher.first_name,
      'Last Name': teacher.last_name,
      Email: teacher.email,
      Phone: teacher.phone,
      Specialization: teacher.specialization || 'N/A',
      Qualification: teacher.qualification || 'N/A',
      Status: teacher.status,
      'Class Teacher': teacher.assignedClass || 'Not assigned',
      Subjects: teacher.subjectCount || 0,
    }));

    exportToCSV(data, `teachers_export_${getCurrentDateStringWAT()}`);
    toast.success('Teachers exported successfully');
  }


  function closeDialog() {
    setIsDialogOpen(false);
    setEditingTeacher(null);
    setImagePreview(null);
    setImageUrl('');
    closeCameraAndClear();
  }

  function getInitials(firstName: string, lastName: string) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  const filteredTeachers = teachers.filter((teacher) =>
    `${teacher.first_name} ${teacher.last_name} ${teacher.staff_id}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  ).filter((teacher) => (statusFilter ? teacher.status === statusFilter : true));

  const totalTeachers = teachers.length;
  const activeTeachers = teachers.filter((teacher) => teacher.status === 'active').length;
  const classTeachers = teachers.filter((teacher) => teacher.assignedClass).length;
  const subjectAssignments = teachers.reduce((total, teacher) => total + (teacher.subjectCount || 0), 0);
  const onboardingTeachers = teachers.filter((teacher) => teacher.status === 'inactive').length;

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 px-6 py-8 text-white shadow-2xl shadow-slate-900/10 sm:px-8 lg:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.35),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.18),_transparent_26%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                Teaching Staff
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Teachers</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                  Manage teaching staff, class assignments, subject coverage, and profile details from one polished control center.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <TeacherFeatureChip label="Active staff" value={activeTeachers} />
                <TeacherFeatureChip label="Class teachers" value={classTeachers} />
                <TeacherFeatureChip label="Subject links" value={subjectAssignments} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingTeacher(null);
                      setImagePreview(null);
                      setImageUrl('');
                    }}
                    className="h-11 rounded-xl bg-white px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-black/10 transition hover:bg-slate-100"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[92vh] overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-5xl [&>button]:hidden">
                  <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/10">
                    <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 sm:px-7">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950">
                          <Sparkles className="h-4 w-4 text-indigo-300" />
                        </div>
                        <div>
                          <DialogTitle className="text-base font-bold text-slate-900 leading-none">
                            {editingTeacher ? 'Edit Teacher Profile' : 'New Teacher Enrollment'}
                          </DialogTitle>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {editingTeacher ? 'Update staff details, photo, and assignments.' : 'Create a polished staff record with a premium workflow.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={closeDialog}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1.25fr_0.95fr]">
                        <div className="min-h-0 overflow-y-auto px-6 py-6 sm:px-7">
                          <div className="space-y-6">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Profile</p>
                                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Basic teacher information</h3>
                                </div>
                                <Shield className="h-5 w-5 text-slate-400" />
                              </div>
                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <FieldGroup>
                                  <FieldLabel required>First Name</FieldLabel>
                                  <StyledInput
                                    id="first_name"
                                    name="first_name"
                                    defaultValue={editingTeacher?.first_name}
                                    required
                                    placeholder="John"
                                  />
                                </FieldGroup>
                                <FieldGroup>
                                  <FieldLabel required>Last Name</FieldLabel>
                                  <StyledInput
                                    id="last_name"
                                    name="last_name"
                                    defaultValue={editingTeacher?.last_name}
                                    required
                                    placeholder="Doe"
                                  />
                                </FieldGroup>
                              </div>
                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <FieldGroup>
                                  <FieldLabel required>Email Address</FieldLabel>
                                  <StyledInput
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="teacher@school.com"
                                    defaultValue={editingTeacher?.email}
                                    required
                                  />
                                  {editingTeacher && (
                                    <p className="text-[11px] text-slate-400">Changing email will require account reactivation.</p>
                                  )}
                                </FieldGroup>
                                <FieldGroup>
                                  <FieldLabel>Phone Number</FieldLabel>
                                  <StyledInput
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="+1234567890"
                                    defaultValue={editingTeacher?.phone || ''}
                                  />
                                </FieldGroup>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Professional</p>
                                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Qualification and specialization</h3>
                                </div>
                                <Briefcase className="h-5 w-5 text-slate-400" />
                              </div>
                              <div className="mt-4 grid gap-4">
                                <FieldGroup>
                                  <FieldLabel>Qualification</FieldLabel>
                                  <StyledInput
                                    id="qualification"
                                    name="qualification"
                                    placeholder="e.g., B.Ed, M.Sc"
                                    defaultValue={editingTeacher?.qualification}
                                  />
                                </FieldGroup>
                                <FieldGroup>
                                  <FieldLabel>Specialization</FieldLabel>
                                  <StyledInput
                                    id="specialization"
                                    name="specialization"
                                    placeholder="e.g., Mathematics, English"
                                    defaultValue={editingTeacher?.specialization}
                                  />
                                </FieldGroup>
                                <FieldGroup>
                                  <FieldLabel>Address</FieldLabel>
                                  <StyledInput id="address" name="address" defaultValue={editingTeacher?.address} placeholder="Street address" />
                                </FieldGroup>
                              </div>
                            </div>

                            {!editingTeacher && (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Optional assignment</p>
                                    <h3 className="mt-1 text-sm font-semibold text-slate-900">Assign as class teacher</h3>
                                  </div>
                                  <CalendarDays className="h-5 w-5 text-slate-400" />
                                </div>
                                <div className="mt-4">
                                  <FieldGroup>
                                    <FieldLabel>Class Teacher Assignment</FieldLabel>
                                    <StyledSelect id="class_id" name="class_id" defaultValue="">
                                      <option value="">Not assigned</option>
                                      {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id}>
                                          {cls.name}
                                        </option>
                                      ))}
                                    </StyledSelect>
                                  </FieldGroup>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto border-t border-slate-100 bg-slate-50/60 px-6 py-6 lg:border-l lg:border-t-0 sm:px-7">
                          <div className="space-y-5">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Photo</p>
                                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Teacher photo and identity</h3>
                                </div>
                                <Camera className="h-5 w-5 text-slate-400" />
                              </div>

                              <div className="mt-4 space-y-4">
                                {imagePreview && (
                                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                                    <img src={imagePreview} alt="Preview" className="h-56 w-full object-cover" />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="icon"
                                      className="absolute right-3 top-3 h-8 w-8 rounded-full"
                                      onClick={closeCameraAndClear}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}

                                {isCameraOpen && cameraStream && (
                                  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-950 p-3">
                                    <video ref={videoRef} autoPlay playsInline className="h-56 w-full rounded-xl bg-black object-cover" />
                                    <canvas ref={canvasRef} className="hidden" />
                                    <div className="flex gap-2">
                                      <Button
                                        type="button"
                                        className="flex-1 rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                                        onClick={handleCameraCapture}
                                        disabled={uploadingImage}
                                      >
                                        {uploadingImage ? 'Uploading...' : 'Capture Photo'}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                                        onClick={() => {
                                          cameraStream.getTracks().forEach((track) => track.stop());
                                          setCameraStream(null);
                                          setIsCameraOpen(false);
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {!isCameraOpen && (
                                  <div className="space-y-3">
                                    <FieldGroup>
                                      <FieldLabel>Upload from device</FieldLabel>
                                      <input
                                        id="teacher_photo_input"
                                        type="file"
                                        accept="image/*"
                                        className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-800"
                                        onChange={handleImageFileSelect}
                                        disabled={uploadingImage}
                                      />
                                      <p className="text-[11px] text-slate-400">JPG, PNG, WebP - max 5 MB</p>
                                    </FieldGroup>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="h-11 w-full rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
                                      onClick={handleCameraCapture}
                                      disabled={uploadingImage}
                                    >
                                      <Camera className="mr-2 h-4 w-4" />
                                      Open Camera
                                    </Button>
                                  </div>
                                )}

                                {uploadingImage && (
                                  <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-700">
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
                                    Uploading image...
                                  </div>
                                )}

                                {imageUrl && (
                                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                                    <UserCheck className="h-3.5 w-3.5" /> Uploaded successfully
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Status</p>
                                  <h3 className="mt-1 text-sm font-semibold text-slate-900">Employment state</h3>
                                </div>
                                <UserCheck className="h-5 w-5 text-slate-400" />
                              </div>
                              <div className="mt-4">
                                <FieldGroup>
                                  <FieldLabel>Current Status</FieldLabel>
                                  <StyledSelect id="status" name="status" defaultValue={editingTeacher?.status || 'inactive'}>
                                    <option value="active">Active</option>
                                    <option value="on_leave">On Leave</option>
                                    <option value="inactive">Inactive</option>
                                  </StyledSelect>
                                </FieldGroup>
                              </div>

                              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                  Updates to email or photo are applied immediately to the teacher profile.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-6 py-4 sm:px-7">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-xs text-slate-500">
                            Staff records are created with the same premium workflow used across the admin console.
                          </div>
                          <div className="flex gap-2 sm:justify-end">
                            <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting} className="rounded-xl">
                              Cancel
                            </Button>
                            <Button type="submit" className="rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800" disabled={isSubmitting}>
                              {isSubmitting ? 'Saving...' : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                onClick={handleExport}
                className="h-11 rounded-xl border-white/10 bg-white/5 px-5 text-sm font-semibold text-white shadow-none hover:bg-white/10 hover:text-white"
              >
                <ChevronRight className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PremiumStatCard
            title="Total Teachers"
            value={totalTeachers}
            description="Every staff profile currently in the school roster."
            icon={Users}
            accent="from-slate-900 via-slate-700 to-slate-500"
          />
          <PremiumStatCard
            title="Active Staff"
            value={activeTeachers}
            description="Teachers available for classes and assignments."
            icon={UserCheck}
            accent="from-emerald-500 via-emerald-400 to-lime-300"
          />
          <PremiumStatCard
            title="Class Teachers"
            value={classTeachers}
            description="Staff currently leading a class as class teacher."
            icon={Briefcase}
            accent="from-indigo-500 via-violet-500 to-fuchsia-500"
          />
          <PremiumStatCard
            title="Inactive"
            value={onboardingTeachers}
            description="Teachers waiting for activation or onboarding."
            icon={UserX}
            accent="from-rose-500 via-rose-400 to-orange-300"
          />
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Search & Filters</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Find staff quickly</h2>
              <p className="mt-1 text-sm text-slate-500">Search by name or staff ID, then narrow the list by employment status.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px] lg:grid-cols-2">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <StyledInput
                  placeholder="Search teachers..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
                <option value="inactive">Inactive</option>
              </StyledSelect>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">All Teachers</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Showing {filteredTeachers.length} of {totalTeachers} teachers</p>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                  {activeTeachers} active
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {subjectAssignments} subject links
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400 w-12">#</th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Teacher</th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Staff ID</th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Specialization</th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Class Teacher</th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Subjects</th>
                    <th className="text-left p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Status</th>
                    <th className="text-right p-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400 w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher, index) => (
                    <tr key={teacher.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50/80">
                      <td className="p-4 text-sm text-slate-500">{index + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-11 w-11 ring-2 ring-white shadow-sm">
                            {(teacher as any).photo_url && (
                              <img
                                src={(teacher as any).photo_url}
                                alt={`${teacher.first_name} ${teacher.last_name}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <AvatarFallback className="bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 font-semibold">
                              {getInitials(teacher.first_name, teacher.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {teacher.first_name} {teacher.last_name}
                            </p>
                            <p className="text-xs text-slate-500">{teacher.qualification || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <code className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{teacher.staff_id}</code>
                      </td>
                      <td className="p-4 text-sm text-slate-700">{teacher.specialization || 'N/A'}</td>
                      <td className="p-4">
                        {teacher.assignedClass ? (
                          <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">{teacher.assignedClass}</Badge>
                        ) : (
                          <span className="text-sm text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="p-4">
                        {teacher.subjectCount && teacher.subjectCount > 0 ? (
                          <Badge variant="secondary" className="rounded-full px-3 py-1 font-semibold">
                            {teacher.subjectCount} {teacher.subjectCount === 1 ? 'Subject' : 'Subjects'}
                          </Badge>
                        ) : (
                          <span className="text-sm text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={teacher.status === 'active' ? 'default' : 'secondary'}
                          className={`rounded-full px-3 py-1 font-semibold ${teacher.status === 'active' ? 'bg-emerald-600 text-white' : teacher.status === 'on_leave' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}
                        >
                          {teacher.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/teachers/${teacher.id}`)}
                          className="rounded-xl text-xs font-medium gap-1.5 border-slate-200 hover:bg-slate-50 hover:text-indigo-700 hover:border-indigo-200 transition-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View & Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTeachers.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-sm text-slate-500">No teachers found</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}