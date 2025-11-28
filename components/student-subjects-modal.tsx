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
  const [requiredSubjects, setRequiredSubjects] = useState<Subject[]>([]);
  const [optionalSubjects, setOptionalSubjects] = useState<Subject[]>([]);
  const [religionSubject, setReligionSubject] = useState<Subject | null>(null);
  const [selectedOptional, setSelectedOptional] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open && student) {
      loadData();
    }
  }, [open, student]);

  async function loadData() {
    if (!student) return;

    setIsLoading(true);
    try {
      // 1. Load all subjects assigned automatically to the student (RPC)
      const { data: subjectsData, error } = await supabase.rpc(
        "get_student_subjects",
        { student_uuid: student.id }
      );

      if (error) throw error;
      if (!subjectsData) return;

      // Separate subjects into categories
      const required = subjectsData.filter((s: any) => !s.is_optional && !s.religion);
      const optional = subjectsData.filter((s: any) => s.is_optional);
      const religion = subjectsData.find((s: any) => s.religion);

      setRequiredSubjects(required);
      setOptionalSubjects(optional);
      setReligionSubject(religion || null);

      // 2. Load previously selected optional subjects
      const { data: optionalSelected } = await supabase
        .from("student_optional_subjects")
        .select("subject_id")
        .eq("student_id", student.id);

      if (optionalSelected) {
        setSelectedOptional(optionalSelected.map((s) => s.subject_id));
      }
    } catch (err: any) {
      toast.error("Failed to load subjects: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  function toggleOptional(subjectId: string) {
    setSelectedOptional((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  async function handleSave() {
    if (!student) return;

    setIsSaving(true);
    try {
      // clear old optional selections
      await supabase
        .from("student_optional_subjects")
        .delete()
        .eq("student_id", student.id);

      // save new selections
      const records = selectedOptional.map((subjectId) => ({
        student_id: student.id,
        subject_id: subjectId,
      }));

      if (records.length > 0) {
        const { error } = await supabase
          .from("student_optional_subjects")
          .insert(records);

        if (error) throw error;
      }

      toast.success("Optional subjects updated successfully");
      onClose();
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Subjects for {student?.first_name} {student?.last_name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="space-y-6">

            {/* REQUIRED SUBJECTS */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                Required Subjects
                <Badge variant="outline">{requiredSubjects.length}</Badge>
              </h3>

              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                {requiredSubjects.map((sub) => (
                  <div key={sub.id} className="p-3 bg-white rounded border">
                    <div className="font-medium">{sub.name}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RELIGION SUBJECT */}
            {religionSubject && (
              <div>
                <h3 className="font-semibold text-lg mb-3">Religion Subject</h3>
                <div className="bg-blue-50 border p-4 rounded">
                  {religionSubject.name} ({religionSubject.religion})
                </div>
              </div>
            )}

            {/* OPTIONAL SUBJECTS */}
            {optionalSubjects.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">
                  Optional Subjects
                </h3>

                <div className="space-y-3 bg-amber-50 p-4 rounded-lg">
                  {optionalSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 p-3 bg-white rounded border"
                    >
                      <Checkbox
                        checked={selectedOptional.includes(sub.id)}
                        onCheckedChange={() => toggleOptional(sub.id)}
                      />
                      <label className="flex-1 cursor-pointer">
                        <div className="font-medium flex items-center gap-2">
                          {sub.name}
                          <Badge variant="secondary" className="text-xs">
                            Optional
                          </Badge>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Optional Subjects"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
