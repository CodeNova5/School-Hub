"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Class } from '@/lib/types';
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

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, []);

  async function fetchStudents() {
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setStudents(data);
  }

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const studentData = {
      student_id: formData.get('student_id') as string,
      first_name: formData.get('first_name') as string,
      last_name: formData.get('last_name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      gender: formData.get('gender') as string,
      address: formData.get('address') as string,
      class_id: formData.get('class_id') as string || null,
      department: formData.get('department') as string,
      parent_name: formData.get('parent_name') as string,
      parent_email: formData.get('parent_email') as string,
      parent_phone: formData.get('parent_phone') as string,
      status: formData.get('status') as string,
    };

    if (editingStudent) {
      const { error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', editingStudent.id);

      if (error) {
        toast.error('Failed to update student');
      } else {
        toast.success('Student updated successfully');
        setIsDialogOpen(false);
        setEditingStudent(null);
        fetchStudents();
      }
    } else {
      const { error } = await supabase.from('students').insert(studentData);

      if (error) {
        toast.error('Failed to create student');
      } else {
        toast.success('Student created successfully');
        setIsDialogOpen(false);
        fetchStudents();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this student?')) return;

    const { error } = await supabase.from('students').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete student');
    } else {
      toast.success('Student deleted successfully');
      fetchStudents();
    }
  }

  function openEditDialog(student: Student) {
    setEditingStudent(student);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingStudent(null);
  }

  const filteredStudents = students.filter(student =>
    `${student.first_name} ${student.last_name} ${student.student_id}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-gray-600 mt-1">Manage student records</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingStudent(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input id="first_name" name="first_name" defaultValue={editingStudent?.first_name} required />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input id="last_name" name="last_name" defaultValue={editingStudent?.last_name} required />
                  </div>
                </div>
                <div>
                  <Label htmlFor="student_id">Student ID</Label>
                  <Input id="student_id" name="student_id" placeholder="e.g., STU001" defaultValue={editingStudent?.student_id} required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingStudent?.email} />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={editingStudent?.phone} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <select id="gender" name="gender" className="w-full h-10 px-3 border rounded-md" defaultValue={editingStudent?.gender || ''}>
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="class_id">Class</Label>
                  <select id="class_id" name="class_id" className="w-full h-10 px-3 border rounded-md" defaultValue={editingStudent?.class_id || ''}>
                    <option value="">Select class</option>
                    {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input id="department" name="department" defaultValue={editingStudent?.department} />
                  <select id="department" name="department" className="w-full h-10 px-3 border rounded-md" defaultValue={editingStudent?.department || ''}>
                    <option value="">Select department</option>
                    <option value="science">Science</option>
                    <option value="arts">Arts</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" defaultValue={editingStudent?.address} />
                </div>
                <div>
                  <Label htmlFor="parent_name">Parent Name</Label>
                  <Input id="parent_name" name="parent_name" defaultValue={editingStudent?.parent_name} required />
                </div>
                <div>
                  <Label htmlFor="parent_email">Parent Email</Label>
                  <Input id="parent_email" name="parent_email" type="email" defaultValue={editingStudent?.parent_email} required />
                </div>
                <div>
                  <Label htmlFor="parent_phone">Parent Phone</Label>
                  <Input id="parent_phone" name="parent_phone" defaultValue={editingStudent?.parent_phone} required />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <select id="status" name="status" className="w-full h-10 px-3 border rounded-md" defaultValue={editingStudent?.status || 'active'}>
                    <option value="active">Active</option>
                    <option value="graduated">Graduated</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">{editingStudent ? 'Update' : 'Create'}</Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search students..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredStudents.map((student) => (
            <Card key={student.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-700">
                        {student.first_name[0]}{student.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {student.first_name} {student.last_name}
                      </h3>
                      <p className="text-sm text-gray-600">{student.student_id}</p>
                      <Badge className="mt-2" variant={student.status === 'active' ? 'default' : 'secondary'}>
                        {student.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(student)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(student.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium">{student.email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Parent:</span>
                    <p className="font-medium">{student.parent_name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredStudents.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No students found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
