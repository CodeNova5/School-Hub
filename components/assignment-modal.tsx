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
  assignment?: any; // If provided, we're editing
}

export function AssignmentModal({ open, onClose, onSave, teacherId, assignment }: AssignmentModalProps) {
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
  const isEditing = !!assignment;

  useEffect(() => {
    if (!open) return;
    loadClasses();
    loadSessions();

    // Pre-fill form if editing
    if (assignment) {
      setSelectedClass(assignment.class_id || '');
      setSelectedSubject(assignment.subject_id || '');
      setTitle(assignment.title || '');
      setDescription(assignment.description || '');
      setInstructions(assignment.instructions || '');
      setDueDate(assignment.due_date?.split('T')[0] || '');
      setSubmissionType(assignment.submission_type || 'text');
      setTotalMarks(assignment.total_marks || 20);
      setAllowLate(assignment.allow_late_submission || false);
      setSelectedSession(assignment.session_id || '');
      setSelectedTerm(assignment.term_id || '');
    } else {
      // Reset form for new assignment
      setSelectedClass('');
      setSelectedSubject('');
      setTitle('');
      setDescription('');
      setInstructions('');
      setDueDate('');
      setSubmissionType('text');
      setTotalMarks(20);
      setAllowLate(false);
      setFile(null);
      setSelectedSession('');
      setSelectedTerm('');
    }
  }, [open, assignment]);

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
      .from('subject_classes')
      .select('class_id, classes(id, name, level, education_level)')
      .eq('teacher_id', teacherId);

    if (!data) return;

    // Extract unique classes
    const uniqueClasses = new Map<string, ClassType>();
    data.forEach((item: any) => {
      if (item.classes) {
        uniqueClasses.set(item.classes.id, item.classes);
      }
    });

    setClasses(Array.from(uniqueClasses.values()));
  }

  async function loadSubjects() {
    if (!selectedClass) {
      setSubjects([]);
      return;
    }

    // Load only subjects that this teacher teaches for the selected class
    const { data } = await supabase
      .from('subject_classes')
      .select('subject_id, subjects(id, name, education_level, department, religion)')
      .eq('teacher_id', teacherId)
      .eq('class_id', selectedClass);

    if (!data) return;

    const subjectsData = data
      .map((item: any) => item.subjects)
      .filter((s): s is Subject => s !== null);

    setSubjects(subjectsData);
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
      const assignmentPayload = {
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
      };

      let assignmentData;
      let assignmentId;

      if (isEditing) {
        // Update existing assignment
        const { data, error: updateError } = await supabase
          .from('assignments')
          .update(assignmentPayload)
          .eq('id', assignment.id)
          .select(`
            *,
            classes(name),
            subjects(name),
            assignment_submissions(id, grade)
          `)
          .single();

        if (updateError) throw updateError;
        assignmentData = data;
        assignmentId = assignment.id;
      } else {
        // Create new assignment
        const { data, error: insertError } = await supabase
          .from('assignments')
          .insert(assignmentPayload)
          .select(`
            *,
            classes(name),
            subjects(name)
          `)
          .single();

        if (insertError) throw insertError;
        assignmentData = data;
        assignmentId = data.id;
      }

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

        // Update local data
        assignmentData.file_url = fileUrl;
      }

      toast.success(isEditing ? "Assignment updated" : "Assignment created");

      // Prepare data for parent component
      const normalizedData = {
        ...assignmentData,
        assignment_submissions: assignmentData.assignment_submissions || [],
        submissionCount: assignmentData.assignment_submissions?.length || 0,
        gradedCount: assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length || 0,
        isFullyGraded: assignmentData.assignment_submissions?.length > 0 && 
                       assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length === assignmentData.assignment_submissions?.length,
        hasPendingGrading: (assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length || 0) < (assignmentData.assignment_submissions?.length || 0),
        isOverdue: new Date(assignmentData.due_date) < new Date(),
      };

      onSave(normalizedData);
      onClose();

    } catch (error: any) {
      toast.error(error.message || `Failed to ${isEditing ? 'update' : 'create'} assignment`);
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
            {isEditing ? 'Edit Assignment' : 'Create Assignment'}
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
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditing ? 'Update Assignment' : 'Create Assignment')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}