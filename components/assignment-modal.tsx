"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Class as ClassType, Subject, SelectedQuizQuestion } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, FileText, Upload, BookOpen } from 'lucide-react';
import { AssignmentQuizBuilder } from '@/components/assignment-quiz-builder';

interface AssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (assignment: any) => void;
  teacherId: string;
  assignment?: any;
  schoolId?: string | null;
}

export function AssignmentModal({ open, onClose, onSave, teacherId, assignment, schoolId }: AssignmentModalProps) {
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjectClassId, setSubjectClassId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submissionType, setSubmissionType] = useState<'text' | 'file' | 'both' | 'objective'>('text');
  const [totalMarks, setTotalMarks] = useState(20);
  const [allowLate, setAllowLate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<SelectedQuizQuestion[]>([]);
  const [quizConfig, setQuizConfig] = useState({
    shuffle_questions: true,
    time_limit_minutes: null as number | null,
    allow_retake: false,
    show_results_immediately: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loadingExistingQuiz, setLoadingExistingQuiz] = useState(false);
  const [resolvingSubjectClass, setResolvingSubjectClass] = useState(false);
  const isEditing = !!assignment;

  useEffect(() => {
    if (!open) return;
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
      setQuizQuestions([]);
      setQuizConfig({ shuffle_questions: true, time_limit_minutes: null, allow_retake: false, show_results_immediately: true });
      setSubjectClassId(null);
      setFile(null);
      if (assignment.class_id) loadSubjects(assignment.class_id);
      if (assignment.submission_type === 'objective') loadExistingQuizConfig(assignment.id);
    } else {
      setSelectedClass(''); setSelectedSubject(''); setSubjectClassId(null);
      setTitle(''); setDescription(''); setInstructions(''); setDueDate('');
      setSubmissionType('text'); setTotalMarks(20); setAllowLate(false);
      setFile(null); setExistingFileUrl(null);
      setQuizQuestions([]);
      setQuizConfig({ shuffle_questions: true, time_limit_minutes: null, allow_retake: false, show_results_immediately: true });
    }
  }, [open]);

  useEffect(() => {
    if (!open || !schoolId) return;
    loadClasses();
  }, [open, schoolId]);

  useEffect(() => {
    if (selectedClass && !isEditing) loadSubjects(selectedClass);
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !schoolId) {
      setSubjectClassId(null);
      return;
    }
    async function resolveSubjectClass() {
      setResolvingSubjectClass(true);
      try {
        const { data, error } = await supabase
          .from('subject_classes').select('id')
          .eq('school_id', schoolId).eq('class_id', selectedClass).eq('subject_id', selectedSubject)
          .maybeSingle();
        if (error) throw error;
        setSubjectClassId(data?.id || null);
      } catch { setSubjectClassId(null); }
      finally { setResolvingSubjectClass(false); }
    }
    resolveSubjectClass();
  }, [selectedClass, selectedSubject, schoolId]);

  async function loadExistingQuizConfig(assignmentId: string) {
    setLoadingExistingQuiz(true);
    try {
      const { data: config } = await supabase
        .from('assignment_quiz_config').select('*').eq('assignment_id', assignmentId).maybeSingle();
      if (config) setQuizConfig({
        shuffle_questions: config.shuffle_questions,
        time_limit_minutes: config.time_limit_minutes,
        allow_retake: config.allow_retake,
        show_results_immediately: config.show_results_immediately,
      });
      const { data: questions } = await supabase
        .from('assignment_quiz_questions')
        .select('question_id, marks, display_order')
        .eq('assignment_id', assignmentId)
        .order('display_order', { ascending: true });
      if (questions && questions.length > 0) {
        const questionIds = questions.map((q: any) => q.question_id);
        const { data: teacherQuestions } = await supabase
          .from('teacher_questions').select('id, question_text, topic, options').in('id', questionIds);
        const questionDetails = new Map((teacherQuestions || []).map((q: any) => [q.id, q as any]));
        setQuizQuestions(questions.map((q: any) => ({
          question_id: q.question_id,
          marks: q.marks,
          display_order: q.display_order,
          question_text: (questionDetails.get(q.question_id) as any)?.question_text || '',
          topic: (questionDetails.get(q.question_id) as any)?.topic || '',
          options: ((questionDetails.get(q.question_id) as any)?.options as any[]) || [],
        })));
        const quizTotal = (questions as any[]).reduce((sum: number, q: any) => sum + q.marks, 0);
        if (quizTotal > 0) setTotalMarks(quizTotal);
      }
    } catch { /* non-critical */ }
    finally { setLoadingExistingQuiz(false); }
  }

  async function loadClasses() {
    if (!schoolId || !teacherId) { setClasses([]); return; }
    const { data } = await supabase
      .from('subject_classes').select('class_id, classes(id, name)')
      .eq('teacher_id', teacherId).eq('school_id', schoolId);
    if (!data) return;
    const uniqueClasses = new Map<string, ClassType>();
    data.forEach((item: any) => { if (item.classes) uniqueClasses.set(item.classes.id, item.classes); });
    setClasses(Array.from(uniqueClasses.values()));
  }

  async function loadSubjects(classId: string) {
    if (!classId || !schoolId || !teacherId) { setSubjects([]); return; }
    const { data } = await supabase
      .from('subject_classes').select('subject_id, subjects!subject_classes_subject_id_fkey(id, name)')
      .eq('teacher_id', teacherId).eq('class_id', classId).eq('school_id', schoolId);
    if (!data) return;
    const subjectsData = data.map((item: any) => item.subjects).filter((s: any): s is Subject => s !== null);
    setSubjects(subjectsData);
  }

  async function handleSave() {
    if (!selectedClass || !selectedSubject || !title || !dueDate || !schoolId) {
      toast.error('Please fill all required fields');
      return;
    }
    if (submissionType === 'objective' && quizQuestions.length === 0) {
      toast.error('Please select at least one question for the quiz');
      return;
    }
    let effectiveTotalMarks = totalMarks;
    if (submissionType === 'objective') {
      const quizTotal = quizQuestions.reduce((sum, q) => sum + q.marks, 0);
      effectiveTotalMarks = quizTotal > 0 ? quizTotal : totalMarks;
    }
    setIsSaving(true);
    try {
      const { data: currentSession } = await supabase
        .from('sessions').select('id').eq('is_current', true).eq('school_id', schoolId).maybeSingle();
      const { data: currentTerm } = await supabase
        .from('terms').select('id').eq('is_current', true).eq('school_id', schoolId).maybeSingle();
      if (!currentSession || !currentTerm) {
        toast.error('No active session or term found');
        setIsSaving(false);
        return;
      }
      const assignmentPayload: any = {
        teacher_id: teacherId,
        session_id: isEditing ? assignment.session_id : currentSession.id,
        term_id: isEditing ? assignment.term_id : currentTerm.id,
        class_id: selectedClass, subject_id: selectedSubject,
        title, description, instructions,
        due_date: dueDate,
        total_marks: effectiveTotalMarks,
        submission_type: submissionType,
        allow_late_submission: allowLate,
        school_id: schoolId,
      };
      let assignmentData: any;
      let assignmentId: string;
      if (isEditing) {
        const { data, error: updateError } = await supabase
          .from('assignments').update(assignmentPayload)
          .eq('id', assignment.id).eq('school_id', schoolId)
          .select('*, classes(name), subjects(name), assignment_submissions(id, grade)').single();
        if (updateError) throw updateError;
        assignmentData = data;
        assignmentId = assignment.id;
      } else {
        const { data, error: insertError } = await supabase
          .from('assignments').insert(assignmentPayload)
          .select('*, classes(name), subjects(name)').single();
        if (insertError) throw insertError;
        assignmentData = data;
        assignmentId = data.id;
      }
      if (submissionType === 'objective' && assignmentId) {
        const { error: configError } = await supabase
          .from('assignment_quiz_config')
          .upsert({ assignment_id: assignmentId, school_id: schoolId, ...quizConfig }, { onConflict: 'assignment_id' });
        if (configError) throw configError;
        const { error: deleteError } = await supabase
          .from('assignment_quiz_questions').delete().eq('assignment_id', assignmentId).eq('school_id', schoolId);
        if (deleteError) throw deleteError;
        if (quizQuestions.length > 0) {
          const questionRows = quizQuestions.map((q, idx) => ({
            assignment_id: assignmentId, school_id: schoolId,
            question_id: q.question_id, marks: q.marks, display_order: idx + 1,
          }));
          const { error: questionsError } = await supabase
            .from('assignment_quiz_questions').insert(questionRows);
          if (questionsError) throw questionsError;
        }
      }
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'teacher_assignment_file');
        formData.append('assignment_id', assignmentId);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'File upload failed');
        }
        const { fileUrl } = await res.json();
        const { error: updateError } = await supabase
          .from('assignments').update({ file_url: fileUrl }).eq('id', assignmentId);
        if (updateError) throw updateError;
        assignmentData.file_url = fileUrl;
      }
      toast.success(isEditing ? 'Assignment updated' : 'Assignment created');
      const normalizedData = {
        ...assignmentData,
        assignment_submissions: assignmentData.assignment_submissions || [],
        submissionCount: assignmentData.assignment_submissions?.length || 0,
        gradedCount: assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length || 0,
        isFullyGraded: assignmentData.assignment_submissions?.length > 0 &&
          assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length === assignmentData.assignment_submissions?.length,
        hasPendingGrading: (assignmentData.assignment_submissions?.filter((s: any) => s.grade !== null).length || 0) <
          (assignmentData.assignment_submissions?.length || 0),
        isOverdue: new Date(assignmentData.due_date) < new Date(),
      };
      onSave(normalizedData);
      onClose();
    } catch (error: any) {
      toast.error(error.message || ('Failed to ' + (isEditing ? 'update' : 'create') + ' assignment'));
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

        {submissionType !== 'objective' && (
          <div className="space-y-2">
            <Label>Attach file (Optional)</Label>
            {existingFileUrl && !file && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Current File:</p>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={async () => {
                      if (isEditing && assignment?.id) {
                        try {
                          const { error } = await supabase.from('assignments').update({ file_url: null })
                            .eq('id', assignment.id).eq('school_id', schoolId);
                          if (error) throw error;
                          toast.success('File removed');
                        } catch { toast.error('Failed to remove file'); return; }
                      }
                      setExistingFileUrl(null);
                    }}
                    className="text-red-600 hover:text-red-700">Remove</Button>
                </div>
                {existingFileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img src={existingFileUrl} alt="Preview" className="max-h-48 rounded border" />
                ) : existingFileUrl.match(/\.pdf$/i) ? (
                  <iframe src={existingFileUrl} className="w-full h-48 rounded border" />
                ) : (
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <a href={existingFileUrl} target="_blank" className="text-sm text-primary hover:underline">View File</a>
                  </div>
                )}
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer border rounded-md p-3 hover:bg-muted transition">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{file ? file.name : existingFileUrl ? 'Replace file' : 'Upload PDF, DOC, Image, etc.'}</span>
              <input type="file" hidden onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                if (selectedFile) { setFile(selectedFile); setExistingFileUrl(null); }
              }} />
            </label>
            {file && (
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">New File Selected:</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)} className="text-red-600 hover:text-red-700">Remove</Button>
                </div>
                {file.type.startsWith('image/') ? <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-48 rounded border" /> :
                 file.type === 'application/pdf' ? <iframe src={URL.createObjectURL(file)} className="w-full h-48 rounded border" /> :
                 <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-muted-foreground" /><span className="text-sm">{file.name}</span></div>}
              </div>
            )}
          </div>
        )}

        {submissionType === 'objective' && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-600" />Quiz Questions</Label>
            {loadingExistingQuiz ? (
              <div className="flex items-center justify-center py-8 border rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading quiz...</span>
              </div>
            ) : resolvingSubjectClass ? (
              <div className="flex items-center justify-center py-8 border rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Resolving subject...</span>
              </div>
            ) : subjectClassId ? (
              <AssignmentQuizBuilder
                schoolId={schoolId!}
                teacherId={teacherId}
                subjectClassId={subjectClassId}
                selectedQuestions={quizQuestions}
                onQuestionsChange={setQuizQuestions}
                quizConfig={quizConfig}
                onConfigChange={setQuizConfig}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
                <BookOpen className="h-4 w-4" />Select a valid class and subject combination to load question banks.
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <Input type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} disabled={submissionType === 'objective'} />
        </div>

        {submissionType === 'objective' && (
          <p className="text-xs text-muted-foreground -mt-3">Total marks are auto-calculated from selected question marks.</p>
        )}

        <div className="space-y-2">
          <Label>Submission Type</Label>
          <Select value={submissionType} onValueChange={(v: any) => {
            setSubmissionType(v);
            if (v !== 'objective') setFile(null);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text Answer</SelectItem>
              <SelectItem value="file">File Upload (PDF / Image)</SelectItem>
              <SelectItem value="both">Text + File</SelectItem>
              <SelectItem value="objective">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                  Objective Quiz (from Question Bank)
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {submissionType !== 'objective' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowLate} onChange={() => setAllowLate(!allowLate)} />
            Allow late submissions
          </div>
        )}

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
