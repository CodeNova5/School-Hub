"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpen, Edit, User } from "lucide-react";

interface ClassSubject {
  id: string;
  subject_code: string | null;
  subject: {
    id: string;
    name: string;
    is_optional: boolean;
  };
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  staff_id: string;
}

export default function ClassSubjectsPage() {
  
const params = useParams();
const classId = params.classId as string;

  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editing, setEditing] = useState<ClassSubject | null>(null);
  const [subjectCode, setSubjectCode] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchClassSubjects();
    fetchTeachers();
  }, [classId]);

  async function fetchClassSubjects() {
    if (!classId) return;
    const { data, error } = await supabase
      .from("subject_classes")
      .select(`
        id,
        subject_code,
        subject:subjects(id, name, is_optional),
        teacher:teachers(id, first_name, last_name)
      `)
      .eq("class_id", classId)
      .order("subject_code", { ascending: true });

    if (error) {
      toast.error("Failed to load class subjects");
      return;
    }

    const transformed = (data || []).map((item: any) => ({
      id: item.id,
      subject_code: item.subject_code,
      subject: Array.isArray(item.subject) ? item.subject[0] : item.subject,
      teacher: Array.isArray(item.teacher) ? item.teacher[0] : item.teacher,
    }));

    setClassSubjects(transformed);
  }

  async function fetchTeachers() {
    const { data } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, staff_id")
      .eq("status", "active")
      .order("first_name");

    if (data) setTeachers(data);
  }

  function openEdit(cs: ClassSubject) {
    setEditing(cs);
    setSubjectCode(cs.subject_code || "");
    setTeacherId(cs.teacher?.id || "");
    setOpen(true);
  }

  async function saveChanges() {
    if (!editing) return;

    if (!subjectCode.trim()) {
      toast.error("Subject code is required (e.g. MATH 101)");
      return;
    }

    const { error } = await supabase
      .from("subject_classes")
      .update({
        subject_code: subjectCode.trim(),
        teacher_id: teacherId || null,
      })
      .eq("id", editing.id);

    if (error) {
      toast.error("Failed to update subject for class");
      return;
    }

    toast.success("Class subject updated");
    setOpen(false);
    setEditing(null);
    fetchClassSubjects();
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Class Subjects</h1>
          <p className="text-gray-600 mt-1">
            Assign subject codes and teachers for this class
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classSubjects.map((cs) => (
            <Card key={cs.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-orange-600" />
                  {cs.subject.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {cs.subject.is_optional && (
                    <Badge variant="secondary">Optional</Badge>
                  )}
                  {cs.subject_code && (
                    <Badge variant="outline">{cs.subject_code}</Badge>
                  )}
                </div>

                <div className="text-sm text-gray-600 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {cs.teacher
                    ? `${cs.teacher.first_name} ${cs.teacher.last_name}`
                    : "No teacher assigned"}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => openEdit(cs)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Class Subject</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Subject Code</Label>
                <Input
                  placeholder="MATH 101"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                />
              </div>

              <div>
                <Label>Teacher</Label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">No Teacher</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} ({t.staff_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={saveChanges}>
                  Save
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
