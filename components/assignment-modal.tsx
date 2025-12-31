"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Class as ClassType, Subject } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, FileText, Upload } from 'lucide-react';

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

  const [submissionType, setSubmissionType] = useState<'text' | 'file' | 'both'>('text');
  const [totalMarks, setTotalMarks] = useState(20);
  const [allowLate, setAllowLate] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) loadClasses();
  }, [open]);

  useEffect(() => {
    if (selectedClass) loadSubjects();
  }, [selectedClass]);

  async function loadClasses() {
    const { data } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', teacherId);

    if (!data) return;

    const classIds = data.map((c) => c.class_id);
    const { data: classesData } = await supabase
      .from('classes')
      .select('*')
      .in('id', classIds);

    setClasses(classesData || []);
  }

  async function loadSubjects() {
    const { data } = await supabase
      .from('subjects')
      .select('*')
      .order('name');

    setSubjects(data || []);
  }

  async function handleSave() {
    if (!selectedClass || !selectedSubject || !title || !dueDate) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('assignments').insert({
      teacher_id: teacherId,
      class_id: selectedClass,
      subject_id: selectedSubject,
      title,
      description,
      instructions,
      due_date: dueDate,
      submission_type: submissionType,
      total_marks: totalMarks,
      allow_late_submission: allowLate,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Assignment created');
      onSave();
      onClose();
    }

    setIsSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Assignment
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <Select onValueChange={setSelectedClass}>
            <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={setSelectedSubject}>
            <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input placeholder="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Textarea placeholder="Detailed instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Submission Type</label>
          <Select value={submissionType} onValueChange={(v: any) => setSubmissionType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text Answer</SelectItem>
              <SelectItem value="file">File Upload (PDF / Image)</SelectItem>
              <SelectItem value="both">Text + File</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowLate} onChange={() => setAllowLate(!allowLate)} />
          Allow late submissions
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Assignment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}