"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Student, Subject } from '@/lib/types';
import { toast } from 'sonner';
import { BookOpen, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StudentSubjectsModalProps {
  student: Student | null;
  open: boolean;
  onClose: () => void;
}

export function StudentSubjectsModal({ student, open, onClose }: StudentSubjectsModalProps) {
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (open && student) {
      loadData();
    }
  }, [open, student]);

  async function loadData() {
    if (!student) return;

    setIsLoading(true);
    try {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id')
        .eq('is_current', true)
        .single();

      if (!sessionData) {
        toast.error('No active session found');
        setIsLoading(false);
        return;
      }

      setCurrentSessionId(sessionData.id);

      const { data: classData } = await supabase
        .from('classes')
        .select('education_level, department')
        .eq('id', student.class_id)
        .single();

      if (!classData) {
        toast.error('Class not found');
        setIsLoading(false);
        return;
      }

      let subjectsQuery = supabase
        .from('subjects')
        .select('*')
        .eq('education_level', classData.education_level);

      if (classData.education_level === 'SSS' && classData.department) {
        subjectsQuery = subjectsQuery.eq('department', classData.department);
      }

      const { data: subjectsData } = await subjectsQuery.order('name');

      if (subjectsData) {
        setAvailableSubjects(subjectsData);
      }

      const { data: studentSubjectsData } = await supabase
        .from('student_subjects')
        .select('subject_id')
        .eq('student_id', student.id)
        .eq('session_id', sessionData.id);

      if (studentSubjectsData) {
        setSelectedSubjects(studentSubjectsData.map(ss => ss.subject_id));
      }
    } catch (error: any) {
      toast.error('Failed to load subjects: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!student || !currentSessionId) return;

    setIsSaving(true);
    try {
      await supabase
        .from('student_subjects')
        .delete()
        .eq('student_id', student.id)
        .eq('session_id', currentSessionId);

      const records = selectedSubjects.map(subjectId => ({
        student_id: student.id,
        subject_id: subjectId,
        session_id: currentSessionId,
      }));

      if (records.length > 0) {
        const { error } = await supabase
          .from('student_subjects')
          .insert(records);

        if (error) throw error;
      }

      toast.success('Subjects updated successfully');
      onClose();
    } catch (error: any) {
      toast.error('Failed to save subjects: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSubject(subjectId: string) {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  const requiredSubjects = availableSubjects.filter(s => !s.is_optional);
  const optionalSubjects = availableSubjects.filter(s => s.is_optional);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Subject Selection
          </DialogTitle>
          {student && (
            <p className="text-sm text-gray-600 mt-2">
              {student.first_name} {student.last_name} ({student.student_id})
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {requiredSubjects.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  Required Subjects
                  <Badge variant="outline">{requiredSubjects.length}</Badge>
                </h3>
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  {requiredSubjects.map(subject => (
                    <div
                      key={subject.id}
                      className="flex items-center gap-3 p-3 bg-white rounded border hover:border-blue-300 transition-colors"
                    >
                      <Checkbox
                        id={subject.id}
                        checked={selectedSubjects.includes(subject.id)}
                        onCheckedChange={() => toggleSubject(subject.id)}
                      />
                      <label
                        htmlFor={subject.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{subject.name}</div>
                        {subject.department && (
                          <div className="text-xs text-gray-500">
                            {subject.department}
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {optionalSubjects.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  Optional Subjects
                  <Badge variant="secondary">{optionalSubjects.length}</Badge>
                </h3>
                <div className="space-y-3 bg-amber-50 p-4 rounded-lg">
                  {optionalSubjects.map(subject => (
                    <div
                      key={subject.id}
                      className="flex items-center gap-3 p-3 bg-white rounded border hover:border-amber-300 transition-colors"
                    >
                      <Checkbox
                        id={subject.id}
                        checked={selectedSubjects.includes(subject.id)}
                        onCheckedChange={() => toggleSubject(subject.id)}
                      />
                      <label
                        htmlFor={subject.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium flex items-center gap-2">
                          {subject.name}
                          <Badge variant="secondary" className="text-xs">
                            Optional
                          </Badge>
                        </div>
                        {(subject.department || subject.religion) && (
                          <div className="text-xs text-gray-500">
                            {[subject.department, subject.religion].filter(Boolean).join(' • ')}
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {availableSubjects.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No subjects available for this class</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Selected:</strong> {selectedSubjects.length} subject(s)
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Subjects'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
