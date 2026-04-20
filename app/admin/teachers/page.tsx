"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, MoreVertical, Eye, UserCog, BookOpen, Camera, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { TeachersSkeleton } from '@/components/skeletons';

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

type Subject = {
  id: string;
  name: string;
};

type SubjectClass = {
  teacher_id: any;
  id: string;
  subject_id: string;
  class_id: string;
  subjects?: any; // Changed to 'any' to fix type error
  classes?: any;  // Changed to 'any' to fix type error
};

export default function TeachersPage() {
  const { schoolId } = useSchoolContext();
  const [teachers, setTeachers] = useState<TeacherWithDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<TeacherWithDetails | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAssignClassDialogOpen, setIsAssignClassDialogOpen] = useState(false);
  const [isAssignSubjectDialogOpen, setIsAssignSubjectDialogOpen] = useState(false);
  const [assigningTeacher, setAssigningTeacher] = useState<Teacher | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectClasses, setSubjectClasses] = useState<SubjectClass[]>([]);
  const [selectedClassForSubject, setSelectedClassForSubject] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<{ id: string; userId?: string; name: string } | null>(null);
  
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
      fetchSubjects();
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

  async function fetchSubjects() {
    if (!schoolId) return;
    try {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name', { ascending: true });
      if (error) throw error;
      setSubjects(data || []);
    } catch (error) {
      toast.error('Failed to fetch subjects');
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
              ...(imageUrl && { image_url: imageUrl }),
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
              ...(imageUrl && { image_url: imageUrl }),
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


  async function handleDelete(id: string, userId?: string) {
    setTeacherToDelete({
      id,
      userId,
      name: teachers.find(t => t.id === id)?.first_name + ' ' + teachers.find(t => t.id === id)?.last_name || 'Teacher',
    });
    setIsDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!teacherToDelete) return;

    try {
      // Delete from teachers table
      const { error: deleteError } = await supabase
        .from('teachers')
        .delete()
        .eq('school_id', schoolId)
        .eq('id', teacherToDelete.id);

      if (deleteError) throw deleteError;

      // Delete from auth if userId exists
      if (teacherToDelete.userId) {
        try {
          await supabase.auth.admin.deleteUser(teacherToDelete.userId);
        } catch (authError) {
          console.error('Error deleting user from auth:', authError);
          // Don't fail the deletion if auth deletion fails, just log it
        }
      }

      toast.success('Teacher deleted successfully');
      setIsDeleteConfirmOpen(false);
      setTeacherToDelete(null);
      fetchTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
      toast.error('Failed to delete teacher');
    }
  }

  async function openEditDialog(teacher: Teacher) {
    setEditingTeacher(teacher);
    // Load existing image if available
    if ((teacher as any).image_url) {
      setImageUrl((teacher as any).image_url);
      setImagePreview((teacher as any).image_url);
    }
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingTeacher(null);
    setImagePreview(null);
    setImageUrl('');
    closeCameraAndClear();
  }

  async function handleAssignClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assigningTeacher) return;

    const formData = new FormData(e.currentTarget);
    const classId = formData.get('class_id') as string;

    if (!classId) {
      toast.error('Please select a class');
      return;
    }

    // First, remove this teacher from any existing class they're assigned to
    await supabase
      .from('classes')
      .update({ class_teacher_id: null })
      .eq('school_id', schoolId)
      .eq('class_teacher_id', assigningTeacher.id);

    // Then assign to the new class (this will also remove any previous teacher from this class)
    const { error } = await supabase
      .from('classes')
      .update({ class_teacher_id: assigningTeacher.id })
      .eq('school_id', schoolId)
      .eq('id', classId);

    if (error) {
      toast.error('Failed to assign class teacher');
    } else {
      toast.success('Class teacher assigned successfully!');
      setIsAssignClassDialogOpen(false);
      setAssigningTeacher(null);
      fetchTeachers();
    }
  }

  async function handleAssignSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assigningTeacher) return;

    const formData = new FormData(e.currentTarget);
    const classId = formData.get('class_id') as string;
    const subjectId = formData.get('subject_id') as string;

    if (!classId || !subjectId) {
      toast.error('Please select both a class and a subject');
      return;
    }

    // Find the subject_class that matches the selected class and subject
    const subjectClass = subjectClasses.find(
      sc => sc.class_id === classId && sc.subject_id === subjectId
    );

    if (!subjectClass) {
      toast.error('Selected subject is not available for this class');
      return;
    }

    // Update the subject_class with the teacher (this overwrites any existing assignment)
    const { error } = await supabase
      .from('subject_classes')
      .update({ teacher_id: assigningTeacher.id })
      .eq('school_id', schoolId)
      .eq('id', subjectClass.id);

    if (error) {
      toast.error('Failed to assign subject class');
    } else {
      toast.success('Subject class assigned successfully!');
      setIsAssignSubjectDialogOpen(false);
      setAssigningTeacher(null);
      setSelectedClassForSubject('');
      fetchTeachers();
      fetchSubjectClasses();
    }
  }

  function openAssignClassDialog(teacher: Teacher) {
    setAssigningTeacher(teacher);
    setIsAssignClassDialogOpen(true);
  }

  function openAssignSubjectDialog(teacher: Teacher) {
    setAssigningTeacher(teacher);
    setSelectedClassForSubject('');
    setIsAssignSubjectDialogOpen(true);
  }

  function openViewDialog(teacher: TeacherWithDetails) {
    setViewingTeacher(teacher);
    setIsViewDialogOpen(true);
  }

  function getInitials(firstName: string, lastName: string) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }

  const filteredTeachers = teachers.filter((teacher) =>
    `${teacher.first_name} ${teacher.last_name} ${teacher.staff_id}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Teachers</h1>
            <p className="text-gray-600 mt-1">Manage teaching staff</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingTeacher(null);
                setImagePreview(null);
                setImageUrl('');
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      defaultValue={editingTeacher?.first_name}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      defaultValue={editingTeacher?.last_name}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {!editingTeacher && (
                    <>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="teacher@school.com"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+1234567890"
                        />
                      </div>
                    </>
                  )}
                  {editingTeacher && (
                    <>
                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="teacher@school.com"
                          defaultValue={editingTeacher?.email}
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">Changing email will require account reactivation</p>
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+1234567890"
                          defaultValue={editingTeacher?.phone || ''}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    name="qualification"
                    placeholder="e.g., B.Ed, M.Sc"
                    defaultValue={editingTeacher?.qualification}
                  />
                </div>
                <div>
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    name="specialization"
                    placeholder="e.g., Mathematics, English"
                    defaultValue={editingTeacher?.specialization}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" defaultValue={editingTeacher?.address} />
                </div>

                {/* Teacher Photo Section */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Teacher Photo</h3>
                  <div className="flex flex-col gap-4">
                    {/* Image Preview */}
                    {imagePreview && (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            closeCameraAndClear();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Camera View */}
                    {isCameraOpen && cameraStream && (
                      <div className="relative">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-40 object-cover rounded-lg bg-black"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            cameraStream.getTracks().forEach(track => track.stop());
                            setCameraStream(null);
                            setIsCameraOpen(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {/* Upload Options */}
                    {!isCameraOpen && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => document.getElementById('teacher_photo_input')?.click()}
                          disabled={uploadingImage}
                        >
                          Upload Photo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={handleCameraCapture}
                          disabled={uploadingImage}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Take Photo
                        </Button>
                        <input
                          id="teacher_photo_input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageFileSelect}
                          disabled={uploadingImage}
                        />
                      </div>
                    )}

                    {/* Capture Button when camera is open */}
                    {isCameraOpen && cameraStream && (
                      <Button
                        type="button"
                        className="w-full"
                        onClick={handleCameraCapture}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? 'Uploading...' : 'Capture Photo'}
                      </Button>
                    )}

                    {uploadingImage && (
                      <p className="text-sm text-gray-600 text-center">Uploading image...</p>
                    )}
                  </div>
                </div>

                {!editingTeacher && (
                  <div>
                    <Label htmlFor="class_id">Assign as Class Teacher (Optional)</Label>
                    <select
                      id="class_id"
                      name="class_id"
                      className="w-full h-10 px-3 border rounded-md mt-1"
                    >
                      <option value="">Not assigned</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    className="w-full h-10 px-3 border rounded-md"
                    defaultValue={editingTeacher?.status || 'inactive'}
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : editingTeacher ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search teachers..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Teachers ({filteredTeachers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 w-12">#</th>
                    <th className="text-left p-3">Teacher</th>
                    <th className="text-left p-3">Staff ID</th>
                    <th className="text-left p-3">Specialization</th>
                    <th className="text-left p-3">Class Teacher</th>
                    <th className="text-left p-3">Subjects</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3 w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher, index) => (
                    <tr key={teacher.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            {(teacher as any).image_url && (
                              <img
                                src={(teacher as any).image_url}
                                alt={`${teacher.first_name} ${teacher.last_name}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <AvatarFallback className="bg-green-100 text-green-700 font-semibold">
                              {getInitials(teacher.first_name, teacher.last_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">
                              {teacher.first_name} {teacher.last_name}
                            </p>
                            <p className="text-xs text-gray-500">{teacher.qualification || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{teacher.staff_id}</code>
                      </td>
                      <td className="p-3">{teacher.specialization || 'N/A'}</td>
                      <td className="p-3">
                        {teacher.assignedClass ? (
                          <Badge variant="outline">{teacher.assignedClass}</Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Not assigned</span>
                        )}
                      </td>
                      <td className="p-3">
                        {teacher.subjectCount && teacher.subjectCount > 0 ? (
                          <Badge variant="secondary">
                            {teacher.subjectCount} {teacher.subjectCount === 1 ? 'Subject' : 'Subjects'}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">Not assigned</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={teacher.status === 'active' ? 'default' : 'secondary'}
                        >
                          {teacher.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openViewDialog(teacher)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAssignClassDialog(teacher)}>
                              <UserCog className="h-4 w-4 mr-2" />
                              Assign as Class Teacher
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAssignSubjectDialog(teacher)}>
                              <BookOpen className="h-4 w-4 mr-2" />
                              Assign Subject
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(teacher.id, teacher.user_id || undefined)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTeachers.length === 0 && (
                <div className="p-12 text-center">
                  <p className="text-gray-500">No teachers found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* View Teacher Details Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Teacher Details</DialogTitle>
            </DialogHeader>
            {viewingTeacher && (
              <div className="space-y-6">
                {/* Header with Avatar */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  <Avatar className="h-20 w-20">
                    {(viewingTeacher as any).image_url && (
                      <img
                        src={(viewingTeacher as any).image_url}
                        alt={`${viewingTeacher.first_name} ${viewingTeacher.last_name}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-green-100 to-green-200 text-green-700 text-2xl font-semibold">
                      {getInitials(viewingTeacher.first_name, viewingTeacher.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {viewingTeacher.first_name} {viewingTeacher.last_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{viewingTeacher.qualification || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={viewingTeacher.status === 'active' ? 'default' : 'secondary'}>
                        {viewingTeacher.status}
                      </Badge>
                      {viewingTeacher.specialization && (
                        <Badge variant="outline" className="text-xs">
                          {viewingTeacher.specialization}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Basic Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <Label className="text-xs text-gray-600 uppercase tracking-wider">Staff ID</Label>
                      <p className="font-mono font-semibold text-gray-900 mt-1">{viewingTeacher.staff_id}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <Label className="text-xs text-gray-600 uppercase tracking-wider">Email</Label>
                      <p className="font-semibold text-gray-900 mt-1 text-sm break-all">{viewingTeacher.email}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <Label className="text-xs text-gray-600 uppercase tracking-wider">Phone</Label>
                      <p className="font-semibold text-gray-900 mt-1">{viewingTeacher.phone || 'N/A'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <Label className="text-xs text-gray-600 uppercase tracking-wider">Specialization</Label>
                      <p className="font-semibold text-gray-900 mt-1 text-sm">{viewingTeacher.specialization || 'N/A'}</p>
                    </div>
                  </div>
                  {viewingTeacher.address && (
                    <div className="bg-gray-50 rounded-lg p-3 mt-3">
                      <Label className="text-xs text-gray-600 uppercase tracking-wider">Address</Label>
                      <p className="font-semibold text-gray-900 mt-1 text-sm">{viewingTeacher.address}</p>
                    </div>
                  )}
                </div>

                {/* Class Teacher Assignment */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Class Assignment</h4>
                  {viewingTeacher.assignedClass ? (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <Badge variant="outline" className="text-base px-3 py-1.5 bg-white border-blue-300">
                        {viewingTeacher.assignedClass}
                      </Badge>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-gray-500 text-sm">Not assigned to any class</p>
                    </div>
                  )}
                </div>

                {/* Subject Assignments */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Subject Teaching</h4>
                  {viewingTeacher.subjectAssignmentsByClass && viewingTeacher.subjectAssignmentsByClass.length > 0 ? (
                    <div className="space-y-3">
                      {viewingTeacher.subjectAssignmentsByClass.map((assignment, classIdx) => (
                        <div key={classIdx} className="bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
                          <div className="bg-amber-100 px-4 py-2 border-b border-amber-200">
                            <h5 className="font-semibold text-amber-900 text-sm">{assignment.className}</h5>
                          </div>
                          <div className="p-3 flex flex-wrap gap-2">
                            {assignment.subjects.map((subject, subjIdx) => (
                              <Badge key={subjIdx} variant="secondary" className="bg-amber-200 text-amber-900 font-medium">
                                {subject.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <p className="text-gray-500 text-sm">Not assigned to any subjects</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Assign Class Teacher Dialog */}
        <Dialog open={isAssignClassDialogOpen} onOpenChange={setIsAssignClassDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Class Teacher</DialogTitle>
            </DialogHeader>
            {assigningTeacher && (
              <form onSubmit={handleAssignClass} className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Assigning <span className="font-semibold">{assigningTeacher.first_name} {assigningTeacher.last_name}</span> as class teacher
                  </p>
                  <Label htmlFor="class_id">Select Class</Label>
                  <select
                    id="class_id"
                    name="class_id"
                    className="w-full h-10 px-3 border rounded-md mt-1"
                    required
                  >
                    <option value="">Choose a class...</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Note: This will replace any existing class teacher assignment for both the teacher and the class.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Assign Class
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAssignClassDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Assign Subject Class Dialog */}
        <Dialog open={isAssignSubjectDialogOpen} onOpenChange={setIsAssignSubjectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Subject</DialogTitle>
            </DialogHeader>
            {assigningTeacher && (
              <form onSubmit={handleAssignSubject} className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Assigning <span className="font-semibold">{assigningTeacher.first_name} {assigningTeacher.last_name}</span> to a subject
                  </p>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="class_id">Select Class</Label>
                      <select
                        id="class_id"
                        name="class_id"
                        className="w-full h-10 px-3 border rounded-md mt-1"
                        value={selectedClassForSubject}
                        onChange={(e) => setSelectedClassForSubject(e.target.value)}
                        required
                      >
                        <option value="">Choose a class...</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedClassForSubject && (
                      <div>
                        <Label htmlFor="subject_id">Select Subject</Label>
                        <select
                          id="subject_id"
                          name="subject_id"
                          className="w-full h-10 px-3 border rounded-md mt-1"
                          required
                        >
                          <option value="">Choose a subject...</option>
                          {subjectClasses
                            .filter(sc => sc.class_id === selectedClassForSubject)
                            .map((sc) => (
                              <option key={sc.id} value={sc.subject_id}>
                                {sc.subjects?.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    Note: This will replace any existing teacher assignment for this subject.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={!selectedClassForSubject}>
                    Assign Subject
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAssignSubjectDialogOpen(false);
                      setSelectedClassForSubject('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Teacher</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete <span className="font-semibold text-red-600">{teacherToDelete?.name}</span>?
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  This action will permanently remove the teacher and their user account. This cannot be undone.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={confirmDelete}
                >
                  Delete
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setTeacherToDelete(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}