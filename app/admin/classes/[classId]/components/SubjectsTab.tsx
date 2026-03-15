"use client";

import { useMemo, useState } from "react";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Copy, MoreVertical, BarChart3, User, Trash2, Edit, Users } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";

type SubjectClass = {
  id: string;
  subject_code: string;
  subject: {
    id: string;
    name: string;
    is_optional: boolean;
    religion?: string | null;
    department?: string | null;
  };
  teacher: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
};

interface SubjectsTabProps {
  subjects: SubjectClass[];
  teachers: Teacher[];
  students: Student[];
  classId: string;
  onGenerateCodes: () => void;
  onAssignTeacher: (subjectClassId: string, teacherId: string) => void;
  onDeleteSubject: (subjectClassId: string) => void;
  onRefresh: () => void;
  schoolId?: string | null;
}

export function SubjectsTab({
  subjects,
  teachers,
  students,
  classId,
  onGenerateCodes,
  onAssignTeacher,
  onDeleteSubject,
  onRefresh,
  schoolId,
}: SubjectsTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterOptional, setFilterOptional] = useState<"all" | "optional" | "compulsory">("all");
  const [filterReligion, setFilterReligion] = useState<"all" | string>("all");
  const [filterDepartment, setFilterDepartment] = useState<"all" | string>("all");
  const [departments, setDepartments] = useState<string[]>([]);
  const [religions, setReligions] = useState<string[]>([]);

  // Load departments and religions from database
  React.useEffect(() => {
    if (!schoolId) return;
    loadSchoolConfig();
  }, [schoolId]);

  async function loadSchoolConfig() {
    if (!schoolId) return;
    try {
      const [deptResult, religionResult] = await Promise.all([
        supabase
          .from("school_departments")
          .select("name")
          .eq("school_id", schoolId)
          .eq("is_active", true),
        supabase
          .from("school_religions")
          .select("name")
          .eq("school_id", schoolId)
          .eq("is_active", true),
      ]);

      if (deptResult.data) {
        setDepartments(deptResult.data.map((d: { name: any; }) => d.name));
      }
      if (religionResult.data) {
        setReligions(religionResult.data.map((r: { name: any; }) => r.name));
      }
    } catch (error) {
      console.error("Error loading school config:", error);
    }
  }

  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false);
  const [selectedSubjectClass, setSelectedSubjectClass] = useState<SubjectClass | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSubjectClass, setEditingSubjectClass] = useState<SubjectClass | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsOptional, setEditIsOptional] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false);
  const [managingSubjectClass, setManagingSubjectClass] = useState<SubjectClass | null>(null);
  const [enrolledStudentIds, setEnrolledStudentIds] = useState<string[]>([]);
  const [isLoadingEnrollment, setIsLoadingEnrollment] = useState(false);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (!s.subject) return false;
      if (search && !s.subject.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterOptional === "optional" && !s.subject.is_optional) return false;
      if (filterOptional === "compulsory" && s.subject.is_optional) return false;
      if (filterReligion !== "all" && s.subject.religion !== filterReligion) return false;
      if (filterDepartment !== "all" && s.subject.department !== filterDepartment) return false;
      return true;
    });
  }, [subjects, search, filterOptional, filterReligion, filterDepartment]);

  function openAssignTeacherDialog(sc: SubjectClass) {
    setSelectedSubjectClass(sc);
    setSelectedTeacherId(sc.teacher?.id || "");
    setIsAssignTeacherOpen(true);
  }

  function handleAssignTeacher() {
    if (!selectedSubjectClass || !selectedTeacherId) return;
    onAssignTeacher(selectedSubjectClass.id, selectedTeacherId);
    setIsAssignTeacherOpen(false);
  }

  function handleDeleteSubjectClass(sc: SubjectClass) {
    if (!confirm(`Remove ${sc.subject.name} from this class?`)) return;
    onDeleteSubject(sc.id);
  }

  function openEditDialog(sc: SubjectClass) {
    setEditingSubjectClass(sc);
    setEditName(sc.subject.name);
    setEditIsOptional(sc.subject.is_optional);
    setIsEditOpen(true);
  }

  async function handleEditSubmit() {
    if (!editingSubjectClass || !editName.trim()) {
      toast.error("Subject name is required");
      return;
    }

    setIsEditSubmitting(true);

    try {
      const { error } = await supabase
        .from("subjects")
        .update({
          name: editName,
          is_optional: editIsOptional,
        })
        .eq("id", editingSubjectClass.subject.id);

      if (error) throw error;

      toast.success("Subject updated successfully");
      setIsEditOpen(false);
      onRefresh();
    } catch (error: any) {
      if (error.message?.includes("23505")) {
        toast.error("Subject name already exists");
      } else {
        toast.error("Failed to update subject");
      }
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function openManageStudentsDialog(sc: SubjectClass) {
    setManagingSubjectClass(sc);
    setIsManageStudentsOpen(true);
    setIsLoadingEnrollment(true);

    try {
      const { data, error } = await supabase
        .from("student_optional_subjects")
        .select("student_id")
        .eq("subject_id", sc.subject.id);

      if (error) throw error;

      setEnrolledStudentIds((data || []).map((d: any) => d.student_id));
    } catch {
      toast.error("Failed to load enrollment");
      setEnrolledStudentIds([]);
    } finally {
      setIsLoadingEnrollment(false);
    }
  }

  async function handleToggleStudentEnrollment(
    studentId: string,
    shouldEnroll: boolean
  ) {
    if (!managingSubjectClass) return;

    try {
      if (shouldEnroll) {
        const { error } = await supabase
          .from("student_optional_subjects")
          .insert({
            student_id: studentId,
            subject_id: managingSubjectClass.subject.id,
          });

        if (error) throw error;

        setEnrolledStudentIds((prev) => [...prev, studentId]);
        toast.success("Student enrolled");
      } else {
        const { error } = await supabase
          .from("student_optional_subjects")
          .delete()
          .eq("student_id", studentId)
          .eq("subject_id", managingSubjectClass.subject.id);

        if (error) throw error;

        setEnrolledStudentIds((prev) =>
          prev.filter((id) => id !== studentId)
        );
        toast.success("Student unenrolled");
      }
    } catch {
      toast.error("Update failed");
    }
  }


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Class Subjects</span>
            <Button variant="outline" size="sm" onClick={onGenerateCodes}>
              Generate Missing Codes
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search subject..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="border rounded-md p-2"
              value={filterOptional}
              onChange={(e) => setFilterOptional(e.target.value as any)}
            >
              <option value="all">All</option>
              <option value="compulsory">Compulsory</option>
              <option value="optional">Optional</option>
            </select>

            <select
              className="border rounded-md p-2"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value as any)}
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {religions.length > 0 && (
              <select
                className="border rounded-md p-2"
                value={filterReligion}
                onChange={(e) => setFilterReligion(e.target.value as any)}
              >
                <option value="all">All Religions</option>
                {religions.map((religion) => (
                  <option key={religion} value={religion}>
                    {religion}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3 text-left w-12">#</th>
                  <th className="p-3 text-left">Subject</th>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-left">Teacher</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSubjects.map((sc, i) => (
                  <tr key={sc.id} className="border-t hover:bg-muted/50">
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-medium">
                      <span>{sc.subject.name}</span>
                    </td>
                    <td className="p-3 font-mono flex items-center gap-2">
                      {sc.subject_code}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(sc.subject_code);
                          toast.success("Copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="p-3">
                      {sc.teacher ? `${sc.teacher.first_name} ${sc.teacher.last_name}` : "—"}
                    </td>
                    <td className="p-3">
                      {sc.subject?.is_optional ? (
                        <Badge variant="secondary">Optional</Badge>
                      ) : (
                        <Badge>Compulsory</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/admin/subject-classes/${sc.id}/analytics`)}
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            View Analysis
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => openEditDialog(sc)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Subject
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => openAssignTeacherDialog(sc)}>
                            <User className="mr-2 h-4 w-4" />
                            Assign Teacher
                          </DropdownMenuItem>

                          {sc.subject.is_optional && (
                            <DropdownMenuItem onClick={() => openManageStudentsDialog(sc)}>
                              <Users className="mr-2 h-4 w-4" />
                              Manage Students
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDeleteSubjectClass(sc)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredSubjects.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No subjects match your filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign Teacher Dialog */}
      <Dialog open={isAssignTeacherOpen} onOpenChange={setIsAssignTeacherOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher to {selectedSubjectClass?.subject.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full border rounded-md p-2"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAssignTeacherOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignTeacher}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Subject Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_name">Subject Name</Label>
              <Input
                id="edit_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter subject name"
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label htmlFor="edit_optional">Optional Subject</Label>
                <p className="text-xs text-gray-500">
                  Mark if this subject is optional for students
                </p>
              </div>
              <Switch
                id="edit_optional"
                checked={editIsOptional}
                onCheckedChange={setEditIsOptional}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isEditSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleEditSubmit} disabled={isEditSubmitting}>
                {isEditSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Students for Optional Subject Dialog */}
      <Dialog open={isManageStudentsOpen} onOpenChange={setIsManageStudentsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Students for {managingSubjectClass?.subject.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select which students should take this optional subject
            </p>
          </DialogHeader>

          {isLoadingEnrollment ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading enrollment data...
            </div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No students in this class
            </div>
          ) : (
            <div className="space-y-2">
              {students.map((student) => {
                const isEnrolled = enrolledStudentIds.includes(student.id);
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isEnrolled}
                        onCheckedChange={(checked) =>
                          handleToggleStudentEnrollment(student.id, checked as boolean)
                        }
                      />
                      <div>
                        <p className="font-medium">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {student.student_id}
                        </p>
                      </div>
                    </div>
                    {isEnrolled && (
                      <Badge variant="secondary" className="text-xs">
                        Enrolled
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsManageStudentsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

