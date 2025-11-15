"use client";

import { DashboardLayout } from '@/components/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Subject } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  useEffect(() => {
    fetchSubjects();
  }, []);

  async function fetchSubjects() {
    const { data } = await supabase.from('subjects').select('*').order('name');
    if (data) setSubjects(data);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const subjectData = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      description: formData.get('description') as string,
    };

    if (editingSubject) {
      const { error } = await supabase
        .from('subjects')
        .update(subjectData)
        .eq('id', editingSubject.id);

      if (error) {
        toast.error('Failed to update subject');
      } else {
        toast.success('Subject updated successfully');
        setIsDialogOpen(false);
        setEditingSubject(null);
        fetchSubjects();
      }
    } else {
      const { error } = await supabase.from('subjects').insert(subjectData);

      if (error) {
        toast.error('Failed to create subject');
      } else {
        toast.success('Subject created successfully');
        setIsDialogOpen(false);
        fetchSubjects();
      }
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subject?')) return;

    const { error } = await supabase.from('subjects').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete subject');
    } else {
      toast.success('Subject deleted successfully');
      fetchSubjects();
    }
  }

  function openEditDialog(subject: Subject) {
    setEditingSubject(subject);
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
    setEditingSubject(null);
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Subjects</h1>
            <p className="text-gray-600 mt-1">Manage school subjects</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingSubject(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSubject ? 'Edit Subject' : 'Create New Subject'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Subject Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Mathematics"
                    defaultValue={editingSubject?.name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="code">Subject Code</Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="e.g., MATH101"
                    defaultValue={editingSubject?.code}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Brief description of the subject"
                    defaultValue={editingSubject?.description}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingSubject ? 'Update' : 'Create'}
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
          {subjects.map((subject) => (
            <Card key={subject.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-xl font-bold">{subject.name}</h3>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(subject)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subject.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
                <p className="text-gray-600 font-mono text-sm">{subject.code}</p>
                <p className="text-sm text-gray-500 mt-2">{subject.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {subjects.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">No subjects yet. Create your first subject!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
