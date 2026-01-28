"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, MoreVertical, Eye, UserCog, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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

type TeacherWithDetails = Teacher & {
  assignedClass?: string;
  assignedClassId?: string;
  assignedSubjects?: string[];
  subjectCount?: number;
};

type Class = {
  id: string;
  name: string;
  level_id: string;
};

type Subject = {
  id: string;
  name: string;
};

type SubjectClass = {
  id: string;
  subject_id: string;
  class_id: string;
  subjects?: { name: string };
  classes?: { name: string };
};

export default function TeachersPage() {
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

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
    fetchSubjects();
    fetchSubjectClasses();
  }, []);

  async function fetchTeachers() {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Fetch additional details for each teacher
      const teachersWithDetails = await Promise.all(
        data.map(async (teacher) => {
          // Get assigned class
          const { data: classData } = await supabase
            .from('classes')
            .select('id, name')
            .eq('class_teacher_id', teacher.id)
            .single();

          // Get assigned subjects from subject_classes along with class names
          const { data: subjectClassData } = await supabase
            .from('subject_classes')
            .select('subjects(name), classes(name)')
            .eq('teacher_id', teacher.id);

          return {
            ...teacher,
            assignedClass: classData?.name,
            assignedClassId: classData?.id,
            assignedSubjects:
              subjectClassData
                ?.map((sc: any) => {
                  const subj = sc?.subjects?.name;
                  const cls = sc?.classes?.name;
                  if (!subj || !cls) return null;
                  return `${String(subj).toLowerCase()}-${String(cls).toLowerCase()}`;
                })
                .filter(Boolean) || [],
            subjectCount: subjectClassData?.length || 0,
          };
        })
      );

      setTeachers(teachersWithDetails);
    }
  }

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level_id')
      .order('name');
    if (data) setClasses(data);
  }

  async function fetchSubjects() {
    const { data } = await supabase
      .from('subjects')
      .select('id, name')
      .order('name');
    if (data) setSubjects(data);
  }

  async function fetchSubjectClasses() {
    const { data } = await supabase
      .from('subject_classes')
      .select('id, subject_id, class_id, subjects(name, code), classes(name)');
    if (data) setSubjectClasses(data as any);
  }
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const teacherData = {
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      qualification: formData.get('qualification') as string,
      specialization: formData.get('specialization') as string,
      address: formData.get('address') as string,
      status: formData.get('status') as string,
    };

    if (editingTeacher) {
      const { error } = await supabase
        .from('teachers')
        .update(teacherData)
        .eq('id', editingTeacher.id);

      if (error) toast.error('Failed to update teacher');
      else {
        toast.success('Teacher updated successfully!');
        closeDialog();
        fetchTeachers();
      }
    } else {
      // Creating a new teacher - use API endpoint
      const email = formData.get('email') as string;
      const phone = formData.get('phone') as string;
      const selectedClass = formData.get('class_id') as string;

      if (!email) {
        toast.error('Email is required');
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
            },
            selectedClass: selectedClass || null,
            selectedSubjects: [],
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
      }
    }
  }


  async function handleDelete(id: string, userId?: string) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;

    const { error } = await supabase.from('teachers').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete teacher');
    } else {
      if (userId) {
        await supabase.auth.admin.deleteUser(userId);
      }
      toast.success('Teacher deleted successfully');
      fetchTeachers();
    }
  }

  async function openEditDialog(teacher: Teacher) {
    setEditingTeacher(teacher);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingTeacher(null);
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
      .eq('class_teacher_id', assigningTeacher.id);

    // Then assign to the new class (this will also remove any previous teacher from this class)
    const { error } = await supabase
      .from('classes')
      .update({ class_teacher_id: assigningTeacher.id })
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
    const subjectClassId = formData.get('subject_class_id') as string;

    if (!subjectClassId) {
      toast.error('Please select a subject class');
      return;
    }

    // Update the subject_class with the teacher (this overwrites any existing assignment)
    const { error } = await supabase
      .from('subject_classes')
      .update({ teacher_id: assigningTeacher.id })
      .eq('id', subjectClassId);

    if (error) {
      toast.error('Failed to assign subject class');
    } else {
      toast.success('Subject class assigned successfully!');
      setIsAssignSubjectDialogOpen(false);
      setAssigningTeacher(null);
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
              <Button onClick={() => setEditingTeacher(null)}>
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

                {!editingTeacher && (
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                )}

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
                  <Button type="submit" className="flex-1">
                    {editingTeacher ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
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
                              Assign Subject Class
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Teacher Details</DialogTitle>
            </DialogHeader>
            {viewingTeacher && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="bg-green-100 text-green-700 text-2xl font-semibold">
                      {getInitials(viewingTeacher.first_name, viewingTeacher.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-2xl font-bold">
                      {viewingTeacher.first_name} {viewingTeacher.last_name}
                    </h3>
                    <p className="text-gray-600">{viewingTeacher.qualification || 'N/A'}</p>
                    <Badge variant={viewingTeacher.status === 'active' ? 'default' : 'secondary'}>
                      {viewingTeacher.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-600">Staff ID</Label>
                    <p className="font-semibold">{viewingTeacher.staff_id}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Specialization</Label>
                    <p className="font-semibold">{viewingTeacher.specialization || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Email</Label>
                    <p className="font-semibold">{viewingTeacher.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-600">Phone</Label>
                    <p className="font-semibold">{viewingTeacher.phone || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-gray-600">Address</Label>
                    <p className="font-semibold">{viewingTeacher.address || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-600">Class Teacher Assignment</Label>
                  {viewingTeacher.assignedClass ? (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {viewingTeacher.assignedClass}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-gray-500 mt-2">Not assigned to any class</p>
                  )}
                </div>

                <div>
                  <Label className="text-gray-600">Subject Assignments</Label>
                  {viewingTeacher.assignedSubjects && viewingTeacher.assignedSubjects.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {viewingTeacher.assignedSubjects.map((subject, idx) => (
                        <Badge key={idx} variant="secondary" className="text-sm">
                          {subject}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 mt-2">Not assigned to any subjects</p>
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
              <DialogTitle>Assign Subject Class</DialogTitle>
            </DialogHeader>
            {assigningTeacher && (
              <form onSubmit={handleAssignSubject} className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Assigning <span className="font-semibold">{assigningTeacher.first_name} {assigningTeacher.last_name}</span> to a subject class
                  </p>
                  <Label htmlFor="subject_class_id">Select Subject Class</Label>
                  <select
                    id="subject_class_id"
                    name="subject_class_id"
                    className="w-full h-10 px-3 border rounded-md mt-1"
                    required
                  >
                    <option value="">Choose a subject class...</option>
                    {subjectClasses.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.subjects?.name} - {sc.classes?.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Note: This will replace any existing teacher assignment for this subject class.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    Assign Subject
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAssignSubjectDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}