"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, MoreVertical, Eye } from 'lucide-react';
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
  assignedSubjects?: string[];
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherWithDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    fetchTeachers();
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
            .select('name')
            .eq('class_teacher_id', teacher.id)
            .single();

          // Get assigned subjects from subject_classes
          const { data: subjectClassData } = await supabase
            .from('subject_classes')
            .select('subjects(name)')
            .eq('teacher_id', teacher.id);

          return {
            ...teacher,
            assignedClass: classData?.name,
            assignedSubjects: subjectClassData?.map((sc: any) => sc.subjects?.name).filter(Boolean) || [],
          };
        })
      );

      setTeachers(teachersWithDetails);
    }
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
      const { data, error } = await supabase.from('teachers').insert([teacherData]);

      if (error) toast.error('Failed to create teacher');
      else {
        toast.success('Teacher created successfully!');
        closeDialog();
        fetchTeachers();
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
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    className="w-full h-10 px-3 border rounded-md"
                    defaultValue={editingTeacher?.status || 'active'}
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
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Phone</th>
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
                      <td className="p-3 text-sm">{teacher.email}</td>
                      <td className="p-3 text-sm">{teacher.phone || 'N/A'}</td>
                      <td className="p-3">
                        {teacher.assignedClass ? (
                          <Badge variant="outline">{teacher.assignedClass}</Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {teacher.assignedSubjects && teacher.assignedSubjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {teacher.assignedSubjects.slice(0, 2).map((subject, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {subject}
                              </Badge>
                            ))}
                            {teacher.assignedSubjects.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{teacher.assignedSubjects.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
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
                            <DropdownMenuItem onClick={() => openEditDialog(teacher)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
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
      </div>
    </DashboardLayout>
  );
}