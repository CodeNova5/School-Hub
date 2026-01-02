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
  onSave: (assignment: any) => void;

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
  const [file, setFile] = useState<File | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);

  const [selectedSession, setSelectedSession] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');


  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadClasses();
    loadSessions();
  }, [open]);

  useEffect(() => {
    if (!selectedSession) return;
    loadTerms();
  }, [selectedSession]);


  useEffect(() => {
    if (selectedClass) loadSubjects();
  }, [selectedClass]);

  async function loadSessions() {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      toast.error("Failed to load sessions");
      return;
    }

    setSessions(data || []);
  }

  async function loadTerms() {
    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .eq('session_id', selectedSession)
      .order('start_date');

    if (error) {
      toast.error("Failed to load terms");
      return;
    }

    setTerms(data || []);
  }


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
    if (
      !selectedSession ||
      !selectedTerm ||
      !selectedClass ||
      !selectedSubject ||
      !title ||
      !dueDate
    ) {
      toast.error('Please fill all required fields');
      return;
    }


    setIsSaving(true);

    try {
      // 1. Create assignment record without file_url
      const { data: assignmentData, error: insertError } = await supabase
        .from('assignments')
        .insert({
          teacher_id: teacherId,
          session_id: selectedSession,
          term_id: selectedTerm,
          class_id: selectedClass,
          subject_id: selectedSubject,
          title,
          description,
          instructions,
          due_date: dueDate,
          total_marks: totalMarks,
          submission_type: submissionType,
          allow_late_submission: allowLate,
        })
        .select(`
    *,
    classes(name),
    subjects(name)
  `)
        .single();


      if (insertError) throw insertError;
      const assignmentId = assignmentData.id;

      // 2. If a file is selected, upload it
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "teacher_assignment_file");
        formData.append("assignment_id", assignmentId);

        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "File upload failed");
        }

        const { fileUrl } = await res.json();

        // 3. Update the assignment with the file_url
        const { error: updateError } = await supabase
          .from('assignments')
          .update({ file_url: fileUrl })
          .eq('id', assignmentId);

        if (updateError) throw updateError;
      }

      toast.success("Assignment created");
      onSave({
        ...assignmentData,
        assignment_submissions: [],
        submissionCount: 0,
        gradedCount: 0,
        isFullyGraded: false,
        hasPendingGrading: false,
        isOverdue: new Date(assignmentData.due_date) < new Date(),
      });
      onClose();

      onClose();

    } catch (error: any) {
      toast.error(error.message || 'Failed to create assignment');
    } finally {
      setIsSaving(false);
    }
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
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger>
              <SelectValue placeholder="Select Session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedTerm}
            onValueChange={setSelectedTerm}
            disabled={!selectedSession}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>


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
        <div className="space-y-2">
          <label className="text-sm font-medium">Attach file (Optional)</label>
          <label className="flex items-center gap-3 cursor-pointer border rounded-md p-3 hover:bg-muted transition">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{file ? file.name : "Upload PDF, DOC, Image, etc."}</span>
            <input
              type="file"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>


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