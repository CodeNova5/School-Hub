"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Class as ClassType, Subject } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, FileText } from 'lucide-react';

interface AssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  teacherId: string;
}

export function AssignmentModal({ open, onClose, onSave, teacherId }: AssignmentModalProps) {
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadClasses();
    }
  }, [open]);

  useEffect(() => {
    if (selectedClass) {
      loadSubjects();
    }
  }, [selectedClass]);

  async function loadClasses() {
    try {
      const { data } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('teacher_id', teacherId);

      if (data) {
        const classIds = data.map(tc => tc.class_id);
        const { data: classesData } = await supabase
          .from('classes')
          .select('*')
          .in('id', classIds)
          .order('name');

        setClasses(classesData || []);
      }
    } catch (error: any) {
      toast.error('Failed to load classes: ' + error.message);
    }
  }

  async function loadSubjects() {
    try {
      const { data: classData } = await supabase
        .from('classes')
        .select('education_level, department')
        .eq('id', selectedClass)
        .single();

      if (!classData) return;

      let query = supabase
        .from('subjects')
        .select('*')
        .eq('education_level', classData.education_level);

      if (classData.education_level === 'SSS' && classData.department) {
        query = query.eq('department', classData.department);
      }

      const { data } = await query.order('name');
      setSubjects(data || []);
    } catch (error: any) {
      toast.error('Failed to load subjects: ' + error.message);
    }
  }

  async function handleSave() {
    if (!selectedClass || !selectedSubject || !title || !dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .insert({
          teacher_id: teacherId,
          class_id: selectedClass,
          subject_id: selectedSubject,
          title,
          description,
          instructions,
          due_date: dueDate,
        });

      if (error) throw error;

      toast.success('Assignment created successfully');
      setTitle('');
      setDescription('');
      setInstructions('');
      setDueDate('');
      setSelectedSubject('');
      setSelectedClass('');
      onSave();
      onClose();
    } catch (error: any) {
      toast.error('Failed to create assignment: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Assignment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Class *</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select a class</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject *</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={!selectedClass}
                className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
              >
                <option value="">Select a subject</option>
                {subjects.map(sub => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <Input
              placeholder="e.g., Chapter 5 Exercise"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              placeholder="Brief description of the assignment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Instructions</label>
            <Textarea
              placeholder="Detailed instructions for the assignment..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Due Date *</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Assignment'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
