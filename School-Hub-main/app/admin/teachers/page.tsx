"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Teacher, Class } from '@/lib/types';
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

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchTeachers();
    fetchClasses();
  }, []);

  async function fetchTeachers() {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setTeachers(data);
  }

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  }

  async function loadTeacherClasses(teacherId: string) {
    const { data } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', teacherId);

    if (data) {
      setSelectedClasses(data.map((tc) => tc.class_id));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const teacherData = {
      staff_id: formData.get('staff_id') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      email,
      phone: formData.get('phone') as string,
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

      if (error) {
        toast.error('Failed to update teacher');
        return;
      }

      await supabase.from('teacher_classes').delete().eq('teacher_id', editingTeacher.id);

      if (selectedClasses.length > 0) {
        const classAssignments = selectedClasses.map((classId) => ({
          teacher_id: editingTeacher.id,
          class_id: classId,
          session_id: null,
        }));

        await supabase.from('teacher_classes').insert(classAssignments);
      }

      toast.success('Teacher updated successfully');
      setIsDialogOpen(false);
      setEditingTeacher(null);
      setSelectedClasses([]);
      fetchTeachers();
    } else {
      if (!password) {
        toast.error('Password is required for new teachers');
        return;
      }

      const savingToast = toast.loading('Creating teacher account...');

      try {
        const res = await fetch("/api/create-teacher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            teacherData,
            selectedClasses
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          toast.error(json.error || "Failed to create teacher", { id: savingToast });
          return;
        }

        toast.success("Teacher created successfully!", { id: savingToast });
        setIsDialogOpen(false);
        setSelectedClasses([]);
        fetchTeachers();

      } catch (error: any) {
        toast.error(error.message || "Failed to create teacher", { id: savingToast });
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
    await loadTeacherClasses(teacher.id);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingTeacher(null);
    setSelectedClasses([]);
  }

  function toggleClassSelection(classId: string) {
    setSelectedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  }

  const filteredTeachers = teachers.filter((teacher) =>
    `${teacher.first_name} ${teacher.last_name} ${teacher.staff_id}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
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
                  <Label htmlFor="staff_id">Staff ID</Label>
                  <Input
                    id="staff_id"
                    name="staff_id"
                    placeholder="e.g., TCH001"
                    defaultValue={editingTeacher?.staff_id}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingTeacher?.email}
                    required
                  />
                </div>
                {!editingTeacher && (
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Create a password"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Teacher will use this to log in
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editingTeacher?.phone} />
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
                  <Label>Assign Classes</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {classes.map((cls) => (
                      <label key={cls.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedClasses.includes(cls.id)}
                          onChange={() => toggleClassSelection(cls.id)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{cls.name}</span>
                      </label>
                    ))}
                    {classes.length === 0 && (
                      <p className="text-sm text-gray-500">No classes available</p>
                    )}
                  </div>
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

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeachers.map((teacher) => (
            <Card key={teacher.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-lg font-semibold text-green-700">
                        {teacher.first_name[0]}
                        {teacher.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {teacher.first_name} {teacher.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{teacher.staff_id}</p>
                      <Badge
                        className="mt-2"
                        variant={teacher.status === 'active' ? 'default' : 'secondary'}
                      >
                        {teacher.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(teacher)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(teacher.id, teacher.user_id || undefined)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Specialization:</span>
                    <p className="font-medium">{teacher.specialization || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium">{teacher.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <p className="font-medium">{teacher.phone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTeachers.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No teachers found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
