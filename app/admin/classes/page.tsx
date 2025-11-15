"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Class, Session } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  useEffect(() => {
    fetchClasses();
    fetchSessions();
  }, []);

  async function fetchClasses() {
    const { data } = await supabase.from('classes').select('*').order('name');
    if (data) setClasses(data);
  }

  async function fetchSessions() {
    const { data } = await supabase.from('sessions').select('*').order('start_date', { ascending: false });
    if (data) setSessions(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const classData = {
      name: formData.get('name') as string,
      level: formData.get('level') as string,
      capacity: parseInt(formData.get('capacity') as string),
      session_id: formData.get('session_id') as string || null,
    };

    if (editingClass) {
      const { error } = await supabase
        .from('classes')
        .update(classData)
        .eq('id', editingClass.id);

      if (error) {
        toast.error('Failed to update class');
      } else {
        toast.success('Class updated successfully');
        setIsDialogOpen(false);
        setEditingClass(null);
        fetchClasses();
      }
    } else {
      const { error } = await supabase.from('classes').insert(classData);

      if (error) {
        toast.error('Failed to create class');
      } else {
        toast.success('Class created successfully');
        setIsDialogOpen(false);
        fetchClasses();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this class?')) return;

    const { error } = await supabase.from('classes').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete class');
    } else {
      toast.success('Class deleted successfully');
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Create New Class'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Class Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Grade 1A, JSS 2"
                    defaultValue={editingClass?.name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="level">Level</Label>
                  <Input
                    id="level"
                    name="level"
                    placeholder="e.g., Primary, Junior Secondary"
                    defaultValue={editingClass?.level}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    placeholder="30"
                    defaultValue={editingClass?.capacity}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="session_id">Session (Optional)</Label>
                  <select
                    id="session_id"
                    name="session_id"
                    className="w-full h-10 px-3 border rounded-md"
                    defaultValue={editingClass?.session_id || ''}
                  >
                    <option value="">None</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingClass ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {classes.map((cls) => (
            <Card key={cls.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold">{cls.name}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(cls)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(cls.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600">{cls.level}</p>
                <p className="text-sm text-gray-500 mt-2">Capacity: {cls.capacity}</p>
              </CardContent>
            </Card>
          ))}
        </div>

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
