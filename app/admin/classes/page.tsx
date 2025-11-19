"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Teacher } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  const EDUCATION_LEVELS = [
    "Pre-Primary",
    "Primary",
    "Junior Secondary",
    "Senior Secondary",
  ];

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('created_at');
    if (data) setClasses(data);
  }

  async function fetchTeachers() {
    const { data } = await supabase.from('teachers').select('*').order('first_name');
    if (data) setTeachers(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const education_level = formData.get("education_level") as string;
    const class_group = formData.get("class_group") as string;
    const suffix = formData.get("suffix") as string;
    const teacher_id = formData.get("teacher_id") as string || null;

    const classData = {
      education_level,
      class_group,
      suffix: suffix || '',
      teacher_id: teacher_id === "" ? null : teacher_id,
    };

    // Update
    if (editingClass) {
      const { error } = await supabase
        .from("classes")
        .update(classData)
        .eq("id", editingClass.id);

      if (error) {
        toast.error("Failed to update class");
      } else {
        toast.success("Class updated successfully");
        setIsDialogOpen(false);
        setEditingClass(null);
        fetchClasses();
      }

    } else {
      // Create
      const { error } = await supabase.from("classes").insert(classData);

      if (error) {
        toast.error("Failed to create class");
      } else {
        toast.success("Class created successfully");
        setIsDialogOpen(false);
        fetchClasses();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this class?")) return;

    const { error } = await supabase.from("classes").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete class");
    } else {
      toast.success("Class deleted successfully");
      fetchClasses();
    }
  }

  function openEditDialog(cls: Class) {
    setEditingClass(cls);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingClass(null);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Classes</h1>
            <p className="text-gray-600 mt-1">Manage school classes</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingClass(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Class
              </Button>
            </DialogTrigger>

            {/* MODAL */}
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClass ? "Edit Class" : "Create New Class"}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Education Level */}
                <div>
                  <Label>Education Level</Label>
                  <select
                    name="education_level"
                    required
                    defaultValue={(editingClass as any)?.education_level || ""}
                    className="w-full h-10 px-3 border rounded"
                  >
                    <option value="">Select level</option>
                    {EDUCATION_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </div>

                {/* Class Group */}
                <div>
                  <Label>Class Group</Label>
                  <select
                    name="class_group"
                    required
                    defaultValue={editingClass?.class_group || ""}
                    className="w-full h-10 px-3 border rounded"
                  >
                    <optgroup label="Pre-Primary">
                      <option value="Creche">Creche</option>
                      <option value="Nursery 1">Nursery 1</option>
                      <option value="Nursery 2">Nursery 2</option>
                      <option value="Kindergarten 1">Kindergarten 1</option>
                      <option value="Kindergarten 2">Kindergarten 2</option>
                    </optgroup>

                    <optgroup label="Primary">
                      {[1,2,3,4,5,6].map(n => (
                        <option key={n} value={`Primary ${n}`}>
                          Primary {n}
                        </option>
                      ))}
                    </optgroup>

                    <optgroup label="Junior Secondary">
                      <option value="JSS1">JSS1</option>
                      <option value="JSS2">JSS2</option>
                      <option value="JSS3">JSS3</option>
                    </optgroup>

                    <optgroup label="Senior Secondary">
                      <option value="SS1">SS1</option>
                      <option value="SS2">SS2</option>
                      <option value="SS3">SS3</option>
                    </optgroup>
                  </select>
                </div>

                {/* Suffix */}
                <div>
                  <Label>Suffix (optional)</Label>
                  <select
                    name="suffix"
                    defaultValue={editingClass?.suffix || ""}
                    className="w-full h-10 px-3 border rounded"
                  >
                    <option value="">None</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                  </select>
                </div>

                {/* Assign Teacher */}
                <div>
                  <Label>Assign Class Teacher (optional)</Label>
                  <select
                    name="teacher_id"
                    defaultValue={editingClass?.teacher_id || ""}
                    className="w-full h-10 px-3 border rounded"
                  >
                    <option value="">None</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Form Buttons */}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingClass ? "Update Class" : "Create Class"}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* CLASS CARDS */}
        <div className="grid gap-6 md:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold">{cls.name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(cls)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cls.id)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>

                <p className="text-gray-600">{cls.education_level}</p>

                {cls.teacher_name && (
                  <p className="text-sm text-gray-500 mt-1">
                    Teacher: {cls.teacher_name}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* EMPTY STATE */}
        {classes.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No classes yet. Create your first class!</p>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
