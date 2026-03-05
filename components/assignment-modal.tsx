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
  schoolId?: string | null;
}

export function AssignmentModal({ open, onClose, onSave, teacherId, assignment, schoolId }: AssignmentModalProps) {
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
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!assignment;

  useEffect(() => {
    if (!open) return;
    loadClasses();

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
      setExistingFileUrl(assignment.file_url || null);
      // Load subjects after class is set
      if (assignment.class_id) {
        loadSubjects(assignment.class_id);
      }
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
      setExistingFileUrl(null);
    }
  }, [open, assignment]);

  useEffect(() => {
    if (selectedClass && !isEditing) {
      loadSubjects(selectedClass);
    }
  }, [selectedClass]);

  async function loadClasses() {
    let query = supabase
      .from('subject_classes')
      .select('class_id, classes(id, name, level, education_level)')
      .eq('teacher_id', teacherId);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data } = await query;

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

  async function loadSubjects(classId: string) {
    if (!classId) {
      setSubjects([]);
      return;
    }

    // Load only subjects that this teacher teaches for the selected class
    let query = supabase
      .from('subject_classes')
      .select('subject_id, subjects(id, name, education_level, department, religion)')
      .eq('teacher_id', teacherId)
      .eq('class_id', classId);

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data } = await query;

    if (!data) return;

    const subjectsData = data
      .map((item: any) => item.subjects)
      .filter((s: any): s is Subject => s !== null);

    setSubjects(subjectsData);
  }

  async function handleSave() {
    if (
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
      // Get current session and term
      let sessionQuery = supabase
        .from('sessions')
        .select('id')
        .eq('is_current', true);

      let termQuery = supabase
        .from('terms')
        .select('id')
        .eq('is_current', true);

      if (schoolId) {
        sessionQuery = sessionQuery.eq('school_id', schoolId);
        termQuery = termQuery.eq('school_id', schoolId);
      }

      const { data: currentSession } = await sessionQuery.single();
      const { data: currentTerm } = await termQuery.single();

      if (!currentSession || !currentTerm) {
        toast.error('No active session or term found');
        setIsSaving(false);
        return;
      }

      const assignmentPayload: any = {
        teacher_id: teacherId,
        session_id: isEditing ? assignment.session_id : currentSession.id,
        term_id: isEditing ? assignment.term_id : currentTerm.id,
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

      if (schoolId) {
        assignmentPayload.school_id = schoolId;
      }

      let assignmentData;
      let assignmentId;

      if (isEditing) {
        // Update existing assignment
        let updateQuery = supabase
          .from('assignments')
          .update(assignmentPayload)
          .eq('id', assignment.id);

        if (schoolId) {
          updateQuery = updateQuery.eq('school_id', schoolId);
        }

        const { data, error: updateError } = await updateQuery
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
        isFullyGraded: assignmentData.assignment_submissions?.length > 0 && assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length === assignmentData.assignment_submissions?.length,
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
          <Select value={selectedClass} onValueChange={(value) => {
            setSelectedClass(value);
            setSelectedSubject('');
            loadSubjects(value);
          }}>
            <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
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

          {existingFileUrl && !file && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Current File:</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (isEditing && assignment?.id) {
                      try {
                        let updateQuery = supabase
                          .from('assignments')
                          .update({ file_url: null })
                          .eq('id', assignment.id);

                        if (schoolId) {
                          updateQuery = updateQuery.eq('school_id', schoolId);
                        }

                        const { error } = await updateQuery;

                        if (error) throw error;
                        toast.success('File removed');
                      } catch (error: any) {
                        toast.error('Failed to remove file');
                        return;
                      }
                    }
                    setExistingFileUrl(null);
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
              {existingFileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={existingFileUrl} alt="Preview" className="max-h-48 rounded border" />
              ) : existingFileUrl.match(/\.pdf$/i) ? (
                <iframe src={existingFileUrl} className="w-full h-48 rounded border" />
              ) : (
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <a href={existingFileUrl} target="_blank" className="text-sm text-primary hover:underline">
                    View File
                  </a>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer border rounded-md p-3 hover:bg-muted transition">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {file ? file.name : existingFileUrl ? "Replace file" : "Upload PDF, DOC, Image, etc."}
            </span>
            <input
              type="file"
              hidden
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) {
                  setFile(selectedFile);
                  setExistingFileUrl(null);
                }
              }}
            />
          </label>

          {file && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">New File Selected:</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
              {file.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-48 rounded border" />
              ) : file.type === 'application/pdf' ? (
                <iframe src={URL.createObjectURL(file)} className="w-full h-48 rounded border" />
              ) : (
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm">{file.name}</span>
                </div>
              )}
            </div>
          )}
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